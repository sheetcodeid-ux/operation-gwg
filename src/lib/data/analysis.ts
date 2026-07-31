import "server-only";

import { db, dbEnabled } from "./db";
import { esbConfigured } from "@/lib/integrations/esb-client";
import { listEsbMenus, type EsbMenu } from "./esb-menu";
import { listHpp } from "./hpp";

/**
 * Operation → Data Analysis engine. Everything here is computed from REAL cached
 * ESB data — no fabricated numbers:
 *  - Sales (daily gross+net, from January) ← `seasonal_daily`
 *  - Products / categories / price          ← `esb_menu` (ESB menu catalog)
 *  - Margin                                 ← HPP (harga jual vs HPP)
 * Metrics ESB doesn't provide (per-hour, transaksi count, basket size, stock)
 * are intentionally absent — replaced by day-level analysis where relevant.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface DayPoint { day: string; label: string; gross: number; net: number }
export interface NameValue { name: string; value: number }
export interface ProductRow { menu: string; category: string; qty: number; amount: number; unitPrice: number; share: number }
export interface CategoryRow { category: string; qty: number; amount: number; share: number }
export interface MarginRow { name: string; category: string; price: number; hpp: number; margin: number; marginPct: number }
export type AlertLevel = "high" | "medium" | "low";
export interface AlertItem { level: AlertLevel; title: string; detail: string }
export interface InsightItem { title: string; detail: string }
export interface OutletPerfRow { branch: string; net: number; share: number; growthPct: number | null }

export interface AnalysisData {
  configured: boolean;
  hasSales: boolean;
  branch: string; // "" = all outlets
  from: string;
  to: string;
  kpi: {
    totalSales: number; // gross
    netSales: number;
    days: number;
    avgPerDay: number;
    growthPct: number | null; // vs previous equal-length period
    prevNet: number;
    targetNet: number; // prev × 1.15
    achievementPct: number | null;
    productsSold: number; // Σ qty (30d catalog)
    categories: number;
    avgPrice: number;
    avgMarginPct: number | null;
  };
  trend: DayPoint[];
  byMonth: NameValue[];
  byWeekday: NameValue[];
  peakDay: DayPoint | null;
  lowDay: DayPoint | null;
  outletPerformance: OutletPerfRow[]; // per-outlet ranking (all-outlets view only)
  products: ProductRow[];
  bestSellers: ProductRow[];
  worstSellers: ProductRow[];
  deadProducts: ProductRow[];
  categoriesRows: CategoryRow[];
  priceStats: { avg: number; highest: ProductRow | null; lowest: ProductRow | null } | null;
  margins: MarginRow[];
  lowMargins: MarginRow[];
  alerts: AlertItem[];
  insights: InsightItem[];
  recommendations: InsightItem[];
}

interface SeasRow { day: string; gross: number | string; net: number | string }

async function readSeasonal(from: string, to: string, branch: string): Promise<Map<string, { gross: number; net: number }>> {
  const out = new Map<string, { gross: number; net: number }>();
  if (!dbEnabled) return out;
  try {
    const { data } = await db().from("seasonal_daily").select("day,gross,net").eq("branch", branch).gte("day", from).lte("day", to);
    for (const r of (data ?? []) as SeasRow[]) out.set(r.day, { gross: Number(r.gross) || 0, net: Number(r.net) || 0 });
  } catch {
    /* table missing / off → empty */
  }
  return out;
}

/** Per-branch net-sales totals for a range (branch != "" rows only). */
async function readSeasonalByBranch(from: string, to: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!dbEnabled) return out;
  try {
    const { data } = await db().from("seasonal_daily").select("branch,net").neq("branch", "").gte("day", from).lte("day", to);
    for (const r of (data ?? []) as { branch: string; net: number | string }[]) out.set(r.branch, (out.get(r.branch) ?? 0) + (Number(r.net) || 0));
  } catch {
    /* off → empty */
  }
  return out;
}

