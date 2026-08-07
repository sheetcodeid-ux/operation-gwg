import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { PNL_COLS, type PnlRow } from "@/lib/ops/categories";

/** Laba Rugi per outlet per bulan — diunggah Operation, seperti Beban Operasional. */

const mem = new Map<string, PnlRow>(); // key: month|code

export async function listPnl(month: string): Promise<PnlRow[]> {
  if (!dbEnabled) return [...mem.entries()].filter(([k]) => k.startsWith(`${month}|`)).map(([, v]) => v);
  const rows = await selectAll<Record<string, unknown>>("op_pnl", (a, b) =>
    db().from("op_pnl").select("*").eq("month", month).order("outlet_code").range(a, b),
  );
  return rows.map((r) => {
    const row = { outletCode: String(r.outlet_code), outletName: String(r.outlet_name ?? "") } as PnlRow;
    for (const c of PNL_COLS) row[c] = Number(r[c]) || 0;
    return row;
  });
}

export async function upsertPnl(month: string, rows: PnlRow[]): Promise<number> {
  const clean = rows.filter((r) => r.outletCode.trim());
  if (!dbEnabled) {
    for (const r of clean) mem.set(`${month}|${r.outletCode}`, r);
    return clean.length;
  }
  const payload = clean.map((r) => {
    const o: Record<string, unknown> = {
      month,
      outlet_code: r.outletCode,
      outlet_name: r.outletName,
      updated_at: new Date().toISOString(),
    };
    for (const c of PNL_COLS) o[c] = r[c] || 0;
    return o;
  });
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await db().from("op_pnl").upsert(payload.slice(i, i + 500), { onConflict: "month,outlet_code" });
    if (error) throw new Error(`gagal simpan laba rugi: ${error.message}`);
  }
  return clean.length;
}
