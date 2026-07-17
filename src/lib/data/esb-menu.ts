import "server-only";

import { db, dbEnabled } from "./db";
import { esbConfigured, esbFetchMenuRecap } from "@/lib/integrations/esb-client";
import { classifyMenuCategory } from "@/lib/integrations/esb";

/**
 * ESB product catalog (table `esb_menu`), synced from the Sales Menu
 * Recapitulation over a rolling 30-day window: one row per distinct menu with
 * its ESB unit price (pre-tax, HPP-comparable) and total qty sold — the basis
 * for the product picker, target-sales recommendation, and price comparison.
 */
export interface EsbMenu {
  menu: string;
  menuCode: string;
  category: string;
  categoryDetail: string;
  foodBev: "makanan" | "minuman";
  qty30d: number;
  unitPrice: number;
  windowDays: number;
  syncedAt: string;
}

export const esbMenuEnabled = () => dbEnabled;

interface Row {
  menu: string;
  menu_code: string;
  category: string;
  category_detail: string;
  food_bev: string;
  qty_30d: number | string;
  unit_price: number | string;
  window_days: number;
  synced_at: string;
}

const fromRow = (r: Row): EsbMenu => ({
  menu: r.menu,
  menuCode: r.menu_code,
  category: r.category,
  categoryDetail: r.category_detail,
  foodBev: r.food_bev === "minuman" ? "minuman" : "makanan",
  qty30d: Number(r.qty_30d) || 0,
  unitPrice: Number(r.unit_price) || 0,
  windowDays: r.window_days || 30,
  syncedAt: r.synced_at,
});

/** Whole catalog (paged past supabase's 1000-row cap). Never throws. */
export async function listEsbMenus(): Promise<EsbMenu[]> {
  if (!dbEnabled) return [];
  try {
    const out: EsbMenu[] = [];
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await db().from("esb_menu").select("*").order("menu", { ascending: true }).range(off, off + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Row[]) out.push(fromRow(r));
      if (!data || data.length < PAGE) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Most recent sync time (freshness indicator), or null when never synced. */
export async function esbMenuSyncedAt(): Promise<string | null> {
  if (!dbEnabled) return null;
  try {
    const { data } = await db().from("esb_menu").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle();
    return (data as { synced_at: string } | null)?.synced_at ?? null;
  } catch {
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Sync the catalog from ESB over the last `windowDays` (WIB). Aggregates the
 *  recap rows by menu (sum qty, latest non-zero unit price) and replaces the
 *  table. Skips silently when ESB / DB isn't configured. */
export async function syncEsbMenus(windowDays = 30, budgetMs = 48_000): Promise<{ menus: number; complete?: boolean; skipped?: string }> {
  if (!dbEnabled || !esbConfigured()) return { menus: 0, skipped: "not configured" };
  const now = new Date(Date.now() + 7 * 3_600_000); // WIB
  const to = ymd(now);
  const from = ymd(new Date(now.getTime() - (windowDays - 1) * 86_400_000));

  const res = await esbFetchMenuRecap(from, to, budgetMs);
  const agg = new Map<string, EsbMenu>();
  for (const r of res.rows) {
    if (!r.menu) continue;
    const key = r.menu;
    const cur = agg.get(key) ?? {
      menu: r.menu,
      menuCode: r.menuCode,
      category: r.category,
      categoryDetail: r.categoryDetail,
      foodBev: classifyMenuCategory(r.category, r.categoryDetail),
      qty30d: 0,
      unitPrice: 0,
      windowDays,
      syncedAt: new Date().toISOString(),
    };
    cur.qty30d += r.qty;
    if (r.unitPrice > 0) cur.unitPrice = r.unitPrice; // keep the last non-zero price
    if (!cur.menuCode && r.menuCode) cur.menuCode = r.menuCode;
    agg.set(key, cur);
  }

  const rows = [...agg.values()];
  if (rows.length === 0) return { menus: 0 };

  const nowIso = new Date().toISOString();
  const payload = rows.map((m) => ({
    menu: m.menu,
    menu_code: m.menuCode,
    category: m.category,
    category_detail: m.categoryDetail,
    food_bev: m.foodBev,
    qty_30d: m.qty30d,
    unit_price: m.unitPrice,
    window_days: windowDays,
    synced_at: nowIso,
  }));

  // Upsert (not delete-all) so a time-budgeted partial run still makes progress
  // and survives across cron invocations. Only when the FULL export was read do
  // we prune menus that vanished from ESB (rows not touched by this sync).
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const up = await db().from("esb_menu").upsert(payload.slice(i, i + CHUNK));
    if (up.error) throw new Error(`DB esb_menu upsert: ${up.error.message}`);
  }
  if (res.readAll) {
    await db().from("esb_menu").delete().lt("synced_at", nowIso);
  }
  return { menus: rows.length, complete: res.readAll };
}
