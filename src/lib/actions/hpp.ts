"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { deleteHpp, getHpp, saveHpp, setHppStatus, type HppDraft } from "@/lib/data/hpp";
import { saveNotification } from "@/lib/data/persist";
import { canUseHpp as allowed, canVerifyHpp as canVerify } from "@/lib/hpp/access";

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
  // Keputusan Final #10 (MoM Juni 2026): database + foto produk WAJIB untuk
  // identifikasi & verifikasi tim F&B — tanpa foto tidak bisa diajukan.
  if (!rec.imageUrl) return { error: `Foto produk wajib disertakan sebelum diajukan (Keputusan Final #10). Edit "${rec.name}" dan tambahkan foto.` };
  await setHppStatus(id, "submitted", null, null);
  // Signal tim F&B (surfaced in the topbar bell for F&B / admin only).
  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "hpp_review",
    title: "Menu HPP menunggu verifikasi",
    message: `${rec.name} (${rec.brand}) diajukan oleh ${user.name} — perlu diverifikasi tim F&B.`,
    href: "/rnd/hpp/rekap",
    severity: "info",
    read: false,
    createdAt: new Date().toISOString(),
  });
  revalidateHpp();
  return { ok: true };
}

/** Bulk submit drafts/rejected menus for F&B review (one aggregated notice). */
export async function bulkSubmitHppAction(ids: string[]) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  let n = 0;
  let skippedNoPhoto = 0;
  for (const id of ids) {
    const rec = await getHpp(id);
    if (!rec || (rec.status !== "draft" && rec.status !== "rejected")) continue;
    // Keputusan Final #10: foto produk wajib — lewati yang belum berfoto.
    if (!rec.imageUrl) {
      skippedNoPhoto++;
      continue;
    }
    await setHppStatus(id, "submitted", null, null);
    n++;
  }
  if (n === 0 && skippedNoPhoto > 0) {
    return { error: `${skippedNoPhoto} menu belum punya foto produk — foto wajib sebelum diajukan (Keputusan Final #10).` };
  }
  if (n > 0) {
    await saveNotification({
      id: `ntf_${randomUUID()}`,
      kind: "hpp_review",
      title: "Menu HPP menunggu verifikasi",
      message: `${n} menu diajukan oleh ${user.name} — perlu diverifikasi tim F&B.`,
      href: "/rnd/hpp/rekap",
      severity: "info",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
  revalidateHpp();
  return { ok: true, count: n };
}

/** Bulk verify/reject submitted menus (notifies each author). */
export async function bulkReviewHppAction(ids: string[], decision: "verified" | "rejected", note: string) {
  const user = await getSessionUser();
  if (!canVerify(user)) return { error: "Hanya tim F&B / Admin yang boleh memverifikasi." };
  if (decision === "rejected" && !note.trim()) return { error: "Beri catatan alasan penolakan." };
  let n = 0;
  for (const id of ids) {
    const rec = await getHpp(id);
    if (!rec || rec.status !== "submitted") continue;
    await setHppStatus(id, decision, user.id, note.trim() || null);
    if (rec.createdBy) {
      await saveNotification({
        id: `ntf_${randomUUID()}`,
        kind: "hpp_review",
        title: decision === "verified" ? "Menu HPP diverifikasi" : "Menu HPP ditolak",
        message:
          decision === "verified"
            ? `${rec.name} (${rec.brand}) telah diverifikasi tim F&B.`
            : `${rec.name} (${rec.brand}) ditolak tim F&B: ${note.trim()}`,
        href: "/rnd/hpp/rekap",
        targetUser: rec.createdBy,
        severity: decision === "verified" ? "info" : "warning",
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    n++;
  }
  revalidateHpp();
  return { ok: true, count: n };
}

/** Bulk delete menus. */
export async function bulkDeleteHppAction(ids: string[]) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  for (const id of ids) await deleteHpp(id);
  revalidateHpp();
  return { ok: true, count: ids.length };
}

/** Tim F&B verifies or rejects a submitted calculation. */
export async function reviewHppAction(id: string, decision: "verified" | "rejected", note: string) {
  const user = await getSessionUser();
  if (!canVerify(user)) return { error: "Hanya tim F&B / Admin yang boleh memverifikasi." };
  const rec = await getHpp(id);
  if (!rec) return { error: "Data tidak ditemukan." };
  if (decision === "rejected" && !note.trim()) return { error: "Beri catatan alasan penolakan." };
  await setHppStatus(id, decision, user.id, note.trim() || null);
  // Notify the R&D author directly (topbar bell) of the review outcome.
  if (rec.createdBy) {
    await saveNotification({
      id: `ntf_${randomUUID()}`,
      kind: "hpp_review",
      title: decision === "verified" ? "Menu HPP diverifikasi" : "Menu HPP ditolak",
      message:
        decision === "verified"
          ? `${rec.name} (${rec.brand}) telah diverifikasi tim F&B.`
          : `${rec.name} (${rec.brand}) ditolak tim F&B: ${note.trim()}`,
      href: "/rnd/hpp/rekap",
      targetUser: rec.createdBy,
      severity: decision === "verified" ? "info" : "warning",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
  revalidateHpp();
  return { ok: true };
}

/** Manually trigger an ESB menu-catalog sync (verifier only). Used by the
 *  Referensi Harga & HPP page's refresh button; the cron also runs it. */
export async function syncEsbMenuAction() {
  const user = await getSessionUser();
  if (!canVerify(user)) return { error: "Hanya Head R&D / Admin yang dapat menyinkron katalog ESB." };
  try {
    const { syncEsbMenus } = await import("@/lib/data/esb-menu");
    const res = await syncEsbMenus();
    revalidateHpp();
    return { ok: true, ...res };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal sinkron katalog ESB." };
  }
}
