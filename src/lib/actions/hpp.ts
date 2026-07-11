"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { deleteHpp, getHpp, saveHpp, setHppStatus, updateHppCalc, type HppDraft } from "@/lib/data/hpp";
import { saveNotification } from "@/lib/data/persist";
import { canUseHpp as allowed, canVerifyHpp as canVerify } from "@/lib/hpp/access";
import { calcHpp, priceTiers, wasteCost, BRANDS, type Brand, type VariableItem } from "@/lib/hpp/calc";

export type MenuImportRow = {
  id?: string;
  name: string;
  brand: string;
  category: string;
  wastePct: number;
  btkl: number;
  targetSales: number;
  chosenPrice: number; // 0 = auto (standar tier)
  variables: { name: string; takaran: number; takaranUnit: string; buyPrice: number; buyQty: number; buyUnit: string }[];
};

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
  // Signal tim F&B (surfaced in the topbar bell for F&B / admin only).
  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "hpp_review",
    title: "Menu HPP menunggu verifikasi",
    message: `${rec.name} (${rec.brand}) diajukan oleh ${user.name} — perlu diverifikasi tim F&B.`,
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
  for (const id of ids) {
    const rec = await getHpp(id);
    if (!rec || (rec.status !== "draft" && rec.status !== "rejected")) continue;
    await setHppStatus(id, "submitted", null, null);
    n++;
  }
  if (n > 0) {
    await saveNotification({
      id: `ntf_${randomUUID()}`,
      kind: "hpp_review",
      title: "Menu HPP menunggu verifikasi",
      message: `${n} menu diajukan oleh ${user.name} — perlu diverifikasi tim F&B.`,
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

/** Excel import of menus: recompute HPP from the recipe and upsert (rows with a
 *  known id update that menu; others create a new draft). */
export async function importMenusAction(rows: MenuImportRow[]) {
  const user = await getSessionUser();
  if (!allowed(user)) return { error: "Not authorized" };
  const valid = rows.filter((r) => r.name.trim());
  if (valid.length === 0) return { error: "Tidak ada menu valid untuk diimpor." };
  let created = 0;
  let updated = 0;
  for (const r of valid) {
    const brand = (BRANDS as string[]).includes(r.brand) ? r.brand : "Nordu";
    const category = r.category === "makanan" ? "makanan" : "minuman";
    const targetSales = r.targetSales || 1000;
    const variables: VariableItem[] = r.variables
      .filter((v) => v.name.trim())
      .map((v) => ({ id: `var_${randomUUID().slice(0, 8)}`, name: v.name.trim(), takaran: v.takaran || 0, takaranUnit: v.takaranUnit || "g", buyPrice: v.buyPrice || 0, buyQty: v.buyQty || 1, buyUnit: v.buyUnit || "kg" }));
    const fixedForCalc = r.btkl > 0 ? [{ id: "__btkl", name: "BTKL", monthly: r.btkl }] : [];
    const base = calcHpp({ variables, fixed: fixedForCalc, allocMode: "product", targetSales });
    const waste = wasteCost(base.variableCost, r.wastePct);
    const variableCost = base.variableCost + waste;
    const hpp = variableCost + base.fixedAlloc;
    const chosenPrice = r.chosenPrice > 0 ? r.chosenPrice : priceTiers(hpp, brand as Brand)[1]?.price ?? 0;
    const draft: HppDraft = {
      name: r.name.trim(), imageUrl: null, category, brand, mode: "per_pcs", allocMode: "product", targetSales,
      wastePct: r.wastePct || 0, btkl: r.btkl || 0, useClass: false, variables, fixed: [], chosenPrice,
      targetProfit: 10_000_000, variableCost, hpp, createdBy: user.id,
    };
    if (r.id) {
      const existing = await getHpp(r.id);
      if (existing) { await updateHppCalc(r.id, draft); updated++; continue; }
    }
    await saveHpp(draft);
    created++;
  }
  revalidateHpp();
  return { ok: true, count: created + updated, created, updated };
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
      targetUser: rec.createdBy,
      severity: decision === "verified" ? "info" : "warning",
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
  revalidateHpp();
  return { ok: true };
}
