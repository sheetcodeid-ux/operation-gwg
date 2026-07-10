import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import type { AllocMode, FixedItem, VariableItem } from "@/lib/hpp/calc";

export interface HppRecord {
  id: string;
  name: string;
  imageUrl: string | null;
  mode: string; // per_pcs | per_resep
  allocMode: AllocMode;
  targetSales: number;
  variables: VariableItem[];
  fixed: FixedItem[];
  chosenPrice: number;
  targetProfit: number;
  variableCost: number;
  hpp: number;
  createdBy: string | null;
  createdAt: string;
}

export type HppDraft = Omit<HppRecord, "id" | "createdAt">;

const mem = new Map<string, HppRecord>();

export async function listHpp(): Promise<HppRecord[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await db().from("hpp_calculations").select("*").order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map(fromRow);
}

export async function saveHpp(input: HppDraft): Promise<HppRecord> {
  const rec: HppRecord = { ...input, id: `hpp_${randomUUID()}`, createdAt: new Date().toISOString() };
  if (!dbEnabled) {
    mem.set(rec.id, rec);
    return rec;
  }
  await db().from("hpp_calculations").insert(toRow(rec));
  return rec;
}

export async function deleteHpp(id: string): Promise<void> {
  if (!dbEnabled) {
    mem.delete(id);
    return;
  }
  await db().from("hpp_calculations").delete().eq("id", id);
}

const toRow = (r: HppRecord) => ({
  id: r.id,
  name: r.name,
  image_url: r.imageUrl,
  mode: r.mode,
  alloc_mode: r.allocMode,
  target_sales: r.targetSales,
  variables: r.variables,
  fixed: r.fixed,
  chosen_price: r.chosenPrice,
  target_profit: r.targetProfit,
  variable_cost: r.variableCost,
  hpp: r.hpp,
  created_by: r.createdBy,
  created_at: r.createdAt,
});

interface HppRow {
  id: string;
  name: string;
  image_url: string | null;
  mode: string;
  alloc_mode: AllocMode;
  target_sales: number;
  variables: VariableItem[];
  fixed: FixedItem[];
  chosen_price: number | string;
  target_profit: number | string;
  variable_cost: number | string;
  hpp: number | string;
  created_by: string | null;
  created_at: string;
}

const fromRow = (r: HppRow): HppRecord => ({
  id: r.id,
  name: r.name,
  imageUrl: r.image_url,
  mode: r.mode,
  allocMode: r.alloc_mode,
  targetSales: r.target_sales,
  variables: r.variables ?? [],
  fixed: r.fixed ?? [],
  chosenPrice: Number(r.chosen_price),
  targetProfit: Number(r.target_profit),
  variableCost: Number(r.variable_cost),
  hpp: Number(r.hpp),
  createdBy: r.created_by,
  createdAt: r.created_at,
});
