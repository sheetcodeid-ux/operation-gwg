import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";

/** One menu's monthly performance (name, category, qty sold, amount). Sourced
 *  from the ESB Sales Menu Recap. */
export interface MenuPerformanceRow {
  menuName: string;
  categoryName: string | null;
  category: string | null;
  qty: number;
  amount: number;
  volume: string | null;
  omzet: string | null;
  keterangan: string | null;
}

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
  // Diurutkan per menu_name (kunci utama bersama month) supaya paginasi stabil;
  // urutan qty dipakai di memori, karena mengurutkan pakai kolom tidak unik
  // membuat baris bergeser antar halaman dan sebagian menu hilang.
  const rows = await selectAll<Record<string, unknown>>("hpp_sales", (a, b) =>
    db().from("hpp_sales").select("*").eq("month", month).order("menu_name").range(a, b),
  );
  return rows.map(fromRow).sort((x, y) => y.qty - x.qty);
}

/** Most recent month that has synced sales (YYYY-MM), or null. */
export async function latestSalesMonth(): Promise<string | null> {
  if (!dbEnabled) return [...mem.values()].map((s) => s.month).sort().pop() ?? null;
  const { data } = await db().from("hpp_sales").select("month").order("month", { ascending: false }).limit(1);
  return data?.[0]?.month ?? null;
}

/** Replace a month's sales with a fresh sync.
 *  The ERP may list the same menu name more than once (e.g. across categories),
 *  so we aggregate by name (summing qty & omzet) before saving — the table PK is
 *  (month, menu_name), and a duplicate would otherwise reject the whole insert. */
export async function saveSales(month: string, rows: MenuPerformanceRow[], syncedAt: string): Promise<number> {
  const agg = new Map<string, SalesRow>();
  for (const r of rows) {
    const menuName = r.menuName.trim();
    if (!menuName) continue;
    const key = menuName.toLowerCase();
    const ex = agg.get(key);
    if (ex) {
      ex.qty += r.qty;
      ex.amount += r.amount;
    } else {
      agg.set(key, { month, menuName, categoryName: r.categoryName, category: r.category, qty: r.qty, amount: r.amount, volume: r.volume, omzet: r.omzet, keterangan: r.keterangan, syncedAt });
    }
  }
  const mapped = [...agg.values()];

  if (!dbEnabled) {
    for (const [k, v] of mem) if (v.month === month) mem.delete(k);
    for (const r of mapped) mem.set(`${month}|${r.menuName}`, r);
    return mapped.length;
  }

  await db().from("hpp_sales").delete().eq("month", month);
  // Chunked upsert so a large month can't hit payload limits; surface real errors.
  for (let i = 0; i < mapped.length; i += 500) {
    const chunk = mapped.slice(i, i + 500).map(toRow);
    const { error } = await db().from("hpp_sales").upsert(chunk, { onConflict: "month,menu_name" });
    if (error) throw new Error(`gagal menyimpan penjualan: ${error.message}`);
  }
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
