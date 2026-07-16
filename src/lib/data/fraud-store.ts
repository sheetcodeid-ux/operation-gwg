import "server-only";

import { db, dbEnabled } from "./db";
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
  total: number | string;
}

/** All cached rows for [from, to] (paged past supabase's 1000-row cap). */
export async function getFraudRows(kind: FraudKindGroup, from: string, to: string): Promise<StoredFraudRow[]> {
  const out: StoredFraudRow[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db()
      .from("fraud_orders")
      .select("day,branch,sales_number,menu,menu_category,order_by,order_time,void_by,void_time,type,notes,qty,total")
      .eq("kind", kind)
      .gte("day", from)
      .lte("day", to)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`DB fraud_orders: ${error.message}`);
    for (const r of (data ?? []) as OrderRow[]) {
      out.push({
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
        total: Number(r.total) || 0,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
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
 *  was read) — rows may legitimately be a filtered subset of the export. */
export async function replaceFraudDay(kind: FraudKindGroup, day: string, rows: CancelDetailRow[], totalItems: number, complete: boolean): Promise<void> {
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
    synced_at: new Date().toISOString(),
  });
  if (up.error) throw new Error(`DB fraud_sync upsert: ${up.error.message}`);
}
