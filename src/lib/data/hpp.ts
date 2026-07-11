import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import type { AllocMode, FixedItem, VariableItem } from "@/lib/hpp/calc";

export type HppStatus = "draft" | "submitted" | "verified" | "rejected";

export interface HppRecord {
  id: string;
  name: string;
  imageUrl: string | null;
  category: string; // makanan | minuman
  brand: string; // Nordu | Cattu | Busari
  status: HppStatus; // draft → submitted → verified | rejected
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  mode: string; // per_pcs | per_resep
  allocMode: AllocMode;
  targetSales: number;
  wastePct: number; // waste normal ≤5% (GWG policy)
  btkl: number; // Biaya Tenaga Kerja Langsung / bulan (dapur/bar)
  useClass: boolean; // Sistem Class Nordu (+Rp5.000 / class)
  variables: VariableItem[];
  fixed: FixedItem[];
  chosenPrice: number;
  targetProfit: number;
  variableCost: number;
  hpp: number;
  createdBy: string | null;
  createdAt: string;
}

/** New-save payload: everything except server-managed id/createdAt and the
 *  review lifecycle (status/review fields are set server-side, never by client). */
export type HppDraft = Omit<HppRecord, "id" | "createdAt" | "status" | "reviewNote" | "reviewedBy" | "reviewedAt">;

const mem = new Map<string, HppRecord>();

export async function listHpp(): Promise<HppRecord[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await db().from("hpp_calculations").select("*").order("created_at", { ascending: false }).limit(200);
  return (data ?? []).map(fromRow);
}

export async function getHpp(id: string): Promise<HppRecord | null> {
  if (!dbEnabled) return mem.get(id) ?? null;
  const { data } = await db().from("hpp_calculations").select("*").eq("id", id).maybeSingle();
  return data ? fromRow(data as HppRow) : null;
}

export async function saveHpp(input: HppDraft): Promise<HppRecord> {
  const rec: HppRecord = {
    ...input,
    id: `hpp_${randomUUID()}`,
    status: "draft",
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  };
  if (!dbEnabled) {
    mem.set(rec.id, rec);
    return rec;
  }
  await db().from("hpp_calculations").insert(toRow(rec));
  return rec;
}

/** Move a record through the review lifecycle (submit / verify / reject). */
export async function setHppStatus(id: string, status: HppStatus, reviewedBy: string | null, note: string | null): Promise<void> {
  const reviewedAt = status === "verified" || status === "rejected" ? new Date().toISOString() : null;
  if (!dbEnabled) {
    const rec = mem.get(id);
    if (rec) mem.set(id, { ...rec, status, reviewNote: note, reviewedBy: status === "submitted" ? null : reviewedBy, reviewedAt });
    return;
  }
  await db()
    .from("hpp_calculations")
    .update({
      status,
      review_note: note,
      reviewed_by: status === "submitted" ? null : reviewedBy,
      reviewed_at: reviewedAt,
    })
    .eq("id", id);
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
  category: r.category,
  brand: r.brand,
  status: r.status,
  review_note: r.reviewNote,
  reviewed_by: r.reviewedBy,
  reviewed_at: r.reviewedAt,
  mode: r.mode,
  alloc_mode: r.allocMode,
  target_sales: r.targetSales,
  waste_pct: r.wastePct,
  btkl: r.btkl,
  use_class: r.useClass,
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
  category: string | null;
  brand: string | null;
  status: HppStatus | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  mode: string;
  alloc_mode: AllocMode;
  target_sales: number;
  waste_pct: number | string | null;
  btkl: number | string | null;
  use_class: boolean | null;
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
  category: r.category ?? "minuman",
  brand: r.brand ?? "Nordu",
  status: r.status ?? "draft",
  reviewNote: r.review_note,
  reviewedBy: r.reviewed_by,
  reviewedAt: r.reviewed_at,
  mode: r.mode,
  allocMode: r.alloc_mode,
  targetSales: r.target_sales,
  wastePct: r.waste_pct == null ? 5 : Number(r.waste_pct),
  btkl: r.btkl == null ? 0 : Number(r.btkl),
  useClass: r.use_class ?? false,
  variables: r.variables ?? [],
  fixed: r.fixed ?? [],
  chosenPrice: Number(r.chosen_price),
  targetProfit: Number(r.target_profit),
  variableCost: Number(r.variable_cost),
  hpp: Number(r.hpp),
  createdBy: r.created_by,
  createdAt: r.created_at,
});
