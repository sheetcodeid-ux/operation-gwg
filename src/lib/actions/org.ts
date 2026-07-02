"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { createArea, createOutlet } from "@/lib/data/mutations";

export async function createAreaAction(input: { name: string; code: string; coordinatorId: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_org")) return { error: "No permission" };
  if (!input.name.trim() || !input.code.trim()) return { error: "Nama dan kode wilayah wajib diisi." };
  createArea({ name: input.name.trim(), code: input.code.trim().toUpperCase(), coordinatorId: input.coordinatorId || user.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createOutletAction(input: { name: string; code: string; city: string; areaId: string; picId: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_org")) return { error: "No permission" };
  if (!input.name.trim() || !input.areaId) return { error: "Nama outlet dan wilayah wajib diisi." };
  createOutlet({
    name: input.name.trim(),
    code: input.code.trim().toUpperCase() || input.name.trim().slice(0, 6).toUpperCase(),
    city: input.city.trim() || "-",
    areaId: input.areaId,
    picId: input.picId || user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
