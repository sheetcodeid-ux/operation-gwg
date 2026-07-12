import "server-only";

import { fetchBranches, fetchErpDashboard, fetchSalesHourly, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";
import { sumExpenses, sumPurchases } from "@/lib/data/ops-finance";

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

export interface OpsDashboardData {
  configured: boolean;
  date: string; // YYYY-MM-DD used
  kpi: OpsKpi | null;
  hourly: OpsHourly[] | null;
  fraud: OpsFraud[] | null;
  branches: OpsBranch[];
  finance: OpsFinance | null; // from our own Finance-input tables (independent of ERP)
  errors: string[]; // human labels of sources that failed
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

export async function emptyOpsDashboard(): Promise<OpsDashboardData> {
  const finance = await loadFinance(ym(new Date()));
  return { configured: false, date: "", kpi: null, hourly: null, fraud: null, branches: [], finance, errors: [] };
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
export async function getOpsDashboard(opts: { date?: string } = {}): Promise<OpsDashboardData> {
  const finance = await loadFinance(ym(opts.date ? new Date(opts.date) : new Date()));
  if (!gwgmanageConfigured()) return { ...(await emptyOpsDashboard()), finance };

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

  return { configured: true, date: dToday, kpi, hourly, fraud, branches: brs, finance, errors };
}
