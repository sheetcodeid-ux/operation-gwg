"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getOutlet } from "@/lib/data/store";
import { createUser, emailExists, resetUserPassword, setUserActive, setUserAssignment } from "@/lib/data/user-mutations";
import { createUserSchema, parseInput } from "@/lib/validation";
import type { Role } from "@/lib/types";

function normalizeAssignment(role: Role, outletIds: string[]): { areaId: string | null; outletIds: string[] } {
  if (role === "area_coordinator") {
    const areaId = outletIds.length ? getOutlet(outletIds[0])?.areaId ?? null : null;
    return { areaId, outletIds };
  }
  // Branch is optional (single) for these; HQ roles get none.
  if (role === "head_operation" || role === "pos_operation") {
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

  const { areaId, outletIds } = normalizeAssignment(clean.role, clean.outletIds);
  createUser({ name: clean.name, email: clean.email, role: clean.role, areaId, outletIds, password: clean.password });
  revalidatePath("/admin/users");
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
