import "server-only";

import { randomUUID } from "node:crypto";
import { SEED } from "./seed";
import { registerCredential, setPassword } from "./credentials";
import { getUser } from "./store";
import { saveUser, deleteUserRow, PersistError } from "./persist";
import type { Role, UserProfile } from "../types";

/** Admin user-management writes (demo). Phase 11: Supabase Auth admin API + profiles table. */

const nextId = () => `usr_${randomUUID()}`;

export async function createUser(input: {
  name: string;
  email: string;
  role: Role;
  areaId?: string | null;
  outletIds?: string[];
  password: string;
  phone?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  department?: string | null;
  jabatan?: string | null;
  grants?: string[];
}): Promise<UserProfile> {
  const user: UserProfile = {
    id: nextId(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    areaId: input.areaId ?? null,
    outletIds: input.outletIds ?? [],
    avatarUrl: input.avatarUrl ?? null,
    phone: input.phone ?? null,
    country: input.country ?? null,
    department: input.department ?? null,
    jabatan: input.jabatan ?? null,
    grants: input.grants ?? [],
    active: true,
    createdAt: new Date().toISOString(),
  };
  SEED.users.push(user);
  const { error } = await saveUser(user);
  if (error) {
    const i = SEED.users.indexOf(user);
    if (i >= 0) SEED.users.splice(i, 1);
    throw new PersistError(error);
  }
  registerCredential(user.id, user.email, input.password);
  return user;
}

export function setUserActive(id: string, active: boolean) {
  const user = getUser(id);
  if (!user) return;
  user.active = active;
  void saveUser(user);
}

/**
 * Pindahkan seorang karyawan ke departemen lain — atau keluarkan dari semuanya.
 *
 * Dipakai bagan organisasi untuk menambah/melepas anggota sebuah role. Nama
 * departemen, bukan id, karena itulah yang tersimpan di profil dan yang dipakai
 * seluruh penyaringan menu.
 */
export function setUserDepartment(id: string, department: string | null) {
  const user = getUser(id);
  if (!user) return;
  user.department = department ?? undefined;
  void saveUser(user);
}

export function setUserAssignment(id: string, patch: { areaId?: string | null; outletIds?: string[] }) {
  const user = getUser(id);
  if (!user) return;
  if (patch.areaId !== undefined) user.areaId = patch.areaId;
  if (patch.outletIds !== undefined) user.outletIds = patch.outletIds;
  void saveUser(user);
}

export function resetUserPassword(id: string, password: string) {
  setPassword(id, password);
}

/** Update editable profile fields (name/email/role/assignment). */
export function updateUser(
  id: string,
  patch: {
    name?: string;
    email?: string;
    role?: Role;
    areaId?: string | null;
    outletIds?: string[];
    phone?: string | null;
    country?: string | null;
    avatarUrl?: string | null;
    department?: string | null;
    jabatan?: string | null;
    grants?: string[];
  },
) {
  const user = getUser(id);
  if (!user) return;
  if (patch.name !== undefined) user.name = patch.name.trim();
  if (patch.email !== undefined) user.email = patch.email.trim().toLowerCase();
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.areaId !== undefined) user.areaId = patch.areaId;
  if (patch.outletIds !== undefined) user.outletIds = patch.outletIds;
  if (patch.phone !== undefined) user.phone = patch.phone;
  if (patch.country !== undefined) user.country = patch.country;
  if (patch.avatarUrl !== undefined) user.avatarUrl = patch.avatarUrl;
  if (patch.department !== undefined) user.department = patch.department;
  if (patch.jabatan !== undefined) user.jabatan = patch.jabatan;
  if (patch.grants !== undefined) user.grants = patch.grants;
  void saveUser(user);
}

/** Remove a user's profile (they can no longer sign in). */
export async function deleteUser(id: string) {
  const i = SEED.users.findIndex((u) => u.id === id);
  if (i >= 0) SEED.users.splice(i, 1);
  await deleteUserRow(id);
}

export function emailExists(email: string, exceptId?: string) {
  return SEED.users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email.trim().toLowerCase());
}