/** Branch list for the outlet selector (ESB branch id ↔ name). */
export async function analysisBranches(): Promise<{ id: string; name: string }[]> {
  if (!dbEnabled) return [];
  try {
    const { data } = await db().from("seasonal_daily").select("branch").neq("branch", "");
    const ids = [...new Set(((data ?? []) as { branch: string }[]).map((r) => r.branch))];
    // Names live in esb branches; fall back to the id when unknown.
    return ids.map((id) => ({ id, name: id })).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

const money = (n: number) => Math.round(n);

export async function getOperationAnalysis(from: string, to: string, branch = ""): Promise<AnalysisData> {
  const base: AnalysisData = {
    configured: esbConfigured(),
    hasSales: false,
    branch,
    from,
    to,
    kpi: { totalSales: 0, netSales: 0, days: 0, avgPerDay: 0, growthPct: null, prevNet: 0, targetNet: 0, achievementPct: null, productsSold: 0, categories: 0, avgPrice: 0, avgMarginPct: null },
    trend: [],
    byMonth: [],
    byWeekday: [],
    peakDay: null,
    lowDay: null,
    outletPerformance: [],
    products: [],
    bestSellers: [],
    worstSellers: [],
    deadProducts: [],
    categoriesRows: [],
    priceStats: null,
    margins: [],
    lowMargins: [],
    alerts: [],
    insights: [],
    recommendations: [],
  };
  if (!esbConfigured() || !dbEnabled) return base;

  // ---- Sales (seasonal daily) — current + previous equal-length window ----
  const fromD = new Date(`${from}T00:00:00`);
  const toD = new Date(`${to}T00:00:00`);
  const spanDays = Math.max(1, Math.round((+toD - +fromD) / MS) + 1);
  const prevTo = new Date(+fromD - MS);
  const prevFrom = new Date(+prevTo - (spanDays - 1) * MS);

  const [cur, prev] = await Promise.all([readSeasonal(from, to, branch), readSeasonal(iso(prevFrom), iso(prevTo), branch)]);

  const trend: DayPoint[] = [];
  const monthAgg = new Map<number, number>();
  const dowAgg = new Map<number, { sum: number; n: number }>();
  let totalGross = 0;
  let totalNet = 0;
  for (let t = +fromD; t <= +toD; t += MS) {
    const d = new Date(t);
    const key = iso(d);
    const v = cur.get(key) ?? { gross: 0, net: 0 };
    totalGross += v.gross;
    totalNet += v.net;
    trend.push({ day: key, label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, gross: v.gross, net: v.net });
    monthAgg.set(d.getMonth(), (monthAgg.get(d.getMonth()) ?? 0) + v.net);
    const dw = dowAgg.get(d.getDay()) ?? { sum: 0, n: 0 };
    dw.sum += v.net;
    dw.n += 1;
    dowAgg.set(d.getDay(), dw);
  }
  const hasSales = totalGross > 0 || totalNet > 0;
  let prevNet = 0;
  for (const v of prev.values()) prevNet += v.net;

  const activeDays = trend.filter((p) => p.net > 0);
  const peakDay = activeDays.length ? activeDays.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const lowDay = activeDays.length ? activeDays.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const byMonth: NameValue[] = [...monthAgg.entries()].filter(([, v]) => v > 0).sort((a, b) => a[0] - b[0]).map(([m, v]) => ({ name: MONTHS[m], value: money(v) }));
  const byWeekday: NameValue[] = [...dowAgg.entries()].sort((a, b) => a[0] - b[0]).map(([d, v]) => ({ name: DOW[d], value: money(v.n ? v.sum / v.n : 0) }));

  const growthPct = prevNet > 0 ? +(((totalNet - prevNet) / prevNet) * 100).toFixed(1) : null;
  const targetNet = money(prevNet * 1.15);
  const achievementPct = targetNet > 0 ? +((totalNet / targetNet) * 100).toFixed(1) : null;

  // ---- Outlet performance (all-outlets view only) — per-branch ranking ----
  let outletPerformance: OutletPerfRow[] = [];
  if (!branch) {
    const [curB, prevB] = await Promise.all([readSeasonalByBranch(from, to), readSeasonalByBranch(iso(prevFrom), iso(prevTo))]);
    const totalB = [...curB.values()].reduce((a, b) => a + b, 0);
    outletPerformance = [...curB.entries()]
      .map(([b, net]) => {
        const p = prevB.get(b) ?? 0;
        return { branch: b, net: money(net), share: totalB ? +((net / totalB) * 100).toFixed(1) : 0, growthPct: p > 0 ? +(((net - p) / p) * 100).toFixed(1) : null };
      })
      .filter((r) => r.net > 0)
      .sort((a, b) => b.net - a.net);
  }

  // ---- Products / categories / price (esb_menu) ----
  let menus: EsbMenu[] = [];
  try {
    menus = await listEsbMenus();
  } catch {
    menus = [];
  }
  const totalQty = menus.reduce((a, m) => a + m.qty30d, 0);
  const products: ProductRow[] = menus
    .map((m) => ({ menu: m.menu, category: m.category || "Lainnya", qty: m.qty30d, amount: money(m.qty30d * (m.unitPrice || 0)), unitPrice: money(m.unitPrice || 0), share: totalQty ? +((m.qty30d / totalQty) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.qty - a.qty);
  const sellers = products.filter((p) => p.qty > 0);
  const bestSellers = sellers.slice(0, 10);
  const worstSellers = sellers.slice(-10).reverse();
  const deadProducts = products.filter((p) => p.qty === 0).slice(0, 20);

  const catAgg = new Map<string, { qty: number; amount: number }>();
  for (const p of products) {
    const c = catAgg.get(p.category) ?? { qty: 0, amount: 0 };
    c.qty += p.qty;
    c.amount += p.amount;
    catAgg.set(p.category, c);
  }
  const categoriesRows: CategoryRow[] = [...catAgg.entries()]
    .map(([category, v]) => ({ category, qty: v.qty, amount: v.amount, share: totalQty ? +((v.qty / totalQty) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.qty - a.qty);

  const priced = products.filter((p) => p.unitPrice > 0);
  const priceStats = priced.length
    ? {
        avg: money(priced.reduce((a, p) => a + p.unitPrice, 0) / priced.length),
        highest: priced.reduce((a, b) => (b.unitPrice > a.unitPrice ? b : a)),
        lowest: priced.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a)),
      }
    : null;

  // ---- Margin (HPP harga jual vs HPP) ----
  let margins: MarginRow[] = [];
  try {
    const hpp = await listHpp();
    margins = hpp
      .filter((h) => h.chosenPrice > 0)
      .map((h) => {
        const margin = h.chosenPrice - h.hpp;
        return { name: h.name, category: h.category, price: money(h.chosenPrice), hpp: money(h.hpp), margin: money(margin), marginPct: h.chosenPrice > 0 ? +((margin / h.chosenPrice) * 100).toFixed(1) : 0 };
      })
      .sort((a, b) => a.marginPct - b.marginPct);
  } catch {
    margins = [];
  }
  const lowMargins = margins.filter((m) => m.marginPct < 30).slice(0, 15);
  const avgMarginPct = margins.length ? +(margins.reduce((a, m) => a + m.marginPct, 0) / margins.length).toFixed(1) : null;

  // ---- Alerts (rule-based, real thresholds) ----
  const alerts: AlertItem[] = [];
  if (growthPct !== null && growthPct <= -10) alerts.push({ level: "high", title: "Penjualan turun", detail: `Net sales turun ${Math.abs(growthPct)}% dibanding periode sebelumnya.` });
  if (achievementPct !== null && achievementPct < 80) alerts.push({ level: "high", title: "Target tidak tercapai", detail: `Pencapaian baru ${achievementPct}% dari target periode ini.` });
  if (lowMargins.length > 0) alerts.push({ level: "medium", title: "Margin tipis", detail: `${lowMargins.length} produk bermargin < 30% (terendah: ${lowMargins[0].name} ${lowMargins[0].marginPct}%).` });
  if (deadProducts.length > 0) alerts.push({ level: "medium", title: "Produk mati", detail: `${deadProducts.length} produk tanpa penjualan dalam 30 hari terakhir.` });
  const slow = sellers.slice(-5);
  if (slow.length > 0) alerts.push({ level: "low", title: "Produk slow moving", detail: `${slow.length} produk dengan penjualan terendah — pertimbangkan promo atau evaluasi.` });

  // ---- Insights & recommendations (rule-based) ----
  const insights: InsightItem[] = [];
  const recommendations: InsightItem[] = [];
  if (hasSales) {
    if (peakDay) insights.push({ title: "Hari tersibuk", detail: `${peakDay.label} adalah hari dengan net sales tertinggi (Rp ${peakDay.net.toLocaleString("id-ID")}).` });
    if (byWeekday.length) {
      const topDow = byWeekday.reduce((a, b) => (b.value > a.value ? b : a));
      const lowDow = byWeekday.reduce((a, b) => (b.value < a.value ? b : a));
      insights.push({ title: "Pola harian", detail: `Rata-rata tertinggi di hari ${topDow.name}, terendah di ${lowDow.name}.` });
      recommendations.push({ title: "Jadwal promo", detail: `Fokuskan promo pada hari ${lowDow.name} untuk mengangkat penjualan yang lemah.` });
    }
    if (growthPct !== null) insights.push({ title: "Tren", detail: growthPct >= 0 ? `Penjualan tumbuh ${growthPct}% vs periode sebelumnya.` : `Penjualan turun ${Math.abs(growthPct)}% vs periode sebelumnya — perlu perhatian.` });
  }
  if (bestSellers.length) {
    insights.push({ title: "Produk unggulan", detail: `${bestSellers[0].menu} adalah best seller (${bestSellers[0].qty} terjual, ${bestSellers[0].share}% kontribusi).` });
    recommendations.push({ title: "Andalkan best seller", detail: `Pastikan stok ${bestSellers[0].menu} aman dan tampilkan di posisi utama menu.` });
  }
  if (deadProducts.length) recommendations.push({ title: "Evaluasi produk mati", detail: `Pertimbangkan menghentikan/ganti ${deadProducts.length} produk tanpa penjualan.` });
  if (lowMargins.length) recommendations.push({ title: "Perbaiki margin", detail: `Tinjau harga/HPP untuk ${lowMargins[0].name} (margin ${lowMargins[0].marginPct}%).` });

  return {
    ...base,
    hasSales,
    kpi: {
      totalSales: money(totalGross),
      netSales: money(totalNet),
      days: activeDays.length,
      avgPerDay: money(activeDays.length ? totalNet / activeDays.length : 0),
      growthPct,
      prevNet: money(prevNet),
      targetNet,
      achievementPct,
      productsSold: totalQty,
      categories: categoriesRows.length,
      avgPrice: priceStats?.avg ?? 0,
      avgMarginPct,
    },
    trend,
    byMonth,
    byWeekday,
    peakDay,
    lowDay,
    outletPerformance,
    products,
    bestSellers,
    worstSellers,
    deadProducts,
    categoriesRows,
    priceStats,
    margins,
    lowMargins,
    alerts,
    insights,
    recommendations,
  };
}
