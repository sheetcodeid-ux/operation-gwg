import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { esbConfigured, esbGenerateMenuRecap, esbReadMenuPages, esbEnsureDeadline } from "@/lib/integrations/esb-client";
import { classifyMenuCategory, type MenuRecapRow } from "@/lib/integrations/esb";
import { getAppConfig, setAppConfig } from "./app-config";

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
    const rows = await selectAll<Row>("esb_menu", (a, b) =>
      db().from("esb_menu").select("*").order("menu", { ascending: true }).range(a, b),
    );
    return rows.map(fromRow);
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

const CURSOR_KEY = "esb_menu_cursor";
interface Cursor { url: string; from: string; to: string; totalItems: number; pageSize: number; nextPage: number; startedAt: string; windowDays: number }

/** Upsert one batch of recap rows into the catalog (aggregating qty per menu
 *  across batches via read-modify-write on the touched menus). */
async function applyRecapRows(rows: MenuRecapRow[], windowDays: number, resetQty: boolean): Promise<number> {
  const agg = new Map<string, { menu: string; code: string; cat: string; detail: string; qty: number; price: number }>();
  for (const r of rows) {
    if (!r.menu) continue;
    const cur = agg.get(r.menu) ?? { menu: r.menu, code: r.menuCode, cat: r.category, detail: r.categoryDetail, qty: 0, price: 0 };
    cur.qty += r.qty;
    if (r.unitPrice > 0) cur.price = r.unitPrice;
    if (!cur.code && r.menuCode) cur.code = r.menuCode;
    agg.set(r.menu, cur);
  }
  if (agg.size === 0) return 0;

  // Read existing qty for these menus (unless this is a fresh export → reset).
  const existing = new Map<string, { qty: number; price: number }>();
  if (!resetQty) {
    const names = [...agg.keys()];
    for (let i = 0; i < names.length; i += 200) {
      const { data } = await db().from("esb_menu").select("menu,qty_30d,unit_price").in("menu", names.slice(i, i + 200));
      for (const r of (data ?? []) as { menu: string; qty_30d: number | string; unit_price: number | string }[]) existing.set(r.menu, { qty: Number(r.qty_30d) || 0, price: Number(r.unit_price) || 0 });
    }
  }

  const nowIso = new Date().toISOString();
  const payload = [...agg.values()].map((m) => {
    const prev = existing.get(m.menu);
    return {
      menu: m.menu,
      menu_code: m.code,
      category: m.cat,
      category_detail: m.detail,
      food_bev: classifyMenuCategory(m.cat, m.detail),
      qty_30d: (prev?.qty ?? 0) + m.qty,
      unit_price: m.price || prev?.price || 0,
      window_days: windowDays,
      synced_at: nowIso,
    };
  });
  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const up = await db().from("esb_menu").upsert(payload.slice(i, i + CHUNK));
    if (up.error) throw new Error(`DB esb_menu upsert: ${up.error.message}`);
  }
  return payload.length;
}

/**
 * Sync the catalog from ESB — RESUMABLE. The menu-recap export is ~2.5k rows
 * (~124 pages of 20) and takes ~45s just to generate, so one invocation can't
 * finish. A cursor (app_config `esb_menu_cursor`) holds the current OSS export
 * URL + next page; each run reads ~as many pages as `budgetMs` allows and
 * advances the cursor. A fresh export is generated when there's no active
 * cursor, it's finished, or it's older than 2h. Fully server-side + hourly cron.
 */
export async function syncEsbMenus(windowDays = 30, budgetMs = 48_000): Promise<{ menus: number; complete?: boolean; nextPage?: number; totalPages?: number; skipped?: string }> {
  if (!dbEnabled || !esbConfigured()) return { menus: 0, skipped: "not configured" };
  const started = Date.now();
  esbEnsureDeadline(budgetMs); // batas waktu ikut berlaku di dalam klien ESB

  let cursor: Cursor | null = null;
  try {
    const raw = await getAppConfig(CURSOR_KEY);
    if (raw) cursor = JSON.parse(raw) as Cursor;
  } catch { cursor = null; }

  const stale = cursor && Date.now() - Date.parse(cursor.startedAt) > 2 * 3_600_000;
  const fresh = !cursor || stale;

  if (fresh) {
    const now = new Date(Date.now() + 7 * 3_600_000); // WIB
    const to = ymd(now);
    const from = ymd(new Date(now.getTime() - (windowDays - 1) * 86_400_000));
    const startedAtIso = new Date().toISOString(); // BEFORE writing rows, so page-0 rows aren't pruned
    const ex = await esbGenerateMenuRecap(from, to); // waits ~45s for generation + reads page 0
    await applyRecapRows(ex.firstRows, windowDays, true); // page 0 resets qty (new export)
    cursor = { url: ex.url, from, to, totalItems: ex.totalItems, pageSize: ex.pageSize, nextPage: 1, startedAt: startedAtIso, windowDays };
    await setAppConfig(CURSOR_KEY, JSON.stringify(cursor));
  }

  const c = cursor!;
  const totalPages = Math.max(1, Math.ceil(c.totalItems / c.pageSize));
  let menusTouched = 0;

  // Read further pages with the remaining budget, advancing the cursor.
  if (c.nextPage < totalPages && Date.now() - started < budgetMs - 4000) {
    const read = await esbReadMenuPages(c.url, c.nextPage, totalPages, budgetMs - (Date.now() - started) - 2000);
    menusTouched = await applyRecapRows(read.rows, c.windowDays, false);
    c.nextPage = read.nextPage;
    await setAppConfig(CURSOR_KEY, JSON.stringify(c));
  }

  const complete = c.nextPage >= totalPages;
  if (complete) {
    // Whole export consumed — prune menus not seen in this pass, then clear the
    // cursor so the next run generates a fresh export.
    await db().from("esb_menu").delete().lt("synced_at", c.startedAt);
    await setAppConfig(CURSOR_KEY, "");
  }
  return { menus: menusTouched, complete, nextPage: c.nextPage, totalPages };
}
