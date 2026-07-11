import "server-only";

import { db, dbEnabled } from "./db";
import type { MenuPerformanceRow } from "@/lib/integrations/gwgmanage";

export interface SalesRow {
  month: string;
  menuName: string;
  categoryName: string | null;
  category: string | null;
  qty: number;
  amount: number;
  volume: string | null;
  omzet: string | null;
  keterangan: string | null;
  syncedAt: string;
}

const mem = new Map<string, SalesRow>(); // key: month|menuName

export async function listSales(month: string): Promise<SalesRow[]> {
  if (!dbEnabled) return [...mem.values()].filter((s) => s.month === month);
  const { data } = await db().from("hpp_sales").select("*").eq("month", month).order("qty", { ascending: false }).limit(1000);
  return (data ?? []).map(fromRow);
}

/** Most recent month that has synced sales (YYYY-MM), or null. */
export async function latestSalesMonth(): Promise<string | null> {
  if (!dbEnabled) return [...mem.values()].map((s) => s.month).sort().pop() ?? null;
  const { data } = await db().from("hpp_sales").select("month").order("month", { ascending: false }).limit(1);
  return data?.[0]?.month ?? null;
}

/** Replace a month's sales with a fresh sync. */
export async function saveSales(month: string, rows: MenuPerformanceRow[], syncedAt: string): Promise<number> {
  const mapped: SalesRow[] = rows
    .filter((r) => r.menuName.trim())
    .map((r) => ({ month, menuName: r.menuName.trim(), categoryName: r.categoryName, category: r.category, qty: r.qty, amount: r.amount, volume: r.volume, omzet: r.omzet, keterangan: r.keterangan, syncedAt }));
  if (!dbEnabled) {
    for (const [k, v] of mem) if (v.month === month) mem.delete(k);
    for (const r of mapped) mem.set(`${month}|${r.menuName}`, r);
    return mapped.length;
  }
  await db().from("hpp_sales").delete().eq("month", month);
  if (mapped.length) await db().from("hpp_sales").insert(mapped.map(toRow));
  return mapped.length;
}

const toRow = (r: SalesRow) => ({
  month: r.month,
  menu_name: r.menuName,
  category_name: r.categoryName,
  category: r.category,
  qty: r.qty,
  amount: r.amount,
  volume: r.volume,
  omzet: r.omzet,
  keterangan: r.keterangan,
  synced_at: r.syncedAt,
});

const fromRow = (r: Record<string, unknown>): SalesRow => ({
  month: String(r.month),
  menuName: String(r.menu_name),
  categoryName: (r.category_name as string) ?? null,
  category: (r.category as string) ?? null,
  qty: Number(r.qty) || 0,
  amount: Number(r.amount) || 0,
  volume: (r.volume as string) ?? null,
  omzet: (r.omzet as string) ?? null,
  keterangan: (r.keterangan as string) ?? null,
  syncedAt: String(r.synced_at),
});
