import "server-only";

import { fetchBranches, fetchErpDashboard, fetchMenuPerformance, fetchSalesHourly, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";
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
    const perf = await fetchMenuPerformance(ym(new Date()));
    if (!perf.menus.length) return null;
    return perf.menus.map((m) => ({ name: m.menuName, category: m.categoryName || "Lainnya", qty: m.qty, amount: m.amount }));
  } catch {
    return null;
  }
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/** Total omzet of a month = Σ menu-performance amounts (proven ERP endpoint). */
async function omzetOfMonth(month: string): Promise<number> {
  const perf = await fetchMenuPerformance(month);
  return perf.menus.reduce((a, m) => a + m.amount, 0);
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
 * Pull the real GWG Manage data that maps cleanly to Dashboard 2 components:
 *  - KPI Net Sales + transaksi/pelanggan/avg  ← /api/reports/dashboard (daily)
 *  - Penjualan hourly (today vs yesterday)     ← /api/reports/sales-hourly
 *  - Kontrol › Fraud (void/cancel/platform)    ← /api/reports/dashboard
 *  - Cabang list                               ← /api/branches
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
  if (!gwgmanageConfigured()) return { ...baseOpsDashboard(), finance, control, branchPerf, activity, settings };
  let target: OpsTarget | null = null;

  const today = opts.date ? new Date(opts.date) : new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const dToday = ymd(today);
  const dYest = ymd(yest);
  const errors: string[] = [];

  const [dash, hToday, hYest, branches] = await Promise.allSettled([
    fetchErpDashboard({ date: dToday }),
    fetchSalesHourly(dToday, dToday),
    fetchSalesHourly(dYest, dYest),
    fetchBranches(),
  ]);

  // Hourly (today vs yesterday)
  let hourly: OpsHourly[] | null = null;
  let prevTotal = 0;
  if (hToday.status === "fulfilled") {
    const yByHour = new Map<string, number>();
    if (hYest.status === "fulfilled") for (const p of hYest.value) { yByHour.set(p.hour, p.netSales); prevTotal += p.netSales; }
    hourly = hToday.value.map((p) => ({ x: p.hour, hari: p.netSales, kemarin: yByHour.get(p.hour) ?? 0 }));
  } else {
    errors.push("Penjualan");
  }

  // KPI + Fraud
  let kpi: OpsKpi | null = null;
  let fraud: OpsFraud[] | null = null;
  if (dash.status === "fulfilled") {
    const v = dash.value;
    kpi = { netSales: v.netSales, netSalesPrev: prevTotal, totalTransaksi: v.totalTransaksi, totalPelanggan: v.totalPelanggan, avgBill: v.avgBill };
    fraud = [
      { name: "Void", value: v.totalVoid },
      { name: "Cancelled", value: v.totalCancelled },
      ...v.platform.slice(0, 6).map((p) => ({ name: p.methodName, value: p.amount })),
    ];
  } else {
    errors.push("KPI");
  }

  const brs: OpsBranch[] = branches.status === "fulfilled" ? branches.value.map((b) => ({ code: b.code, name: b.name })) : [];
  if (branches.status !== "fulfilled") errors.push("Cabang");

  const [tgt, products] = await Promise.all([loadTarget(kpi?.netSales ?? 0), loadProducts()]);
  target = tgt;
  if (!target) errors.push("Target");
  if (!products) errors.push("Produk");

  return { configured: true, date: dToday, kpi, hourly, fraud, branches: brs, finance, control, target, products, branchPerf, activity, settings, errors };
}
