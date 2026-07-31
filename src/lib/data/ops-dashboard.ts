import "server-only";

import { esbConfigured, esbListBranches } from "@/lib/integrations/esb-client";
import { getSalesDaily } from "@/lib/data/fraud-store";
import { listEsbMenus } from "@/lib/data/esb-menu";
import { expenseTotal, listExpenses, listOpOutlets, listPurchases, sumExpenses, sumPurchases } from "@/lib/data/ops-finance";
import { areaName, listComplaints, listEvents, listHygiene, listTasks, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { getOpsSettings } from "@/lib/data/ops-settings";
import { DEFAULT_SETTINGS, type OpsSettings } from "@/lib/ops/settings-types";
import type { ComplaintCategory, UserProfile } from "@/lib/types";

export interface OpsKpi {
  netSales: number;
  netSalesPrev: number; // yesterday (from hourly sum) for delta
  totalTransaksi: number;
  totalPelanggan: number;
  avgBill: number;
}
/** Finance-input aggregates for the current month (from op_expenses / op_purchases). */
export interface OpsFinance {
  expenses: number; // Beban Operasional total
  purchaseWh: number;
  purchaseNonWh: number;
  purchaseTotal: number; // Pembelian total
}
export interface OpsHourly { x: string; hari: number; kemarin: number }
export interface OpsFraud { name: string; value: number }
export interface OpsBranch { code: string; name: string }

/** Kontrol › Complain (from app CRM/Complaints) & Kebersihan (from app Hygiene). */
export interface OpsComplaint { outlet: string; category: string; note: string; status: "Open" | "In Progress" }
export interface OpsHygieneRow { outlet: string; area: string; ok: boolean; supervisor: string }
export interface OpsHygiene { checkedToday: number; totalOutlets: number; rows: OpsHygieneRow[] }
export interface OpsEventRow { name: string; count: number; up: boolean } // Kontrol › Event (Event Tracker)
export interface OpsControl { complaints: OpsComplaint[]; hygiene: OpsHygiene | null; events: OpsEventRow[] }

/** Aktivitas Terkini (Juknis 2.12): Divisi = Work Tracker; Outlet = sistem otomatis. */
export interface OpsActivity { who: string; time: string; desc: string; tone: "blue" | "green" | "amber" | "red" }
export interface OpsActivityFeed { divisi: OpsActivity[]; outlet: OpsActivity[] }

/** Target & projection (Juknis 2.1–2.3, computed from 3-month omzet history). */
export interface OpsTargetWeek { label: string; target: number; actual: number; porsi: number }
export interface OpsTarget {
  targetMonth: number; // avg 3-month omzet × 115%
  realisasi: number; // current-month omzet (MTD)
  attainmentPct: number; // realisasi / targetMonth × 100
  momPct: number; // realisasi vs previous month (for the −5% style badge)
  targetHarian: number;
  todayActual: number; // today's net sales
  proyeksiBulanan: number; // rate/day × days-in-month
  weeks: OpsTargetWeek[];
}

/** Produk (per-menu sales this month, from ERP menu-performance — Juknis 2.7). */
export interface OpsProduct { name: string; category: string; qty: number; amount: number }

/** Per-branch performance from our Finance input (Pembelian & Beban, this vs prev month). */
export interface OpsBranchPerf { code: string; name: string; area: string; pembelianCur: number; pembelianPrev: number; bebanCur: number; bebanPrev: number }

async function loadBranchPerf(month: string): Promise<OpsBranchPerf[]> {
  const prev = ym(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1));
  const [pCur, pPrev, eCur, ePrev] = await Promise.all([listPurchases(month), listPurchases(prev), listExpenses(month), listExpenses(prev)]);
  const pcm = new Map(pCur.map((r) => [r.outletCode, r.warehouse + r.nonWarehouse]));
  const ppm = new Map(pPrev.map((r) => [r.outletCode, r.warehouse + r.nonWarehouse]));
  const ecm = new Map(eCur.map((r) => [r.outletCode, expenseTotal(r)]));
  const epm = new Map(ePrev.map((r) => [r.outletCode, expenseTotal(r)]));
  return listOpOutlets().map((o) => ({
    code: o.code,
    name: o.name,
    area: o.area,
    pembelianCur: pcm.get(o.code) ?? 0,
    pembelianPrev: ppm.get(o.code) ?? 0,
    bebanCur: ecm.get(o.code) ?? 0,
    bebanPrev: epm.get(o.code) ?? 0,
  }));
}

