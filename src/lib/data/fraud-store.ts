import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import type { CancelDetailRow } from "@/lib/integrations/esb";

/**
 * DB cache of ESB fraud line-items (tables `fraud_orders` + `fraud_sync`).
 *
 * Reports read from here instantly; days are synced from ESB one at a time
 * (on demand + daily cron) and marked in `fraud_sync`, so a period switch
 * never re-downloads history — only missing/stale days are fetched.
 *
 * kind groups: 'cv' = the Cancel/Void export (serves all/void/cancel views),
 * 'delete' = the Delete Order export.
 */

export type FraudKindGroup = "cv" | "delete";

export interface StoredFraudRow {
  day: string; // YYYY-MM-DD bucket the row was synced under
  branch: string;
  salesNumber: string;
  menu: string;
  menuCategory: string;
  orderBy: string;
  orderTime: string;
  voidBy: string;
  voidTime: string;
  type: string;
  notes: string;
  qty: number;
  subtotal: number; // ESB's recap basis — aggregates use subtotal || total
  total: number;
}

export interface FraudSyncState {
  day: string;
  totalItems: number;
  rowsRead: number;
  complete: boolean;
  syncedAt: string; // ISO
}

export const fraudStoreEnabled = () => dbEnabled;

interface OrderRow {
  day: string;
  branch: string;
  sales_number: string;
  menu: string;
  menu_category: string;
  order_by: string;
  order_time: string;
  void_by: string;
  void_time: string;
  type: string;
  notes: string;
  qty: number | string;
  subtotal: number | string;
  total: number | string;
}

/* ------------------------------------------------------------------ */
/* In-database aggregation (fast path)                                 */
/* The Postgres functions fraud_agg / fraud_top_orders sum the 140k-row */
/* table server-side so a monthly report ships a few hundred pre-summed */
/* rows instead of tens of thousands. Rules mirror the JS aggregator.  */
/* ------------------------------------------------------------------ */

export interface FraudAggBucket { branch: string; d: string; isVoid: boolean; cnt: number; amount: number }
export interface FraudAggHour { branch: string; hour: string; cnt: number; amount: number }
export interface FraudAggActor { name: string; count: number; total: number }
export interface FraudAggResult { branchDay: FraudAggBucket[]; hours: FraudAggHour[]; actors: FraudAggActor[] }
export interface FraudTopOrderRow {
  branch: string; sales_number: string; menu: string; menu_category: string; order_by: string;
  order_time: string; void_by: string; void_time: string; type: string; notes: string;
  qty: number | string; amount: number | string;
}

/** Per-branch/day (and per-hour when daily) + actor sums, computed in the DB. */
export async function fraudAgg(group: FraudKindGroup, from: string, to: string, kind: string, daily: boolean): Promise<FraudAggResult> {
  const { data, error } = await db().rpc("fraud_agg", { p_group: group, p_from: from, p_to: to, p_kind: kind, p_daily: daily });
  if (error) throw new Error(`DB fraud_agg: ${error.message}`);
  const r = (data ?? {}) as Partial<FraudAggResult>;
  return { branchDay: r.branchDay ?? [], hours: r.hours ?? [], actors: r.actors ?? [] };
}

/** Capped per-branch drill-down (largest orders first), computed in the DB. */
export async function fraudTopOrders(group: FraudKindGroup, from: string, to: string, kind: string, cap: number): Promise<FraudTopOrderRow[]> {
  const { data, error } = await db().rpc("fraud_top_orders", { p_group: group, p_from: from, p_to: to, p_kind: kind, p_cap: cap });
  if (error) throw new Error(`DB fraud_top_orders: ${error.message}`);
  return (data ?? []) as FraudTopOrderRow[];
}

/* ------------------------------------------------------------------ */
/* Report cache — only PAST, fully-synced (final) periods are stored,  */
/* so a re-open is instant and can never be stale.                     */
/* ------------------------------------------------------------------ */

/** Return a cached report only when it was stored as final (immutable). */
export async function getFraudReportCache<T>(key: string): Promise<T | null> {
  const { data, error } = await db().from("fraud_report_cache").select("report,final").eq("key", key).maybeSingle();
  if (error || !data || !data.final) return null;
  return data.report as T;
}

export async function setFraudReportCache(key: string, report: unknown, final: boolean): Promise<void> {
  await db().from("fraud_report_cache").upsert({ key, report, final, computed_at: new Date().toISOString() });
}

const FRAUD_MAX_ROWS = 500_000;

/** All cached rows for [from, to] (paged past supabase's 1000-row cap). */
export async function getFraudRows(kind: FraudKindGroup, from: string, to: string): Promise<StoredFraudRow[]> {
  const rows = await selectAll<OrderRow>("fraud_orders", (a, b) =>
    db()
      .from("fraud_orders")
      .select("day,branch,sales_number,menu,menu_category,order_by,order_time,void_by,void_time,type,notes,qty,subtotal,total")
      .eq("kind", kind)
      .gte("day", from)
      .lte("day", to)
      .order("id", { ascending: true })
      .range(a, b),
    // Tabel terbesar di sistem (ratusan ribu baris); rentang lebar butuh pagar
    // yang lebih longgar daripada bawaan.
    FRAUD_MAX_ROWS,
  );
  return rows.map((r) => ({
    day: r.day,
    branch: r.branch,
    salesNumber: r.sales_number,
    menu: r.menu,
    menuCategory: r.menu_category,
    orderBy: r.order_by,
    orderTime: r.order_time,
    voidBy: r.void_by,
    voidTime: r.void_time,
    type: r.type,
    notes: r.notes,
    qty: Number(r.qty) || 0,
    subtotal: Number(r.subtotal) || 0,
    total: Number(r.total) || 0,
  }));
}

