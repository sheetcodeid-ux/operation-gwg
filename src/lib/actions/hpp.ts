"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { deleteHpp, getHpp, saveHpp, setHppStatus, type HppDraft } from "@/lib/data/hpp";
import type { UserProfile } from "@/lib/types";

/** Anyone who can open the HPP menu (R&D roles, admin, grants, R&D dept members). */
function allowed(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return canOpenMenu(user.role, "hpp", user.grants) || user.department === "R&D" || user.department === "Food & Beverage";
}

/** Who may verify/reject a calculation: tim F&B or Super Admin (per makalah). */
function canVerify(user: UserProfile | null): user is UserProfile {
  if (!user) return false;
  return user.role === "super_admin" || user.department === "Food & Beverage";
}

function revalidateHpp() {
  revalidatePath("/rnd/hpp");
  revalidatePath("/rnd/hpp/rekap");
}

export async function saveHppAction(input: HppDraft) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  if (!input.name.trim()) return { error: "Nama produk wajib diisi." };
  const rec = await saveHpp({ ...input, name: input.name.trim(), createdBy: user.id });
  revalidateHpp();
  return { ok: true, id: rec.id };
}

export async function deleteHppAction(id: string) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  await deleteHpp(id);
  revalidateHpp();
  return { ok: true };
}

/** R&D submits a draft for F&B review. */
export async function submitHppAction(id: string) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  const rec = await getHpp(id);
  if (!rec) return { error: "Data tidak ditemukan." };
  await setHppStatus(id, "submitted", null, null);
  revalidateHpp();
  return { ok: true };
}

/** Tim F&B verifies or rejects a submitted calculation. */
export async function reviewHppAction(id: string, decision: "verified" | "rejected", note: string) {
  const user = await getSessionUser();
  if (!canVerify(user)) return { error: "Hanya tim F&B / Admin yang boleh memverifikasi." };
  const rec = await getHpp(id);
  if (!rec) return { error: "Data tidak ditemukan." };
  if (decision === "rejected" && !note.trim()) return { error: "Beri catatan alasan penolakan." };
  await setHppStatus(id, decision, user.id, note.trim() || null);
  revalidateHpp();
  return { ok: true };
}
