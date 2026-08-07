import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getAreas, getOutlets, listComplaints, userName } from "./store";
import { listPurchases } from "./ops-finance";
import { listPnl } from "./ops-pnl";
import {
  DEFAULT_OPS_WEIGHTS,
  MIN_OUTLET_MONTHS,
  OPS_KPI_INDICATORS,
  opsAktual,
  opsCapaian,
  opsTotalScore,
  targetGrossSales,
  targetNetProfit,
  targetNonWarehouse,
  targetWarehouse,
  type OpsKpiKey,
  type OpsKpiRow,
} from "@/lib/ops-kpi";
import type { UserProfile } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Nama outlet dinormalkan supaya cocok dengan `sales_period.branch` dari ESB. */
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const monthBounds = (month: string) => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};
const shiftMonth = (month: string, by: number) => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Omzet per outlet untuk satu bulan, dari cache penjualan ESB per cabang. */
async function omzetByOutlet(month: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!dbEnabled) return out;
  const { from, to } = monthBounds(month);
  // Baris rentang penuh sebulan bila ada; kalau tidak, jumlahkan baris hariannya.
  // Dibaca bertahap: sebulan baris HARIAN untuk ~50 outlet sudah lewat seribu
  // baris, dan pemotongan diam-diam bikin omzet sebagian outlet hilang dari KPI.
  const rows = await selectAll<{ branch: string; net_sales: number | string; date_from: string; date_to: string }>(
    "sales_period",
    (a, b) =>
      db()
        .from("sales_period")
        .select("branch,net_sales,date_from,date_to")
        .gte("date_from", from)
        .lte("date_to", to)
        .order("branch")
        .order("date_from")
        .order("date_to")
        .range(a, b),
  );
  const full = rows.filter((r) => r.date_from === from && r.date_to === to);
  const use = full.length > 0 ? full : rows.filter((r) => r.date_from === r.date_to);
  for (const r of use) {
    if (!r.branch) continue; // '' = total seluruh outlet, bukan satu cabang
    const key = normName(r.branch);
    out.set(key, (out.get(key) ?? 0) + (Number(r.net_sales) || 0));
  }
  return out;
}

/** Bulan pertama sebuah outlet tercatat menjual, plus bulan paling awal yang
 *  ada di basis data — dipakai menaksir umur outlet tanpa kolom tanggal buka. */
async function firstSalesMonth(): Promise<{ byOutlet: Map<string, string>; dataStart: string | null }> {
  const byOutlet = new Map<string, string>();
  if (!dbEnabled) return { byOutlet, dataStart: null };
  const rows = await selectAll<{ branch: string; date_from: string }>("sales_period", (a, b) =>
    db()
      .from("sales_period")
      .select("branch,date_from")
      .order("branch")
      .order("date_from")
      .order("date_to")
      .range(a, b),
  );
  let dataStart: string | null = null;
  for (const r of rows) {
    const m = r.date_from.slice(0, 7);
    if (!dataStart || m < dataStart) dataStart = m;
    if (!r.branch) continue;
    const key = normName(r.branch);
    const cur = byOutlet.get(key);
    if (!cur || m < cur) byOutlet.set(key, m);
  }
  return { byOutlet, dataStart };
}

export interface OpsKpiOutletRow {
  outletId: string;
  outletCode: string;
  outletName: string;
  areaId: string;
  areaName: string;
  /** Rata-rata omzet 3 bulan sebelum periode. */
  avg3: number;
  targetGs: number;
  actualGs: number;
  targetNp: number;
  actualNp: number;
  targetWh: number;
  actualWh: number;
  targetNonWh: number;
  actualNonWh: number;
  complaints: number;
  /** Outlet berusia < 3 bulan tidak ikut perhitungan. */
  eligible: boolean;
  /** Alasan bila tidak ikut. */
  reason: string;
}

export interface OpsKpiBoard {
  period: string;
  areaId: string;
  areaName: string;
  coordinatorName: string;
  weights: Record<OpsKpiKey, number>;
  rows: OpsKpiRow[];
  score: number;
  outlets: OpsKpiOutletRow[];
  /** Outlet yang dikecualikan karena belum 3 bulan berjalan. */
  excluded: OpsKpiOutletRow[];
  manual: { problemSolver: number; problemSolverTarget: number; complaintTarget: number; note: string };
  updatedByName: string | null;
  /** Tren skor beberapa periode terakhir. */
  trend: { period: string; score: number }[];
  areas: { id: string; name: string; coordinator: string }[];
}

