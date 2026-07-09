"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { addOrgDepartment, addOrgEmployee, deleteOrgDepartment, deleteOrgEmployee } from "@/lib/data/org";

async function guard() {
  const admin = await getSessionUser();
  return admin && can(admin, "manage_users") ? admin : null;
}

function refresh() {
  revalidatePath("/admin/departments");
  revalidatePath("/assessment");
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
