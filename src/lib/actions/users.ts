"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOutlet, getUser } from "@/lib/data/store";
import {
  createUser,
  deleteUser,
  emailExists,
  resetUserPassword,
  setUserActive,
  setUserAssignment,
  updateUser,
} from "@/lib/data/user-mutations";
import { persistMessage } from "@/lib/data/persist";
import { syncUserEmployee, unsyncUserEmployee } from "@/lib/data/org";
import { createUserSchema, parseInput } from "@/lib/validation";
import type { Role } from "@/lib/types";

/** A head/evaluator position — surfaces in the assessment org as a Head. */
const isHeadPosition = (role: Role, jabatan: string | null | undefined) =>
  role === "assessor" || role.startsWith("head_") || (!!jabatan && /^\s*head\b/i.test(jabatan));

function normalizeAssignment(role: Role, outletIds: string[]): { areaId: string | null; outletIds: string[] } {
  if (role === "area_coordinator") {
    const areaId = outletIds.length ? getOutlet(outletIds[0])?.areaId ?? null : null;
    return { areaId, outletIds };
  }
  // Single-branch roles: supervisor + these HQ-adjacent ops roles hold one outlet.
  if (role === "head_operation" || role === "pos_operation" || role === "supervisor") {
    return { areaId: null, outletIds: outletIds.slice(0, 1) };
  }
  return { areaId: null, outletIds: [] };
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  password: string;
  outletIds: string[];
  phone?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  department?: string | null;
  jabatan?: string | null;
  grants?: string[];
}

export async function createUserAction(input: CreateUserInput) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };

  const parsed = parseInput(createUserSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;

  if (emailExists(clean.email)) return { error: "Email already exists." };
  if (clean.role === "area_coordinator" && clean.outletIds.length === 0)
    return { error: "Assign at least one outlet to the coordinator." };
  if (clean.role === "supervisor" && clean.outletIds.length === 0)
    return { error: "Pilih 1 outlet untuk supervisor." };

  const { areaId, outletIds } = normalizeAssignment(clean.role, clean.outletIds);
  let created;
  try {
    created = await createUser({
      name: clean.name,
      email: clean.email,
      role: clean.role,
      areaId,
      outletIds,
      password: clean.password,
      phone: input.phone ?? null,
      country: input.country ?? null,
      avatarUrl: input.avatarUrl ?? null,
      department: input.department ?? null,
      jabatan: input.jabatan ?? null,
      grants: input.grants ?? [],
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }
  // Mirror into the assessment org so the name shows in the picker.
  await syncUserEmployee({
    userId: created.id,
    department: input.department ?? null,
    jabatan: input.jabatan ?? null,
    name: created.name,
    isHead: isHeadPosition(clean.role, input.jabatan),
  });
  revalidatePath("/admin/users");
  revalidatePath("/assessment");
  return { ok: true };
}

export interface UpdateUserInput {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
  outletIds: string[];
  phone?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  department?: string | null;
  jabatan?: string | null;
  grants?: string[];
}

export async function updateUserAction(input: UpdateUserInput) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  if (!getUser(input.id)) return { error: "User not found." };
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  if (emailExists(email, input.id)) return { error: "Email already exists." };
  if (input.password && input.password.length < 6) return { error: "Password must be at least 6 characters." };

  const { areaId, outletIds } = normalizeAssignment(input.role, input.outletIds);
  updateUser(input.id, {
    name,
    email,
    role: input.role,
    areaId,
    outletIds,
    phone: input.phone ?? null,
    country: input.country ?? null,
    department: input.department ?? null,
    jabatan: input.jabatan ?? null,
    ...(input.grants !== undefined ? { grants: input.grants } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
  });
  if (input.password) resetUserPassword(input.id, input.password);
  await syncUserEmployee({
    userId: input.id,
    department: input.department ?? null,
    jabatan: input.jabatan ?? null,
    name,
    isHead: isHeadPosition(input.role, input.jabatan),
  });
  revalidatePath("/admin/users");
  revalidatePath("/assessment");
  return { ok: true };
}

export async function assignRoleAction(userId: string, role: Role) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  const user = getUser(userId);
  if (!user) return { error: "User not found." };
  const { areaId, outletIds } = normalizeAssignment(role, user.outletIds ?? []);
  updateUser(userId, { role, areaId, outletIds });
  await syncUserEmployee({
    userId,
    department: user.department ?? null,
    jabatan: user.jabatan ?? null,
    name: user.name,
    isHead: isHeadPosition(role, user.jabatan),
  });
  revalidatePath("/admin/users");
  revalidatePath("/assessment");
  return { ok: true };
}

export async function updateGrantsAction(userId: string, grants: string[]) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  if (!getUser(userId)) return { error: "User not found." };
  updateUser(userId, { grants });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(userId: string) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  if (userId === admin.id) return { error: "You can't delete your own account." };
  await deleteUser(userId);
  await unsyncUserEmployee(userId);
  revalidatePath("/admin/users");
  revalidatePath("/assessment");
  return { ok: true };
}

export async function resetPasswordAction(userId: string, password: string) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  resetUserPassword(userId, password);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleActiveAction(userId: string, active: boolean) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  if (userId === admin.id) return { error: "You can't deactivate your own account." };
  setUserActive(userId, active);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateAssignmentAction(userId: string, role: Role, outletIds: string[]) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  const { areaId, outletIds: normalized } = normalizeAssignment(role, outletIds);
  setUserAssignment(userId, { areaId, outletIds: normalized });
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Self-service password change from the profile page. */
export async function changeOwnPasswordAction(password: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  resetUserPassword(user.id, password);
  return { ok: true };
}
