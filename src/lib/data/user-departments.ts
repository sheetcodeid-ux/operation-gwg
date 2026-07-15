import "server-only";

import { db, dbEnabled } from "./db";

/**
 * Admin-managed department → jabatan taxonomy for User Management.
 *
 * Feeds the Add User "Departement" + "Jabatan" comboboxes. Stored in the DB
 * (table `user_departments`), or in memory when the DB is disabled (demo mode).
 * Kept separate from the assessment org (`org_departments`/`org_employees`).
 */

export interface UserDept {
  id: string;
  name: string;
  jabatan: string[];
}

interface DeptRow {
  id: string;
  name: string;
  jabatan: string[] | null;
}

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/&/g, "dan")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const userDepartmentId = (name: string) => `dep_${slug(name)}`;

const mem = new Map<string, UserDept>();

/** All admin-defined departments with their jabatan lists. Never throws. */
export async function getUserDepartments(): Promise<UserDept[]> {
  if (!dbEnabled) return [...mem.values()];
  try {
    const { data } = await db().from("user_departments").select("id,name,jabatan");
    return ((data ?? []) as DeptRow[]).map((r) => ({ id: r.id, name: r.name, jabatan: r.jabatan ?? [] }));
  } catch {
    return [];
  }
}

/** Create or replace a department and its jabatan list (upsert by slug id). */
export async function saveUserDepartment(name: string, jabatan: string[]): Promise<{ id: string }> {
  const clean = name.trim();
  const id = userDepartmentId(clean);
  // De-dupe + drop blanks, preserve order.
  const jab = [...new Set(jabatan.map((j) => j.trim()).filter(Boolean))];
  if (!dbEnabled) {
    mem.set(id, { id, name: clean, jabatan: jab });
    return { id };
  }
  await db()
    .from("user_departments")
    .upsert({ id, name: clean, jabatan: jab, updated_at: new Date().toISOString() });
  return { id };
}

export async function deleteUserDepartment(id: string): Promise<void> {
  if (!dbEnabled) {
    mem.delete(id);
    return;
  }
  await db().from("user_departments").delete().eq("id", id);
}
