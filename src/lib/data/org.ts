import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { orgDepartmentId, type OrgExtra } from "@/lib/assessment/org";

/** Admin-managed assessment org (departments/divisions + employees), stored in
 *  the DB and merged on top of the built-in structure. In demo mode (no DB) it
 *  lives in memory. */

interface DeptRow {
  id: string;
  name: string;
}
interface EmpRow {
  id: string;
  department_id: string;
  jabatan: string;
  name: string;
  is_head: boolean;
}

const memDepts = new Map<string, DeptRow>();
const memEmps = new Map<string, EmpRow>();

export async function getOrgExtra(): Promise<OrgExtra> {
  if (!dbEnabled) {
    return {
      departments: [...memDepts.values()].map((d) => ({ id: d.id, name: d.name })),
      employees: [...memEmps.values()].map((e) => ({
        id: e.id,
        departmentId: e.department_id,
        jabatan: e.jabatan,
        name: e.name,
        isHead: e.is_head,
      })),
    };
  }
  const [d, e] = await Promise.all([
    db().from("org_departments").select("id,name"),
    db().from("org_employees").select("id,department_id,jabatan,name,is_head"),
  ]);
  return {
    departments: ((d.data ?? []) as DeptRow[]).map((r) => ({ id: r.id, name: r.name })),
    employees: ((e.data ?? []) as EmpRow[]).map((r) => ({
      id: r.id,
      departmentId: r.department_id,
      jabatan: r.jabatan,
      name: r.name,
      isHead: r.is_head,
    })),
  };
}

export async function addOrgDepartment(name: string): Promise<{ id: string }> {
  const id = orgDepartmentId(name);
  if (!dbEnabled) {
    memDepts.set(id, { id, name });
    return { id };
  }
  await db().from("org_departments").upsert({ id, name });
  return { id };
}

export async function addOrgEmployee(input: {
  departmentId: string;
  jabatan: string;
  name: string;
  isHead: boolean;
}): Promise<{ id: string }> {
  const id = `${input.departmentId}__pos_${slug(input.jabatan)}__emp_${slug(input.name)}_${randomUUID().slice(0, 6)}`;
  const row = { id, department_id: input.departmentId, jabatan: input.jabatan, name: input.name, is_head: input.isHead };
  if (!dbEnabled) {
    memEmps.set(id, row);
    return { id };
  }
  await db().from("org_employees").insert(row);
  return { id };
}

export async function deleteOrgDepartment(id: string): Promise<void> {
  if (!dbEnabled) {
    memDepts.delete(id);
    for (const [k, e] of memEmps) if (e.department_id === id) memEmps.delete(k);
    return;
  }
  await db().from("org_employees").delete().eq("department_id", id);
  await db().from("org_departments").delete().eq("id", id);
}

export async function deleteOrgEmployee(id: string): Promise<void> {
  if (!dbEnabled) {
    memEmps.delete(id);
    return;
  }
  await db().from("org_employees").delete().eq("id", id);
}

/** Stable org-employee id mirrored from a user account. */
const userEmpId = (userId: string) => `emp_usr_${userId}`;

/**
 * Mirror a user account into the assessment org so its name shows in the
 * Departemen → Jabatan → Nama picker. Idempotent (keyed by user id). When the
 * account has no department/jabatan, any prior mirror is removed instead.
 */
export async function syncUserEmployee(input: {
  userId: string;
  department: string | null;
  jabatan: string | null;
  name: string;
  isHead: boolean;
}): Promise<void> {
  const id = userEmpId(input.userId);
  if (!input.department || !input.jabatan) {
    await deleteOrgEmployee(id);
    return;
  }
  const departmentId = orgDepartmentId(input.department);
  const row = { id, department_id: departmentId, jabatan: input.jabatan, name: input.name, is_head: input.isHead };
  if (!dbEnabled) {
    memDepts.set(departmentId, { id: departmentId, name: input.department });
    memEmps.set(id, row);
    return;
  }
  // Ensure the department exists (nice name for non-built-in departments), then
  // upsert the employee so repeated saves don't duplicate.
  await db().from("org_departments").upsert({ id: departmentId, name: input.department });
  await db().from("org_employees").upsert(row);
}

/** Remove a user's mirrored org-employee (on account delete). */
export async function unsyncUserEmployee(userId: string): Promise<void> {
  await deleteOrgEmployee(userEmpId(userId));
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "dan")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
