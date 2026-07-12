import "server-only";

import { db, dbEnabled } from "./db";
import { areaName, getOutlets } from "./store";
import { EXPENSE_COLS, expenseTotal, type ExpenseRow, type PurchaseRow } from "@/lib/ops/categories";

export { EXPENSE_COLS, EXPENSE_LABELS, expenseTotal } from "@/lib/ops/categories";
export type { ExpenseCol, ExpenseRow, PurchaseRow } from "@/lib/ops/categories";

export interface OutletLite { code: string; name: string; area: string }
export function listOpOutlets(): OutletLite[] {
  return getOutlets()
    .filter((o) => o.active)
    .map((o) => ({ code: o.code, name: o.name, area: areaName(o.areaId) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const memE = new Map<string, ExpenseRow>(); // key month|code
const memP = new Map<string, PurchaseRow>();

/* ---------------- expenses ---------------- */
export async function listExpenses(month: string): Promise<ExpenseRow[]> {
  if (!dbEnabled) return [...memE.entries()].filter(([k]) => k.startsWith(`${month}|`)).map(([, v]) => v);
  const { data } = await db().from("op_expenses").select("*").eq("month", month).limit(2000);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const row = { outletCode: String(r.outlet_code), outletName: String(r.outlet_name ?? "") } as ExpenseRow;
    for (const c of EXPENSE_COLS) row[c] = Number(r[c]) || 0;
    return row;
  });
}

export async function upsertExpenses(month: string, rows: ExpenseRow[]): Promise<number> {
  const clean = rows.filter((r) => r.outletCode.trim());
  if (!dbEnabled) {
    for (const r of clean) memE.set(`${month}|${r.outletCode}`, r);
    return clean.length;
  }
  const payload = clean.map((r) => {
    const o: Record<string, unknown> = { month, outlet_code: r.outletCode, outlet_name: r.outletName, updated_at: new Date().toISOString() };
    for (const c of EXPENSE_COLS) o[c] = r[c] || 0;
    return o;
  });
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await db().from("op_expenses").upsert(payload.slice(i, i + 500), { onConflict: "month,outlet_code" });
    if (error) throw new Error(`gagal simpan beban: ${error.message}`);
  }
  return clean.length;
}

/* ---------------- purchases ---------------- */
export async function listPurchases(month: string): Promise<PurchaseRow[]> {
  if (!dbEnabled) return [...memP.entries()].filter(([k]) => k.startsWith(`${month}|`)).map(([, v]) => v);
  const { data } = await db().from("op_purchases").select("*").eq("month", month).limit(2000);
  return (data ?? []).map((r: Record<string, unknown>) => ({ outletCode: String(r.outlet_code), outletName: String(r.outlet_name ?? ""), warehouse: Number(r.warehouse) || 0, nonWarehouse: Number(r.non_warehouse) || 0 }));
}

export async function upsertPurchases(month: string, rows: PurchaseRow[]): Promise<number> {
  const clean = rows.filter((r) => r.outletCode.trim());
  if (!dbEnabled) {
    for (const r of clean) memP.set(`${month}|${r.outletCode}`, r);
    return clean.length;
  }
  const payload = clean.map((r) => ({ month, outlet_code: r.outletCode, outlet_name: r.outletName, warehouse: r.warehouse || 0, non_warehouse: r.nonWarehouse || 0, updated_at: new Date().toISOString() }));
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await db().from("op_purchases").upsert(payload.slice(i, i + 500), { onConflict: "month,outlet_code" });
    if (error) throw new Error(`gagal simpan pembelian: ${error.message}`);
  }
  return clean.length;
}

/* ---------------- dashboard aggregates ---------------- */
export async function sumExpenses(month: string): Promise<number> {
  return (await listExpenses(month)).reduce((a, r) => a + expenseTotal(r), 0);
}
export async function sumPurchases(month: string): Promise<{ warehouse: number; nonWarehouse: number; total: number }> {
  const rows = await listPurchases(month);
  const warehouse = rows.reduce((a, r) => a + r.warehouse, 0);
  const nonWarehouse = rows.reduce((a, r) => a + r.nonWarehouse, 0);
  return { warehouse, nonWarehouse, total: warehouse + nonWarehouse };
}
