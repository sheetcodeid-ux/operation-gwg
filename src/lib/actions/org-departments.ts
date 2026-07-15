"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { persistMessage } from "@/lib/data/persist";
import { deleteUserDepartment, saveUserDepartment } from "@/lib/data/user-departments";

/** Create/replace a User-Management department + its jabatan list. */
export async function saveDepartmentAction(input: { name: string; jabatan: string[] }) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  const name = input.name.trim();
  if (!name) return { error: "Nama departemen wajib diisi." };
  try {
    const { id } = await saveUserDepartment(name, input.jabatan ?? []);
    revalidatePath("/admin/users");
    return { ok: true, id };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function deleteDepartmentAction(id: string) {
  const admin = await getSessionUser();
  if (!admin || !can(admin, "manage_users")) return { error: "Not authorized" };
  try {
    await deleteUserDepartment(id);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
