import "server-only";

import { db, dbEnabled } from "./db";
import { outletName } from "./store";
import { listSales } from "./hpp-sales";
import { listReviewableEvents } from "./marcomm";
import { esbConfigured, esbListBranches } from "@/lib/integrations/esb-client";
import { verdictOf, windowDays, type EventImpact, type ProductBreakdown, type ReviewableEvent } from "@/lib/marcomm-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Fase B — revenue-impact analysis for approved MarComm events.
 *
 * Method: compare omzet during the measurement window against an equal-length
 * baseline window immediately before it (uplift), then weigh the uplift against
 * the budget (ROI). Outlet events use daily omzet (seasonal_daily, matched to ESB
 * branches by name, else company-wide); promos use the promoted products' monthly
 * sales (hpp_sales) with company-wide daily omzet as context.
 */

const dayMs = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (ymd: string, n: number) => iso(new Date(+new Date(`${ymd}T00:00:00Z`) + n * dayMs));
const ym = (ymd: string) => ymd.slice(0, 7);

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = ym(start).split("-").map(Number);
  const [ey, em] = ym(end).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
    if (out.length > 24) break;
  }
  return out;
}
function monthsBefore(first: string, count: number): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  for (let i = 0; i < count; i++) {
    if (--m < 1) { m = 12; y--; }
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/** Sum of daily gross omzet for a branch ("" = all outlets) over [from, to]. */
async function omzetInRange(branch: string, from: string, to: string): Promise<number> {
  if (!dbEnabled || from > to) return 0;
  const { data } = await db().from("seasonal_daily").select("gross").eq("branch", branch).gte("day", from).lte("day", to);
  return ((data ?? []) as any[]).reduce((s, r) => s + (Number(r.gross) || 0), 0);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** name → ESB branchId, best-effort (empty when ESB isn't configured). */
async function branchMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!esbConfigured()) return map;
  try {
    for (const b of await esbListBranches()) map.set(norm(b.name), b.id);
  } catch {
    /* ignore */
  }
  return map;
}

function matchBranchIds(outletIds: string[], bmap: Map<string, string>): string[] {
  const ids: string[] = [];
  for (const oid of outletIds) {
    const name = norm(outletName(oid));
    // exact, then contains either way
    let id = bmap.get(name);
    if (!id) {
      for (const [bn, bid] of bmap) if (bn.includes(name) || name.includes(bn)) { id = bid; break; }
    }
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

/** Sum of the given products' monthly omzet across the given months. */
async function productOmzet(names: string[], months: string[], cache: Map<string, Map<string, number>>): Promise<{ total: number; byName: Map<string, number> }> {
  const want = new Set(names.map(norm));
  const byName = new Map<string, number>();
  for (const n of names) byName.set(n, 0);
  let total = 0;
  for (const month of months) {
    let sales = cache.get(month);
    if (!sales) {
      sales = new Map<string, number>();
      for (const s of await listSales(month)) sales.set(norm(s.menuName), (sales.get(norm(s.menuName)) ?? 0) + (Number(s.amount) || 0));
      cache.set(month, sales);
    }
    for (const n of names) {
      const v = sales.get(norm(n)) ?? 0;
      byName.set(n, (byName.get(n) ?? 0) + v);
      total += v;
    }
  }
  void want;
  return { total, byName };
}

async function computeImpact(e: ReviewableEvent, bmap: Map<string, string>, salesCache: Map<string, Map<string, number>>): Promise<EventImpact> {
  const r = e.review;
  const type = r.eventType!;
  const start = r.measureStart!;
  const end = r.measureEnd!;
  const days = windowDays(start, end);
  const baseFrom = shift(start, -days);
  const baseTo = shift(start, -1);

  let windowOmzet = 0;
  let baselineOmzet = 0;
  let omzetScope: "outlet" | "all" = "all";
  const productBreakdown: ProductBreakdown[] = [];
  let note = "";

  if (type === "event") {
    // Event → outlet omzet. All Outlets = company-wide; else the affected outlets.
    if (r.allOutlets) {
      omzetScope = "all";
      windowOmzet = await omzetInRange("", start, end);
      baselineOmzet = await omzetInRange("", baseFrom, baseTo);
      note = "Dampak dihitung dari omzet seluruh outlet.";
    } else {
      const branchIds = matchBranchIds(r.outletIds, bmap);
      if (branchIds.length) {
        omzetScope = "outlet";
        for (const b of branchIds) {
          windowOmzet += await omzetInRange(b, start, end);
          baselineOmzet += await omzetInRange(b, baseFrom, baseTo);
        }
      } else {
        omzetScope = "all";
        windowOmzet = await omzetInRange("", start, end);
        baselineOmzet = await omzetInRange("", baseFrom, baseTo);
        note = esbConfigured() ? "Outlet tidak terpetakan ke cabang ESB — omzet dihitung seluruh outlet." : "Integrasi ESB/Musiman belum aktif — data omzet belum tersedia.";
      }
    }
  } else {
    // Promo → omzet produk saja (penjualan bulanan produk terpilih).
    const winMonths = monthsBetween(start, end);
    const baseMonths = monthsBefore(winMonths[0], winMonths.length);
    const win = await productOmzet(r.productNames, winMonths, salesCache);
    const base = await productOmzet(r.productNames, baseMonths, salesCache);
    windowOmzet = win.total;
    baselineOmzet = base.total;
    for (const n of r.productNames) {
      const w = win.byName.get(n) ?? 0;
      const b = base.byName.get(n) ?? 0;
      productBreakdown.push({ name: n, windowOmzet: w, baselineOmzet: b, uplift: w - b });
    }
    if (windowOmzet === 0 && baselineOmzet === 0) note = "Penjualan produk pada periode ini belum tersedia (butuh sinkronisasi penjualan HPP).";
  }

  const uplift = windowOmzet - baselineOmzet;
  const hasData = windowOmzet > 0 || baselineOmzet > 0;
  const roi = r.budget > 0 ? uplift / r.budget : 0;
  const upliftPct = baselineOmzet > 0 ? (uplift / baselineOmzet) * 100 : 0;

  return {
    eventId: e.id,
    name: e.name,
    type,
    budget: r.budget,
    measureStart: start,
    measureEnd: end,
    days,
    omzetScope,
    windowOmzet,
    baselineOmzet,
    uplift,
    upliftPct: Math.round(upliftPct * 10) / 10,
    roi: Math.round(roi * 100) / 100,
    net: uplift - r.budget,
    verdict: verdictOf(uplift, r.budget, hasData),
    productBreakdown,
    note,
  };
}

/** Impact for every approved+classified event, ranked most→least impactful. */
export async function buildImpacts(): Promise<EventImpact[]> {
  const events = (await listReviewableEvents()).filter(
    (e) => e.review.status === "approved" && e.review.eventType && e.review.measureStart && e.review.measureEnd,
  );
  if (events.length === 0) return [];
  const bmap = await branchMap();
  const salesCache = new Map<string, Map<string, number>>();
  const impacts: EventImpact[] = [];
  for (const e of events) impacts.push(await computeImpact(e, bmap, salesCache));
  return impacts.sort((a, b) => b.uplift - a.uplift);
}
