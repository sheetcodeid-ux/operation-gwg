import "server-only";

import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { WORK_CATEGORIES } from "@/lib/constants";

/**
 * Per-department Work Tracker categories. Super Admin curates a custom category
 * list for each department; task creators pick from their own department's list.
 * A department with no custom entries falls back to the built-in defaults, so
 * the picker is never empty out of the box. Stored in `task_categories`
 * (department, name); in-memory in demo mode.
 */

const mem = new Map<string, Set<string>>(); // department → names

export const DEFAULT_CATEGORIES: string[] = [...WORK_CATEGORIES];

/** All custom categories grouped by department (raw, no defaults applied). */
export async function listTaskCategoryOverrides(): Promise<Record<string, string[]>> {
  if (!dbEnabled) {
    const out: Record<string, string[]> = {};
    for (const [dept, names] of mem) out[dept] = [...names];
    return out;
  }
  const out: Record<string, string[]> = {};
  try {
    const { data } = await db().from("task_categories").select("department,name").order("name");
    for (const r of (data ?? []) as { department: string; name: string }[]) {
      (out[r.department] ??= []).push(r.name);
    }
  } catch {
    /* table missing / offline → no overrides */
  }
  return out;
}

/** Categories to show for a department: its custom list, or the defaults when
 *  it hasn't defined any yet. */
export function categoriesFor(overrides: Record<string, string[]>, department: string): string[] {
  const custom = overrides[department];
  return custom && custom.length ? custom : DEFAULT_CATEGORIES;
}

/** department → categories to show, for every department that might be picked. */
export async function categoriesByDivision(departments: string[]): Promise<Record<string, string[]>> {
  const overrides = await listTaskCategoryOverrides();
  const out: Record<string, string[]> = {};
  for (const d of departments) out[d] = categoriesFor(overrides, d);
  return out;
}

/** Before the first edit, snapshot the default list into the table so that
 *  deleting a default category actually sticks (otherwise a department with no
 *  rows keeps showing defaults). No-op once the department has any rows. */
async function ensureMaterialized(dept: string) {
  const { count } = await db().from("task_categories").select("*", { count: "exact", head: true }).eq("department", dept);
  if ((count ?? 0) > 0) return;
  await db().from("task_categories").upsert(DEFAULT_CATEGORIES.map((name) => ({ department: dept, name })), { onConflict: "department,name" });
}

export async function addTaskCategory(department: string, name: string): Promise<{ error?: string }> {
  const dept = department.trim();
  const clean = name.trim();
  if (!dept || !clean) return { error: "Departemen & nama kategori wajib diisi." };
  if (!dbEnabled) {
    (mem.get(dept) ?? mem.set(dept, new Set()).get(dept)!).add(clean);
    return {};
  }
  markLocalWrite();
  await ensureMaterialized(dept);
  const { error } = await db().from("task_categories").upsert({ department: dept, name: clean }, { onConflict: "department,name" });
  return error ? { error: error.message } : {};
}

export async function deleteTaskCategory(department: string, name: string): Promise<{ error?: string }> {
  if (!dbEnabled) {
    mem.get(department)?.delete(name);
    return {};
  }
  markLocalWrite();
  await ensureMaterialized(department);
  const { error } = await db().from("task_categories").delete().eq("department", department).eq("name", name);
  return error ? { error: error.message } : {};
}
