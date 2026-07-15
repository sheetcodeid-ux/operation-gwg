import "server-only";

import { fetchBranches, fetchErpDashboard, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";

/**
 * Fraud (Void & Cancel) analysis sourced from the POS dashboard endpoint.
 *
 * Void/cancel counts are read from /api/reports/dashboard over a period (daily
 * = one date, weekly/monthly = a dateFrom/dateTo range). Per-outlet figures use
 * the optional branchId param; because we can't assume the POS honours it, the
 * result is self-validated: if the per-branch numbers just echo the all-outlet
 * total (branchId ignored) we mark the breakdown unreliable and the UI shows the
 * aggregate only — so a management report never carries misleading per-outlet
 * numbers.
 */

export type FraudPeriod = "daily" | "weekly" | "monthly";

export interface FraudOutletRow {
  branchId: number;
  code: string;
  name: string;
  void: number; // count
  cancel: number; // count
  voidAmount: number; // Rp
  cancelAmount: number; // Rp
}
export interface FraudReport {
  configured: boolean;
  period: FraudPeriod;
  from: string;
  to: string;
  label: string;
  totalVoid: number; // count
  totalCancel: number; // count
  totalVoidAmount: number; // Rp
  totalCancelAmount: number; // Rp
  hasAmount: boolean; // POS returned Rp values (else show counts only)
  outlets: FraudOutletRow[];
  perOutletReliable: boolean;
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** [from, to, label] for a period anchored on `date` (YYYY-MM-DD). */
export function periodRange(period: FraudPeriod, date: string): { from: string; to: string; label: string } {
  const d = new Date(`${date}T00:00:00`);
  if (period === "daily") {
    return { from: date, to: date, label: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  }
  if (period === "weekly") {
    // Week-of-month blocks: Minggu 1 = 1–7, 2 = 8–14, … (last may be short).
    const Y = d.getFullYear();
    const M = d.getMonth();
    const daysInMonth = new Date(Y, M + 1, 0).getDate();
    const index = Math.floor((d.getDate() - 1) / 7);
    const start = index * 7 + 1;
    const end = Math.min(start + 6, daysInMonth);
    return {
      from: ymd(new Date(Y, M, start)),
      to: ymd(new Date(Y, M, end)),
      label: `Minggu ${index + 1} · ${start}–${end} ${MONTHS[M]} ${Y}`,
    };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: ymd(first), to: ymd(last), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}

function base(period: FraudPeriod, r: { from: string; to: string; label: string }, extra: Partial<FraudReport> = {}): FraudReport {
  return { configured: false, period, from: r.from, to: r.to, label: r.label, totalVoid: 0, totalCancel: 0, totalVoidAmount: 0, totalCancelAmount: 0, hasAmount: false, outlets: [], perOutletReliable: false, ...extra };
}

export async function getFraudReport(period: FraudPeriod, date: string): Promise<FraudReport> {
  const r = periodRange(period, date);
  if (!gwgmanageConfigured()) return base(period, r, { error: "Integrasi POS belum dikonfigurasi." });

  try {
    const range = { dateFrom: r.from, dateTo: r.to };
    const [globalRes, branches] = await Promise.all([fetchErpDashboard(range), fetchBranches()]);
    const totalVoid = globalRes.totalVoid;
    const totalCancel = globalRes.totalCancelled;
    const totalVoidAmount = globalRes.voidAmount;
    const totalCancelAmount = globalRes.cancelAmount;
    const hasAmount = totalVoidAmount > 0 || totalCancelAmount > 0;

    // Per-branch (best effort). Skip entirely if there are no branches.
    const perBranch = await Promise.allSettled(
      branches.map((b) => fetchErpDashboard({ ...range, branchId: b.branchId || b.id })),
    );
    const rows: FraudOutletRow[] = branches.map((b, i) => {
      const res = perBranch[i];
      const v = res.status === "fulfilled" ? res.value : null;
      return {
        branchId: b.branchId || b.id,
        code: b.code,
        name: b.name,
        void: v?.totalVoid ?? 0,
        cancel: v?.totalCancelled ?? 0,
        voidAmount: v?.voidAmount ?? 0,
        cancelAmount: v?.cancelAmount ?? 0,
      };
    });

    // Score combines counts + amounts so the check works whichever the POS gives.
    const score = (o: { void: number; cancel: number; voidAmount: number; cancelAmount: number }) =>
      o.void + o.cancel + o.voidAmount + o.cancelAmount;
    const globalScore = totalVoid + totalCancel + totalVoidAmount + totalCancelAmount;
    // Reliable only if the per-branch numbers PARTITION the total (sum ≈ global).
    // If branchId is ignored every branch echoes the global total → sum ≫ global.
    const sum = rows.reduce((a, o) => a + score(o), 0);
    const echoed = branches.length > 1 && rows.every((o) => o.void === totalVoid && o.cancel === totalCancel && o.voidAmount === totalVoidAmount && o.cancelAmount === totalCancelAmount);
    const perOutletReliable = branches.length > 0 && globalScore > 0 && !echoed && sum <= globalScore * 1.5;

    const outlets = perOutletReliable
      ? rows.filter((o) => score(o) > 0).sort((a, b) => score(b) - score(a))
      : [];

    return { configured: true, period, from: r.from, to: r.to, label: r.label, totalVoid, totalCancel, totalVoidAmount, totalCancelAmount, hasAmount, outlets, perOutletReliable };
  } catch (e) {
    return base(period, r, { configured: true, error: e instanceof Error ? e.message : "Gagal memuat data POS." });
  }
}

export interface FraudDailyPoint {
  date: string;
  label: string;
  void: number;
  cancel: number;
  voidAmount: number;
  cancelAmount: number;
}

/** Per-day void/cancel for ONE outlet across the range (drill-down detail). */
export async function getOutletFraudDaily(branchId: number, from: string, to: string): Promise<FraudDailyPoint[]> {
  if (!gwgmanageConfigured()) return [];
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00`); ymd(d) <= to && days.length < 40; d.setDate(d.getDate() + 1)) days.push(ymd(d));
  const res = await Promise.allSettled(days.map((day) => fetchErpDashboard({ date: day, branchId })));
  return days.map((day, i) => {
    const v = res[i].status === "fulfilled" ? (res[i] as PromiseFulfilledResult<Awaited<ReturnType<typeof fetchErpDashboard>>>).value : null;
    const dt = new Date(`${day}T00:00:00`);
    return { date: day, label: `${dt.getDate()} ${MONTHS[dt.getMonth()].slice(0, 3)}`, void: v?.totalVoid ?? 0, cancel: v?.totalCancelled ?? 0, voidAmount: v?.voidAmount ?? 0, cancelAmount: v?.cancelAmount ?? 0 };
  });
}
