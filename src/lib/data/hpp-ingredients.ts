import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";

export interface HppIngredient {
  id: string;
  name: string;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  region: string | null;
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
  region: string | null;
};

const mem = new Map<string, HppIngredient>();

/** Per-unit price (Rp per base buy-unit) — used for fair >5% comparison. */
const perUnit = (i: { buyPrice: number; buyQty: number }) => (i.buyQty ? i.buyPrice / i.buyQty : i.buyPrice);

export async function listIngredients(): Promise<HppIngredient[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => a.name.localeCompare(b.name));
  const { data } = await db().from("hpp_ingredients").select("*").order("name", { ascending: true }).limit(500);
  return (data ?? []).map(fromRow);
}

/** Create or update an ingredient; flags `alert` when the unit price jumps >5%. */
export async function upsertIngredient(input: IngredientDraft, userId: string | null): Promise<{ rec: HppIngredient; priceJump: boolean }> {
  const existing = input.id ? (dbEnabled ? await getById(input.id) : mem.get(input.id) ?? null) : null;
  const priceJump = !!existing && perUnit(input) > perUnit(existing) * 1.05;
  const rec: HppIngredient = {
    id: input.id ?? `ing_${randomUUID()}`,
    name: input.name,
    buyPrice: input.buyPrice,
    buyQty: input.buyQty || 1,
    buyUnit: input.buyUnit,
    region: input.region,
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
  region: r.region,
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
  region: string | null;
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
  region: r.region,
  prevPrice: r.prev_price == null ? null : Number(r.prev_price),
  alert: r.alert ?? false,
  updatedBy: r.updated_by,
  updatedAt: r.updated_at,
});
