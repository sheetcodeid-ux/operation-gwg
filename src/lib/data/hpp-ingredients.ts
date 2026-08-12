import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { recipeUnits, unitPrice } from "@/lib/hpp/units";
import { asGolongan, type IngredientGolongan } from "@/lib/hpp/golongan";

export { GOLONGAN_LABEL, INGREDIENT_GOLONGAN, asGolongan, type IngredientGolongan } from "@/lib/hpp/golongan";

export interface HppIngredient {
  id: string;
  name: string;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  /**
   * Isi per satuan beli. Barang datang per dus tapi resep memakai pcs: 1 dus
   * Susu UHT = 24 pcs ⇒ contentQty 24, contentUnit "pcs". Barang satuan
   * (1 kg beras) memakai contentQty 1 dan contentUnit = buyUnit.
   */
  contentQty: number;
  /** Satuan yang benar-benar dipakai di resep. */
  contentUnit: string;
  region: string | null;
  /** Pemisah bahan dapur / bar. `general` = dipakai keduanya. */
  golongan: IngredientGolongan;
  prevPrice: number | null;
  alert: boolean; // last change raised the unit price >5%
  updatedBy: string | null;
  updatedAt: string;
}

export type IngredientDraft = {
  id?: string;
  name: string;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  contentQty?: number;
  contentUnit?: string | null;
  region: string | null;
  golongan?: IngredientGolongan;
};

const mem = new Map<string, HppIngredient>();

export { recipeUnits, unitPrice };

export async function listIngredients(): Promise<HppIngredient[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => a.name.localeCompare(b.name));
  // `.limit(500)` dulu memotong daftar tanpa error — dengan 375 bahan dan impor
  // rutin, batas itu tinggal beberapa unggahan lagi.
  const rows = await selectAll<IngredientRow>("hpp_ingredients", (a, b) =>
    db().from("hpp_ingredients").select("*").order("id", { ascending: true }).range(a, b),
  );
  return rows.map(fromRow).sort((x, y) => x.name.localeCompare(y.name));
}

/** Create or update an ingredient; flags `alert` when the unit price jumps >5%. */
export async function upsertIngredient(input: IngredientDraft, userId: string | null): Promise<{ rec: HppIngredient; priceJump: boolean }> {
  const existing = input.id ? (dbEnabled ? await getById(input.id) : mem.get(input.id) ?? null) : null;
  const contentQty = input.contentQty && input.contentQty > 0 ? input.contentQty : 1;
  // Bandingkan harga per satuan PAKAI, bukan per satuan beli: ganti kemasan
  // dari dus isi 24 ke dus isi 12 memang menaikkan harga per pcs, dan itu
  // memang harus memicu alert.
  const priceJump = !!existing && unitPrice({ ...input, contentQty }) > unitPrice(existing) * 1.05;
  const rec: HppIngredient = {
    id: input.id ?? `ing_${randomUUID()}`,
    name: input.name,
    buyPrice: input.buyPrice,
    buyQty: input.buyQty || 1,
    buyUnit: input.buyUnit,
    contentQty,
    contentUnit: (input.contentUnit || "").trim() || input.buyUnit,
    region: input.region,
    // Golongan yang tidak dikirim TIDAK boleh jatuh ke bawaan: mengubah harga
    // lewat impor akan mengembalikan semua bahan ke "general".
    golongan: input.golongan ?? existing?.golongan ?? "general",
    prevPrice: existing ? existing.buyPrice : null,
    alert: priceJump || (existing?.alert ?? false),
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
  if (!dbEnabled) {
    mem.set(rec.id, rec);
    return { rec, priceJump };
  }
  await db().from("hpp_ingredients").upsert(toRow(rec));
  return { rec, priceJump };
}

/** Clear the >5% alert after menus using this ingredient have been reviewed. */
export async function clearIngredientAlert(id: string): Promise<void> {
  if (!dbEnabled) {
    const rec = mem.get(id);
    if (rec) mem.set(id, { ...rec, alert: false });
    return;
  }
  await db().from("hpp_ingredients").update({ alert: false }).eq("id", id);
}

export async function deleteIngredient(id: string): Promise<void> {
  if (!dbEnabled) {
    mem.delete(id);
    return;
  }
  await db().from("hpp_ingredients").delete().eq("id", id);
}

async function getById(id: string): Promise<HppIngredient | null> {
  const { data } = await db().from("hpp_ingredients").select("*").eq("id", id).maybeSingle();
  return data ? fromRow(data as IngredientRow) : null;
}

const toRow = (r: HppIngredient) => ({
  id: r.id,
  name: r.name,
  buy_price: r.buyPrice,
  buy_qty: r.buyQty,
  buy_unit: r.buyUnit,
  content_qty: r.contentQty || 1,
  content_unit: r.contentUnit || r.buyUnit,
  region: r.region,
  golongan: r.golongan,
  prev_price: r.prevPrice,
  alert: r.alert,
  updated_by: r.updatedBy,
  updated_at: r.updatedAt,
});

interface IngredientRow {
  id: string;
  name: string;
  buy_price: number | string;
  buy_qty: number | string;
  buy_unit: string;
  content_qty?: number | string | null;
  content_unit?: string | null;
  region: string | null;
  golongan?: string | null;
  prev_price: number | string | null;
  alert: boolean | null;
  updated_by: string | null;
  updated_at: string;
}

const fromRow = (r: IngredientRow): HppIngredient => ({
  id: r.id,
  name: r.name,
  buyPrice: Number(r.buy_price),
  buyQty: Number(r.buy_qty) || 1,
  buyUnit: r.buy_unit,
  contentQty: Number(r.content_qty) || 1,
  contentUnit: r.content_unit || r.buy_unit,
  region: r.region,
  golongan: asGolongan(r.golongan),
  prevPrice: r.prev_price == null ? null : Number(r.prev_price),
  alert: r.alert ?? false,
  updatedBy: r.updated_by,
  updatedAt: r.updated_at,
});