export async function getOpsKpiWeights(): Promise<Record<OpsKpiKey, number>> {
  const w = { ...DEFAULT_OPS_WEIGHTS };
  if (!dbEnabled) return w;
  const { data } = await db().from("ops_kpi_weights").select("key,weight");
  for (const r of (data ?? []) as { key: string; weight: number | string }[]) {
    if (r.key in w) w[r.key as OpsKpiKey] = Number(r.weight) || 0;
  }
  return w;
}

export async function saveOpsKpiWeights(next: Record<OpsKpiKey, number>): Promise<void> {
  if (!dbEnabled) return;
  const rows = (Object.keys(next) as OpsKpiKey[]).map((k) => ({ key: k, weight: next[k] }));
  const { error } = await db().from("ops_kpi_weights").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

interface ManualRow {
  problemSolver: number;
  problemSolverTarget: number;
  complaintTarget: number;
  note: string;
  updatedBy: string | null;
}
const EMPTY_MANUAL: ManualRow = { problemSolver: 0, problemSolverTarget: 100, complaintTarget: 0, note: "", updatedBy: null };

async function getManual(period: string, areaId: string): Promise<ManualRow> {
  if (!dbEnabled) return EMPTY_MANUAL;
  const { data } = await db()
    .from("ops_kpi_manual")
    .select("*")
    .eq("period", period)
    .eq("area_id", areaId)
    .maybeSingle();
  if (!data) return EMPTY_MANUAL;
  const r = data as any;
  return {
    problemSolver: Number(r.problem_solver) || 0,
    problemSolverTarget: Number(r.problem_solver_target) || 100,
    complaintTarget: Number(r.complaint_target) || 0,
    note: r.note ?? "",
    updatedBy: r.updated_by ?? null,
  };
}

export async function saveOpsKpiManual(input: {
  period: string;
  areaId: string;
  problemSolver: number;
  problemSolverTarget: number;
  complaintTarget: number;
  note: string;
  updatedBy: string;
}): Promise<void> {
  if (!dbEnabled) return;
  const { error } = await db().from("ops_kpi_manual").upsert(
    {
      period: input.period,
      area_id: input.areaId,
      problem_solver: input.problemSolver,
      problem_solver_target: input.problemSolverTarget,
      complaint_target: input.complaintTarget,
      note: input.note,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period,area_id" },
  );
  if (error) throw new Error(error.message);
}

/** Kumpulkan seluruh angka mentah per outlet untuk satu periode. */
async function outletRows(period: string, user: UserProfile): Promise<OpsKpiOutletRow[]> {
  const [omzet0, omzet1, omzet2, omzet3, purchases, pnl, first] = await Promise.all([
    omzetByOutlet(period),
    omzetByOutlet(shiftMonth(period, -1)),
    omzetByOutlet(shiftMonth(period, -2)),
    omzetByOutlet(shiftMonth(period, -3)),
    listPurchases(period),
    listPnl(period),
    firstSalesMonth(),
  ]);

  const purchaseBy = new Map(purchases.map((p) => [p.outletCode, p]));
  const pnlBy = new Map(pnl.map((p) => [p.outletCode, p]));
  const areas = new Map(getAreas().map((a) => [a.id, a.name]));

  // Komplain bulan berjalan, kategori kualitas makanan dikecualikan.
  const complaintBy = new Map<string, number>();
  for (const c of listComplaints(user)) {
    if (c.category === "food_quality") continue;
    if ((c.createdAt ?? "").slice(0, 7) !== period) continue;
    complaintBy.set(c.outletId, (complaintBy.get(c.outletId) ?? 0) + 1);
  }

  return getOutlets()
    .filter((o) => o.active && normName(o.name) !== "head office")
    .map<OpsKpiOutletRow>((o) => {
      const key = normName(o.name);
      const hist = [omzet1.get(key) ?? 0, omzet2.get(key) ?? 0, omzet3.get(key) ?? 0];
      const months = hist.filter((v) => v > 0).length;
      const avg3 = months > 0 ? hist.reduce((a, b) => a + b, 0) / months : 0;

      // Umur outlet: bulan penjualan pertama yang tercatat. Outlet yang sudah
      // berjualan sejak data paling awal dianggap lama — usianya tak terukur
      // dari sini, tapi pasti ≥ rentang data yang kita punya.
      const firstMonth = first.byOutlet.get(key) ?? null;
      const bornInsideWindow = !!firstMonth && !!first.dataStart && firstMonth > first.dataStart;
      const ageMonths = firstMonth ? monthsBetween(firstMonth, period) : 99;
      const tooNew = bornInsideWindow && ageMonths < MIN_OUTLET_MONTHS;
      const noHistory = avg3 <= 0;

      const pur = purchaseBy.get(o.code);
      const pl = pnlBy.get(o.code);

      return {
        outletId: o.id,
        outletCode: o.code,
        outletName: o.name,
        areaId: o.areaId,
        areaName: areas.get(o.areaId) ?? "—",
        avg3,
        targetGs: targetGrossSales(avg3),
        actualGs: omzet0.get(key) ?? 0,
        targetNp: targetNetProfit(avg3),
        actualNp: pl?.laba_bersih ?? 0,
        targetWh: targetWarehouse(avg3),
        actualWh: pur?.warehouse ?? 0,
        targetNonWh: targetNonWarehouse(avg3),
        actualNonWh: pur?.nonWarehouse ?? 0,
        complaints: complaintBy.get(o.id) ?? 0,
        eligible: !tooNew && !noHistory,
        reason: tooNew
          ? `Baru berjalan ${ageMonths} bulan (minimal ${MIN_OUTLET_MONTHS})`
          : noHistory
            ? "Belum ada riwayat omzet 3 bulan"
            : "",
      };
    })
    .sort((a, b) => a.outletName.localeCompare(b.outletName, "id"));
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Susun baris indikator berbobot dari agregat outlet yang memenuhi syarat. */
function buildRows(
  eligible: OpsKpiOutletRow[],
  weights: Record<OpsKpiKey, number>,
  manual: ManualRow,
): OpsKpiRow[] {
  const sum = (f: (r: OpsKpiOutletRow) => number) => eligible.reduce((a, r) => a + f(r), 0);
  const values: Record<OpsKpiKey, { target: number; realisasi: number }> = {
    gross_sales: { target: sum((r) => r.targetGs), realisasi: sum((r) => r.actualGs) },
    net_profit: { target: sum((r) => r.targetNp), realisasi: sum((r) => r.actualNp) },
    complaint: { target: manual.complaintTarget, realisasi: sum((r) => r.complaints) },
    problem_solver: { target: manual.problemSolverTarget, realisasi: manual.problemSolver },
  };

  return OPS_KPI_INDICATORS.map((indicator) => {
    const { target, realisasi } = values[indicator.key];
    const weight = weights[indicator.key] ?? 0;
    const capaian = opsCapaian(indicator, target, realisasi);
    return {
      indicator,
      weight,
      target,
      realisasi,
      selisih: Math.round((realisasi - target) * 100) / 100,
      capaian,
      aktual: opsAktual(weight, capaian),
    };
  });
}

/**
 * Papan KPI satu periode. `areaId` kosong berarti seluruh outlet.
 */
export async function getOpsKpiBoard(period: string, areaId: string, user: UserProfile): Promise<OpsKpiBoard> {
  const [weights, all, manual] = await Promise.all([
    getOpsKpiWeights(),
    outletRows(period, user),
    getManual(period, areaId),
  ]);

  const scoped = areaId ? all.filter((r) => r.areaId === areaId) : all;
  const outlets = scoped.filter((r) => r.eligible);
  const excluded = scoped.filter((r) => !r.eligible);
  const rows = buildRows(outlets, weights, manual);

  const areaList = getAreas();
  const area = areaList.find((a) => a.id === areaId);

  // Tren: lima periode sebelumnya + periode ini, memakai angka manual masing-masing.
  const periods: string[] = [];
  for (let i = 5; i >= 0; i--) periods.push(shiftMonth(period, -i));
  const trend: { period: string; score: number }[] = [];
  for (const p of periods) {
    if (p === period) {
      trend.push({ period: p, score: opsTotalScore(rows) });
      continue;
    }
    const [pRows, pManual] = await Promise.all([outletRows(p, user), getManual(p, areaId)]);
    const pScoped = (areaId ? pRows.filter((r) => r.areaId === areaId) : pRows).filter((r) => r.eligible);
    trend.push({ period: p, score: opsTotalScore(buildRows(pScoped, weights, pManual)) });
  }

  return {
    period,
    areaId,
    areaName: area?.name ?? "Semua Outlet",
    coordinatorName: area?.coordinatorId ? userName(area.coordinatorId) : "—",
    weights,
    rows,
    score: opsTotalScore(rows),
    outlets,
    excluded,
    manual: {
      problemSolver: manual.problemSolver,
      problemSolverTarget: manual.problemSolverTarget,
      complaintTarget: manual.complaintTarget,
      note: manual.note,
    },
    updatedByName: manual.updatedBy ? userName(manual.updatedBy) : null,
    trend,
    areas: areaList.map((a) => ({
      id: a.id,
      name: a.name,
      coordinator: a.coordinatorId ? userName(a.coordinatorId) : "—",
    })),
  };
}