export interface OpsDashboardData {
  configured: boolean;
  date: string; // YYYY-MM-DD used
  kpi: OpsKpi | null;
  hourly: OpsHourly[] | null;
  fraud: OpsFraud[] | null;
  branches: OpsBranch[];
  finance: OpsFinance | null; // from our own Finance-input tables (independent of ERP)
  control: OpsControl | null; // from app Complaints + Hygiene (scoped to the user)
  target: OpsTarget | null; // ERP omzet history (Juknis 2.1)
  products: OpsProduct[] | null; // ERP menu-performance (Juknis 2.7)
  branchPerf: OpsBranchPerf[]; // per-outlet Finance (Pembelian & Beban)
  activity: OpsActivityFeed | null; // Work/Event tracker (Juknis 2.12)
  settings: OpsSettings; // configurable thresholds (Juknis bab 6)
  errors: string[]; // human labels of sources that failed
}

async function loadProducts(): Promise<OpsProduct[] | null> {
  try {
    const menus = await listEsbMenus(); // ESB catalog (rolling 30-day qty + price)
    if (!menus.length) return null;
    return menus
      .map((m) => ({ name: m.menu, category: m.category || "Lainnya", qty: m.qty30d, amount: Math.round(m.qty30d * (m.unitPrice || 0)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50);
  } catch {
    return null;
  }
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/** First & last calendar day of a YYYY-MM month. */
function monthBounds(month: string): { from: string; to: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Total omzet of a month = Σ daily net sales from the ESB sales cache. */
async function omzetOfMonth(month: string): Promise<number> {
  const { from, to } = monthBounds(month);
  const days = await getSalesDaily(from, to);
  return days.reduce((a, d) => a + d.netSales, 0);
}

/** Target Per Bulan / Harian / Mingguan + Proyeksi Bulanan (Juknis 2.1–2.3). */
async function loadTarget(todayNetSales: number): Promise<OpsTarget | null> {
  try {
    const now = new Date();
    const monthOf = (back: number) => ym(new Date(now.getFullYear(), now.getMonth() - back, 1));
    const [o0, o1, o2, o3] = await Promise.all([omzetOfMonth(monthOf(0)), omzetOfMonth(monthOf(1)), omzetOfMonth(monthOf(2)), omzetOfMonth(monthOf(3))]);
    const avg3 = (o1 + o2 + o3) / 3;
    if (avg3 <= 0) return null; // not enough history (Juknis: min 3 bulan)

    const targetMonth = avg3 * 1.15;
    const realisasi = o0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const targetHarian = targetMonth / daysInMonth;
    const ratePerDay = daysElapsed > 0 ? realisasi / daysElapsed : 0;

    const weeks: OpsTargetWeek[] = [];
    let wi = 0;
    for (let start = 1; start <= daysInMonth; start += 7) {
      const end = Math.min(start + 6, daysInMonth);
      const days = end - start + 1;
      const elapsedInWeek = Math.max(0, Math.min(end, daysElapsed) - start + 1);
      const target = targetHarian * days;
      weeks.push({ label: `Minggu ${ROMAN[wi++]}`, target, actual: ratePerDay * elapsedInWeek, porsi: targetMonth > 0 ? +((target / targetMonth) * 100).toFixed(1) : 0 });
    }

    return {
      targetMonth,
      realisasi,
      attainmentPct: targetMonth > 0 ? +((realisasi / targetMonth) * 100).toFixed(2) : 0,
      momPct: o1 > 0 ? +(((realisasi - o1) / o1) * 100).toFixed(1) : 0,
      targetHarian,
      todayActual: todayNetSales,
      proyeksiBulanan: ratePerDay * daysInMonth,
      weeks,
    };
  } catch {
    return null;
  }
}

const COMPLAINT_LABEL: Record<ComplaintCategory, string> = {
  service: "Service",
  food_quality: "Food Quality",
  cleanliness: "Cleanliness",
  staff_characteristics: "Staff Characteristics",
  price: "Price",
  payment_system: "Payment System",
  ambiance: "Ambiance",
  order_error: "Order Error",
};

/** Complaints (open/in-progress only, Juknis 2.10.2) + hygiene checklist summary. */
function loadControl(user: UserProfile): OpsControl {
  const complaints: OpsComplaint[] = listComplaints(user)
    .filter((c) => c.status !== "close")
    .slice(0, 20)
    .map((c) => ({ outlet: outletName(c.outletId), category: COMPLAINT_LABEL[c.category] ?? c.category, note: c.content, status: c.status === "open" ? "Open" : "In Progress" }));

  const today = ymd(new Date());
  const hy = listHygiene(user);
  const todays = hy.filter((h) => (h.date ?? "").slice(0, 10) === today);
  const src = todays.length > 0 ? todays : hy.slice(0, 8);
  const rows: OpsHygieneRow[] = src.slice(0, 10).map((h) => ({ outlet: outletName(h.outletId), area: areaName(h.areaId), ok: h.isClean, supervisor: h.supervisorName }));
  const hygiene: OpsHygiene = { checkedToday: new Set(todays.map((h) => h.outletId)).size, totalOutlets: visibleOutlets(user).length, rows };

  // Event Tracker → usage per event name (Juknis 2.10.4).
  const evMap = new Map<string, number>();
  for (const e of listEvents(user)) evMap.set(e.name, (evMap.get(e.name) ?? 0) + 1);
  const events: OpsEventRow[] = [...evMap.entries()].map(([name, count]) => ({ name, count, up: count >= 2 })).sort((a, b) => b.count - a.count).slice(0, 10);

  return { complaints, hygiene, events };
}

const hm = (iso?: string | null) => { try { return iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""; } catch { return ""; } };

/** Aktivitas Terkini: Divisi from Work Tracker (done tasks); Outlet auto-derived. */
function loadActivity(user: UserProfile): OpsActivityFeed {
  const divisi: OpsActivity[] = listTasks(user)
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completionDate ?? b.createdAt).localeCompare(a.completionDate ?? a.createdAt))
    .slice(0, 6)
    .map((t) => ({ who: t.picIds[0] ? userName(t.picIds[0]) : t.division, time: hm(t.completionDate ?? t.createdAt), desc: t.title, tone: "green" as const }));

  const outlet: OpsActivity[] = [];
  const today = ymd(new Date());
  const checked = new Set(listHygiene(user).filter((h) => (h.date ?? "").slice(0, 10) === today).map((h) => h.outletId));
  for (const o of visibleOutlets(user)) {
    if (outlet.length >= 3) break;
    if (!checked.has(o.id)) outlet.push({ who: o.name, time: "", desc: "SPV belum upload checklist kebersihan hari ini", tone: "red" });
  }
  for (const c of listComplaints(user).filter((c) => c.status === "open").slice(0, 3)) {
    outlet.push({ who: outletName(c.outletId), time: hm(c.createdAt), desc: `Komplain baru: ${COMPLAINT_LABEL[c.category] ?? c.category}`, tone: "amber" });
  }
  return { divisi, outlet: outlet.slice(0, 6) };
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

async function loadFinance(month: string): Promise<OpsFinance | null> {
  try {
    const [expenses, pur] = await Promise.all([sumExpenses(month), sumPurchases(month)]);
    if (expenses === 0 && pur.total === 0) return null; // nothing input yet
    return { expenses, purchaseWh: pur.warehouse, purchaseNonWh: pur.nonWarehouse, purchaseTotal: pur.total };
  } catch {
    return null;
  }
}

function baseOpsDashboard(): OpsDashboardData {
  return { configured: false, date: "", kpi: null, hourly: null, fraud: null, branches: [], finance: null, control: null, target: null, products: null, branchPerf: [], activity: null, settings: DEFAULT_SETTINGS, errors: [] };
}

/**
 * Build Dashboard 2 from ESB data (via the cached sales/menu tables — fast):
 *  - KPI Net Sales (today vs yesterday)        ← ESB daily sales cache
 *  - Penjualan trend (daily, last 14 days)     ← ESB daily sales cache
 *  - Produk (menu qty + amount)                ← ESB menu catalog (esb_menu)
 *  - Cabang list                               ← ESB branches
 * ESB has no per-hour, transaksi, pelanggan, or avg-bill data, so those KPI
 * fields stay 0 and the void/cancel card lives on the dedicated Fraud page.
 * Each source is independent (Promise.allSettled) so one failure doesn't blank
 * the rest — the component keeps its placeholder for anything that errored.
 */
export async function getOpsDashboard(opts: { date?: string; user?: UserProfile } = {}): Promise<OpsDashboardData> {
  const month = ym(opts.date ? new Date(opts.date) : new Date());
  const finance = await loadFinance(month);
  const control = opts.user ? loadControl(opts.user) : null;
  const activity = opts.user ? loadActivity(opts.user) : null;
  const branchPerf = await loadBranchPerf(month);
  const settings = await getOpsSettings();
  if (!esbConfigured()) return { ...baseOpsDashboard(), finance, control, branchPerf, activity, settings };
  const errors: string[] = [];

  const today = opts.date ? new Date(opts.date) : new Date();
  const dToday = ymd(today);
  const dYest = ymd(new Date(today.getTime() - 86_400_000));
  const dFrom = ymd(new Date(today.getTime() - 13 * 86_400_000)); // 14-day window

  // ESB gives daily net sales (cached, fast) + branches. There's no per-hour or
  // transaksi/pelanggan/avg-bill data, so the hourly chart becomes a DAILY net
  // sales trend and those KPI fields stay 0.
  const [salesRes, branchesRes] = await Promise.allSettled([getSalesDaily(dFrom, dToday), esbListBranches()]);

  let hourly: OpsHourly[] | null = null;
  let todayNet = 0;
  let prevNet = 0;
  if (salesRes.status === "fulfilled") {
    const days = salesRes.value.slice().sort((a, b) => a.day.localeCompare(b.day));
    const byDay = new Map(days.map((d) => [d.day, d.netSales]));
    todayNet = byDay.get(dToday) ?? 0;
    prevNet = byDay.get(dYest) ?? 0;
    hourly = days.map((d) => {
      const dt = new Date(`${d.day}T00:00:00`);
      return { x: `${dt.getDate()}/${dt.getMonth() + 1}`, hari: d.netSales, kemarin: 0 };
    });
  } else {
    errors.push("Penjualan");
  }

  const kpi: OpsKpi | null =
    salesRes.status === "fulfilled"
      ? { netSales: todayNet, netSalesPrev: prevNet, totalTransaksi: 0, totalPelanggan: 0, avgBill: 0 }
      : null;
  if (!kpi) errors.push("KPI");

  // Void/cancel breakdown lives on the dedicated Fraud page (ESB cancel export);
  // leave the dashboard fraud card empty rather than approximate it here.
  const fraud: OpsFraud[] | null = null;

  const brs: OpsBranch[] = branchesRes.status === "fulfilled" ? branchesRes.value.map((b) => ({ code: b.id, name: b.name })) : [];
  if (branchesRes.status !== "fulfilled") errors.push("Cabang");

  const [tgt, products] = await Promise.all([loadTarget(kpi?.netSales ?? 0), loadProducts()]);
  const target = tgt;
  if (!target) errors.push("Target");
  if (!products) errors.push("Produk");

  return { configured: true, date: dToday, kpi, hourly, fraud, branches: brs, finance, control, target, products, branchPerf, activity, settings, errors };
}