/** Sync bookkeeping for [from, to], keyed by day. */
export async function getSyncStates(kind: FraudKindGroup, from: string, to: string): Promise<Map<string, FraudSyncState>> {
  const { data, error } = await db()
    .from("fraud_sync")
    .select("day,total_items,rows_read,complete,synced_at")
    .eq("kind", kind)
    .gte("day", from)
    .lte("day", to);
  if (error) throw new Error(`DB fraud_sync: ${error.message}`);
  const map = new Map<string, FraudSyncState>();
  for (const r of (data ?? []) as { day: string; total_items: number; rows_read: number; complete: boolean; synced_at: string }[]) {
    map.set(r.day, { day: r.day, totalItems: r.total_items, rowsRead: r.rows_read, complete: r.complete, syncedAt: r.synced_at });
  }
  return map;
}

/** Replace one day's rows atomically-enough (delete → insert chunks) and record
 *  the sync state. `complete` is the CALLER's judgement (e.g. the whole export
 *  was read AND its grand total matched) — rows may legitimately be a filtered
 *  subset of the export. `expectedSubtotal` = the export's own grand total. */
export async function replaceFraudDay(kind: FraudKindGroup, day: string, rows: CancelDetailRow[], totalItems: number, complete: boolean, expectedSubtotal = 0): Promise<void> {
  const del = await db().from("fraud_orders").delete().eq("kind", kind).eq("day", day);
  if (del.error) throw new Error(`DB fraud_orders delete: ${del.error.message}`);
  const payload = rows.map((r) => ({
    kind,
    day,
    branch: r.branch,
    sales_number: r.salesNumber,
    menu: r.menu,
    menu_category: r.menuCategory,
    order_by: r.orderBy,
    order_time: r.orderTime,
    void_by: r.voidBy,
    void_time: r.voidTime,
    type: r.type,
    notes: r.notes,
    qty: r.qty,
    subtotal: r.subtotal,
    total: r.total,
  }));
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const ins = await db().from("fraud_orders").insert(payload.slice(i, i + CHUNK));
    if (ins.error) throw new Error(`DB fraud_orders insert: ${ins.error.message}`);
  }
  const up = await db().from("fraud_sync").upsert({
    kind,
    day,
    total_items: totalItems,
    rows_read: rows.length,
    complete,
    expected_subtotal: expectedSubtotal,
    synced_subtotal: rows.reduce((a, r) => a + (r.subtotal || r.total), 0),
    synced_at: new Date().toISOString(),
  });
  if (up.error) throw new Error(`DB fraud_sync upsert: ${up.error.message}`);

  // Rewriting a PAST day (e.g. an admin backfill) could make a cached final
  // report stale — clear the small report cache so it rebuilds lazily. A
  // current-day sync never touches cached (past-only) reports.
  const todayW = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  if (day < todayW) {
    try { await db().from("fraud_report_cache").delete().neq("key", ""); } catch { /* best-effort */ }
  }
}

/* ------------------------------ Sales (omset) ------------------------------ */

export interface SalesDay { day: string; netSales: number; syncedAt: string }

export async function getSalesDaily(from: string, to: string): Promise<SalesDay[]> {
  const { data, error } = await db().from("sales_daily").select("day,net_sales,synced_at").gte("day", from).lte("day", to);
  if (error) throw new Error(`DB sales_daily: ${error.message}`);
  return ((data ?? []) as { day: string; net_sales: number | string; synced_at: string }[]).map((r) => ({ day: r.day, netSales: Number(r.net_sales) || 0, syncedAt: r.synced_at }));
}

export async function upsertSalesDay(day: string, netSales: number): Promise<void> {
  const { error } = await db().from("sales_daily").upsert({ day, net_sales: netSales, synced_at: new Date().toISOString() });
  if (error) throw new Error(`DB sales_daily upsert: ${error.message}`);
}

export interface SalesPeriodRow { branch: string; netSales: number; syncedAt: string }

export async function getSalesPeriod(from: string, to: string): Promise<SalesPeriodRow[]> {
  const { data, error } = await db().from("sales_period").select("branch,net_sales,synced_at").eq("date_from", from).eq("date_to", to);
  if (error) throw new Error(`DB sales_period: ${error.message}`);
  return ((data ?? []) as { branch: string; net_sales: number | string; synced_at: string }[]).map((r) => ({ branch: r.branch, netSales: Number(r.net_sales) || 0, syncedAt: r.synced_at }));
}

export async function upsertSalesPeriod(from: string, to: string, branch: string, netSales: number): Promise<void> {
  const { error } = await db().from("sales_period").upsert({ branch, date_from: from, date_to: to, net_sales: netSales, synced_at: new Date().toISOString() });
  if (error) throw new Error(`DB sales_period upsert: ${error.message}`);
}
