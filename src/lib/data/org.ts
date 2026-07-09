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

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "dan")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
