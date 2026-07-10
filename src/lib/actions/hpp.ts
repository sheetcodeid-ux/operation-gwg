"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { deleteHpp, saveHpp, type HppDraft } from "@/lib/data/hpp";
import type { UserProfile } from "@/lib/types";

/** Anyone who can open the HPP menu (R&D roles, admin, grants, R&D dept members). */
function allowed(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return canOpenMenu(user.role, "hpp", user.grants) || user.department === "R&D" || user.department === "Food & Beverage";
}

export async function saveHppAction(input: HppDraft) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  if (!input.name.trim()) return { error: "Nama produk wajib diisi." };
  const rec = await saveHpp({ ...input, name: input.name.trim(), createdBy: user.id });
  revalidatePath("/rnd/hpp");
  return { ok: true, id: rec.id };
}

export async function deleteHppAction(id: string) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  await deleteHpp(id);
  revalidatePath("/rnd/hpp");
  return { ok: true };
}
