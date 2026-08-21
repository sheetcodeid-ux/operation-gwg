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
  /** Level 1–6 di bagan organisasi; null berarti belum ditempatkan. */
  level: number | null;
  parentId: string | null;
  urutan: number | null;
  /** Posisi hasil geseran. NULL berarti ikut tata letak otomatis — itu bedanya
   *  dengan 0 yang berarti memang ditaruh di pojok. */
  posX: number | null;
  posY: number | null;
}

interface DeptRow {
  id: string;
  name: string;
  jabatan: string[] | null;
  level: number | null;
  parent_id: string | null;
  urutan: number | null;
  pos_x: number | null;
  pos_y: number | null;
}

const KOLOM = "id,name,jabatan,level,parent_id,urutan,pos_x,pos_y";

const dariBaris = (r: DeptRow): UserDept => ({
  id: r.id,
  name: r.name,
  jabatan: r.jabatan ?? [],
  level: r.level,
  parentId: r.parent_id,
  urutan: r.urutan,
  posX: r.pos_x,
  posY: r.pos_y,
});

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
    const { data } = await db().from("user_departments").select(KOLOM);
    return ((data ?? []) as DeptRow[]).map(dariBaris);
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
    mem.set(id, { id, name: clean, jabatan: jab, level: null, parentId: null, urutan: null, posX: null, posY: null });
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


/**
 * Simpan penempatan satu departemen di bagan: level, atasan, dan posisinya.
 *
 * Kolom yang tidak disebut TIDAK disentuh — daftar jabatan dan namanya tetap
 * milik "Kelola Departemen & Jabatan". Menyimpan seluruh baris dari layar bagan
 * berarti menggeser kotak bisa menghapus jabatan yang baru saja diisi orang
 * lain di layar sebelah.
 */
export async function simpanPenempatanDepartemen(input: {
  id: string;
  level?: number | null;
  parentId?: string | null;
  urutan?: number | null;
  posX?: number | null;
  posY?: number | null;
}): Promise<void> {
  const tambalan: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.level !== undefined) tambalan.level = input.level;
  if (input.parentId !== undefined) tambalan.parent_id = input.parentId;
  if (input.urutan !== undefined) tambalan.urutan = input.urutan;
  if (input.posX !== undefined) tambalan.pos_x = input.posX;
  if (input.posY !== undefined) tambalan.pos_y = input.posY;

  if (!dbEnabled) {
    const ada = mem.get(input.id);
    if (ada) mem.set(input.id, { ...ada, ...input } as UserDept);
    return;
  }
  const { error } = await db().from("user_departments").update(tambalan).eq("id", input.id);
  if (error) throw new Error(error.message);
}
