"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { addOrgDepartment, addOrgEmployee, deleteOrgDepartment, deleteOrgEmployee } from "@/lib/data/org";
import { addNavDivision, deleteNavDivision } from "@/lib/data/nav";
import { builtInDivisions } from "@/lib/nav";

async function guard() {
  const admin = await getSessionUser();
  return admin && can(admin, "manage_users") ? admin : null;
}

function refresh() {
  revalidatePath("/admin/departments");
  revalidatePath("/assessment");
}

/** Custom sidebar divisions touch the whole app shell + user grants. */
function refreshNav() {
  revalidatePath("/admin/departments");
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");
}

export async function addDepartmentAction(name: string) {
  if (!(await guard())) return { error: "Not authorized" };
  const clean = name.trim();
  if (clean.length < 2) return { error: "Nama departemen/divisi minimal 2 karakter." };
  await addOrgDepartment(clean);
  refresh();
  return { ok: true };
}

export async function addEmployeeAction(input: { departmentId: string; jabatan: string; name: string; isHead: boolean }) {
  if (!(await guard())) return { error: "Not authorized" };
  if (!input.departmentId) return { error: "Pilih departemen/divisi." };
  if (input.name.trim().length < 2) return { error: "Nama karyawan minimal 2 karakter." };
  await addOrgEmployee({
    departmentId: input.departmentId,
    jabatan: input.jabatan.trim() || "Staff",
    name: input.name.trim(),
    isHead: input.isHead,
  });
  refresh();
  return { ok: true };
}

export async function deleteDepartmentAction(id: string) {
  if (!(await guard())) return { error: "Not authorized" };
  await deleteOrgDepartment(id);
  refresh();
  return { ok: true };
}

export async function deleteEmployeeAction(id: string) {
  if (!(await guard())) return { error: "Not authorized" };
  await deleteOrgEmployee(id);
  refresh();
  return { ok: true };
}

// ── Admin-defined sidebar divisions (grup menu) ────────────────────────────

export async function addDivisionAction(input: { name: string; icon: string; menus: string[] }) {
  if (!(await guard())) return { error: "Not authorized" };
  const name = input.name.trim();
  if (name.length < 2) return { error: "Nama divisi minimal 2 karakter." };
  if (builtInDivisions().includes(name))
    return { error: "Nama itu dipakai divisi bawaan. Gunakan nama lain." };
  if (!input.menus.length) return { error: "Pilih minimal satu menu untuk divisi ini." };
  await addNavDivision({ name, icon: input.icon || "Briefcase", menus: input.menus });
  refreshNav();
  return { ok: true };
}

export async function deleteDivisionAction(id: string) {
  if (!(await guard())) return { error: "Not authorized" };
  await deleteNavDivision(id);
  refreshNav();
  return { ok: true };
}
