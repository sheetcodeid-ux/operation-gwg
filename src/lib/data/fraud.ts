import "server-only";

import { fetchBranches, fetchErpDashboard, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";
import { esbConfigured, esbFetchCancelRows, type EsbCancelResult } from "@/lib/integrations/esb-client";
import { fraudStoreEnabled, getFraudRows, getSyncStates, replaceFraudDay, type FraudKindGroup, type FraudSyncState } from "./fraud-store";

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
/** Which transactions to show: void+cancel (default), one of them, or the
 *  separate ESB "Delete Order" report (who removed orders before settle). */
export type FraudKind = "all" | "void" | "cancel" | "delete";

export interface FraudOutletRow {
  branchId: number;
  code: string;
  name: string;
  void: number; // count
  cancel: number; // count
  voidAmount: number; // Rp
  cancelAmount: number; // Rp
}
/** A single void/cancel line-item (ESB order detail) for the drill-down. */
export interface FraudOrder {
  salesNumber: string;
  menu: string;
  category: string;
  orderBy: string;
  orderTime: string;
  voidBy: string;
  voidTime: string;
  type: string; // Void | Cancel
  notes: string;
  qty: number;
  total: number;
}
export interface FraudReport {
  configured: boolean;
  period: FraudPeriod;
  kind: FraudKind;
  from: string;
  to: string;
  label: string;
  source: "esb" | "pos"; // ESB = order-level detail; POS = dashboard aggregate
  totalVoid: number; // count
  totalCancel: number; // count
  totalVoidAmount: number; // Rp
  totalCancelAmount: number; // Rp
  hasAmount: boolean; // Rp values available (else show counts only)
  outlets: FraudOutletRow[];
  perOutletReliable: boolean;
  /** ESB only: void/cancel orders per outlet name (drill-down detail; per
   *  outlet the list is capped — `outlets[].void+cancel` carries true counts). */
  orders?: Record<string, FraudOrder[]>;
  /** ESB only: outlet name → YYYY-MM-DD → nominal, computed server-side from
   *  ALL rows (authoritative for the matrix even when `orders` is capped). */
  daily?: Record<string, Record<string, number>>;
  /** Data loaded but incomplete/soft issue — shown as an amber notice. */
  warning?: string;
  /** DB-cache mode: days in range not yet synced from ESB. Non-empty tells the
   *  client to kick background sync calls until it drains. */
  pendingDays?: string[];
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** ESB timestamp → YYYY-MM-DD (accepts DD-MM-YYYY, DD/MM/YYYY, ISO). */
function dayKey(s: string): string {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}

/** Cap for the per-outlet drill-down list sent to the client (largest first).
 *  Aggregates (daily matrix, totals, counts) always use ALL rows. */
const MAX_ORDERS_PER_OUTLET = 300;
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Today in WIB (ESB's timezone), as YYYY-MM-DD. */
const todayWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Every YYYY-MM-DD in [from, to] (capped defensively at 62). */
function eachYmd(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  while (ymd(d) <= to && out.length < 62) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** How long a live day's sync stays fresh before it's re-pulled. */
const SYNC_TTL_MS = 10 * 60 * 1000;

/** Days in [from, to] that still need an ESB pull: never synced, incomplete,
 *  or synced while the day was still running (WIB) and now older than the TTL.
 *  Days synced AFTER they ended are final — never re-downloaded. */
function pendingSyncDays(states: Map<string, FraudSyncState>, from: string, to: string): string[] {
  const today = todayWib();
  const out: string[] = [];
  for (const day of eachYmd(from, to)) {
    if (day > today) continue; // future — nothing to sync yet
    const s = states.get(day);
    if (!s) { out.push(day); continue; }
    const syncedMs = Date.parse(s.syncedAt);
    // Incomplete days retry, but only after the TTL — a persistently capped
    // ESB export must not spin the background drain in a tight loop.
    if (!s.complete) { if (Date.now() - syncedMs > SYNC_TTL_MS) out.push(day); continue; }
    const dayEndMs = Date.parse(`${day}T17:00:00Z`); // = next 00:00 WIB
    if (syncedMs < dayEndMs && Date.now() - syncedMs > SYNC_TTL_MS) out.push(day);
  }
  return out;
}

const kindGroup = (kind: FraudKind): FraudKindGroup => (kind === "delete" ? "delete" : "cv");

/** Narrow rows to the requested kind. `deleteIsOwnExport` = the rows already
 *  came from the Delete export (no further type filtering needed). */
function filterKind<T extends { type: string }>(rows: T[], kind: FraudKind, deleteIsOwnExport: boolean): T[] {
  if (kind === "void") return rows.filter((x) => /void/i.test(x.type));
  if (kind === "cancel") return rows.filter((x) => /cancel/i.test(x.type) && !/void/i.test(x.type));
  // Deleted items either say delete/remove in the type column or (in the
  // delete-only grid, which has no type column) carry an empty type.
  if (kind === "delete" && !deleteIsOwnExport) return rows.filter((x) => /delete|remove/i.test(x.type) || x.type.trim() === "");
  return rows;
}

/** One ESB line-item as consumed by the aggregator (live or DB-cached). */
type AggRow = {
  branch: string; salesNumber: string; menu: string; menuCategory: string;
  orderBy: string; orderTime: string; voidBy: string; voidTime: string;
  type: string; notes: string; qty: number; total: number;
  /** DB rows carry the day bucket they were synced under (fallback day key). */
  day?: string;
};

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
  return { configured: false, period, kind: "all", from: r.from, to: r.to, label: r.label, source: "pos", totalVoid: 0, totalCancel: 0, totalVoidAmount: 0, totalCancelAmount: 0, hasAmount: false, outlets: [], perOutletReliable: false, ...extra };
}

/** Aggregate ESB line-items (live or DB-cached) into a full FraudReport. */
function aggregate(period: FraudPeriod, kind: FraudKind, r: { from: string; to: string; label: string }, rows: AggRow[]): FraudReport {
  const agg = new Map<string, { void: number; cancel: number; voidAmount: number; cancelAmount: number }>();
  const orders: Record<string, FraudOrder[]> = {};
  const daily: Record<string, Record<string, number>> = {};
  let tv = 0, tc = 0, tva = 0, tca = 0;
  for (const row of rows) {
    const isVoid = /void/i.test(row.type);
    const a = agg.get(row.branch) ?? { void: 0, cancel: 0, voidAmount: 0, cancelAmount: 0 };
    if (isVoid) { a.void += 1; a.voidAmount += row.total; tv += 1; tva += row.total; }
    else { a.cancel += 1; a.cancelAmount += row.total; tc += 1; tca += row.total; }
    agg.set(row.branch, a);
    const day = dayKey(row.voidTime) || dayKey(row.orderTime) || row.day || (r.from === r.to ? r.from : "");
    if (day) {
      const d = (daily[row.branch] ??= {});
      d[day] = (d[day] ?? 0) + row.total;
    }
    (orders[row.branch] ??= []).push({
      salesNumber: row.salesNumber, menu: row.menu, category: row.menuCategory,
      orderBy: row.orderBy, orderTime: row.orderTime, voidBy: row.voidBy, voidTime: row.voidTime,
      type: row.type, notes: row.notes, qty: row.qty, total: row.total,
    });
  }
  // Keep the client payload bounded: drill-down lists ship the largest orders;
  // matrix/totals above are already computed from the full row set.
  for (const name of Object.keys(orders)) {
    if (orders[name].length > MAX_ORDERS_PER_OUTLET) {
      orders[name] = orders[name].sort((a, b) => b.total - a.total).slice(0, MAX_ORDERS_PER_OUTLET);
    }
  }
  const outlets: FraudOutletRow[] = [...agg.entries()]
    .map(([name, a], i) => ({ branchId: i + 1, code: name, name, void: a.void, cancel: a.cancel, voidAmount: a.voidAmount, cancelAmount: a.cancelAmount }))
    .sort((x, y) => y.voidAmount + y.cancelAmount - (x.voidAmount + x.cancelAmount));
  return {
    configured: true, period, kind, from: r.from, to: r.to, label: r.label, source: "esb",
    totalVoid: tv, totalCancel: tc, totalVoidAmount: tva, totalCancelAmount: tca,
    hasAmount: true, outlets, perOutletReliable: true, orders, daily,
  };
}

/** Build the report from a LIVE ESB fetch (no DB cache). */
function esbReport(period: FraudPeriod, kind: FraudKind, r: { from: string; to: string; label: string }, res: EsbCancelResult): FraudReport {
  // The default export carries BOTH Void and Cancel rows — narrow here when a
  // single type is requested. Delete uses its own export when the ESB form
  // offers a delete/remove Type Void option; otherwise the default export was
  // fetched and deleted items are picked out by their type column.
  // Discard rows dated outside the requested range — ESB doesn't always honour
  // the export's date filter (whole history observed on Type Void = Deleted).
  const rows = filterKind(res.rows, kind, res.typeVoidFound).filter((row) => {
    const k = dayKey(row.voidTime) || dayKey(row.orderTime);
    return !k || (k >= r.from && k <= r.to);
  });
  // Diagnose a silent 0: items>0 but nothing parsed ⇒ parser miss; tiny html ⇒
  // empty/blocked response. A genuine empty period stays clean.
  let diag: string | undefined;
  if (res.rows.length === 0 && res.totalItems > 0) diag = `ESB: 0/${res.totalItems} baris ter-parse (htmlLen=${res.rawLen})`;
  else if (res.rows.length === 0 && res.rawLen < 60) diag = `ESB: respons kosong (htmlLen=${res.rawLen})`;
  else if (kind === "delete" && !res.typeVoidFound && rows.length === 0)
    diag = `Form ESB tidak menyediakan filter Delete pada Type Void (opsi terdeteksi: ${res.typeVoidOptions.join(" | ") || "tidak terbaca"}) dan tidak ada baris bertipe delete/remove pada export default (${res.rows.length} baris).`;
  // Incomplete read (ESB truncated/failed pages) must never pass silently —
  // per-day nominal would quietly undercount, which is worse than an error.
  let warning: string | undefined;
  if (res.rows.length > 0 && res.rows.length < res.totalItems) {
    warning = `Baru ${res.rows.length.toLocaleString("id-ID")} dari ${res.totalItems.toLocaleString("id-ID")} baris ESB yang terbaca — nominal periode ini bisa lebih kecil dari sebenarnya. Muat ulang halaman, atau pilih periode yang lebih pendek (mingguan/harian).`;
  }
  return { ...aggregate(period, kind, r, rows), warning, error: diag };
}

/**
 * Sync missing/stale days of the requested period from ESB into the DB cache,
 * newest first, stopping near `budgetMs` so the call fits a serverless slot.
 * Returns how many days remain so the client can keep draining in background.
 */
export async function syncFraudDays(period: FraudPeriod, date: string, kind: FraudKind, budgetMs = 42_000): Promise<{ synced: number; remaining: number; error?: string }> {
  if (!fraudStoreEnabled() || !esbConfigured()) return { synced: 0, remaining: 0 };
  const r = periodRange(period, date);
  const group = kindGroup(kind);
  const states = await getSyncStates(group, r.from, r.to);
  const pending = pendingSyncDays(states, r.from, r.to).sort().reverse(); // newest first
  if (pending.length === 0) return { synced: 0, remaining: 0 };
  const started = Date.now();
  let synced = 0;
  let error: string | undefined;
  // STRICTLY one day at a time: ESB serves a single export per session, and
  // parallel day syncs made it hand back the wrong file (paired days sharing
  // totalItems, ~40% rows kept — verified from fraud_sync bookkeeping).
  const queue = [...pending];
  const syncOne = async (day: string) => {
    const res = await esbFetchCancelRows(day, day, group === "delete" ? "delete" : "default");
    // ESB does NOT always honour the export's date range (observed on Type
    // Void = Deleted, which returns the whole history for any range). Bucket
    // rows by their ACTUAL date and store only the requested day's bucket —
    // stored data is valid no matter what ESB sent back.
    const buckets = new Map<string, typeof res.rows>();
    for (const row of res.rows) {
      const k = dayKey(row.voidTime) || dayKey(row.orderTime) || day;
      const b = buckets.get(k) ?? [];
      b.push(row);
      buckets.set(k, b);
    }
    await replaceFraudDay(group, day, buckets.get(day) ?? [], res.totalItems, res.readAll);
    synced += 1;
    if (!res.readAll) return;
    // The FULL export was read, so every date between the oldest and newest
    // row is fully covered — finalize every still-queued day in that span
    // from the same response (one fetch can complete a whole month when ESB
    // ignored the range; a range-respecting export has span == day, no-op).
    const respDays = [...buckets.keys()].sort();
    if (respDays.length === 0) return;
    const [minDay, maxDay] = [respDays[0], respDays[respDays.length - 1]];
    for (let i = queue.length - 1; i >= 0; i--) {
      const other = queue[i];
      if (other >= minDay && other <= maxDay) {
        queue.splice(i, 1);
        await replaceFraudDay(group, other, buckets.get(other) ?? [], res.totalItems, true);
        synced += 1;
      }
    }
  };
  while (queue.length > 0 && !error && (synced === 0 || Date.now() - started < budgetMs)) {
    const day = queue.shift()!;
    try {
      await syncOne(day);
    } catch (e) {
      // Stop on the first failure (a persistent ESB issue would just burn
      // time); the day stays pending and is retried on the next call.
      error = e instanceof Error ? e.message : "Gagal sinkron data ESB.";
    }
  }
  return { synced, remaining: pending.length - synced, error };
}

export async function getFraudReport(period: FraudPeriod, date: string, kind: FraudKind = "all"): Promise<FraudReport> {
  const r = periodRange(period, date);

  // DB-cache first: reports render instantly from synced rows; days not yet
  // synced are reported via pendingDays so the client drains them in the
  // background (syncFraudDays) instead of blocking this request on ESB.
  if (fraudStoreEnabled() && esbConfigured()) {
    try {
      const group = kindGroup(kind);
      const [rowsDb, states] = await Promise.all([getFraudRows(group, r.from, r.to), getSyncStates(group, r.from, r.to)]);
      const pending = pendingSyncDays(states, r.from, r.to);
      const report = aggregate(period, kind, r, filterKind(rowsDb, kind, group === "delete"));
      report.pendingDays = pending;
      if (pending.length > 0) {
        report.warning = `${pending.length} hari dalam periode ini belum tersinkron dari ESB — data sedang diambil otomatis, angka akan bertambah sendiri.`;
      }
      return report;
    } catch {
      // DB hiccup — fall through to the live ESB path below.
    }
  }

  // Prefer ESB — it gives real per-outlet nominal + order-level detail. Falls
  // back to the POS dashboard aggregate if ESB isn't configured or errors.
  // ESB is authoritative when configured (order-level detail). Its errors are
  // surfaced (not hidden behind a POS fallback) so misconfig is diagnosable.
  if (esbConfigured()) {
    try {
      const res = await esbFetchCancelRows(r.from, r.to, kind === "delete" ? "delete" : "default");
      return esbReport(period, kind, r, res);
    } catch (e) {
      return base(period, r, { configured: true, source: "esb", kind, error: e instanceof Error ? e.message : "Gagal memuat data ESB." });
    }
  }

  // The POS dashboard has no delete-order data and no void/cancel split filter.
  if (kind === "delete") return base(period, r, { configured: true, kind, error: "Data Delete Order hanya tersedia dari ESB — aktifkan integrasi ESB." });
  if (!gwgmanageConfigured()) return base(period, r, { kind, error: "Integrasi POS belum dikonfigurasi." });

  try {
    // The POS dashboard takes period=daily&date for a single day; a range uses
    // dateFrom/dateTo (weekly/monthly).
    const range = r.from === r.to ? { date: r.from } : { dateFrom: r.from, dateTo: r.to };
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

    // POS can't split void vs cancel per request — zero the unselected metric.
    const keepV = kind !== "cancel";
    const keepC = kind !== "void";
    return {
      configured: true, period, kind, from: r.from, to: r.to, label: r.label, source: "pos",
      totalVoid: keepV ? totalVoid : 0, totalCancel: keepC ? totalCancel : 0,
      totalVoidAmount: keepV ? totalVoidAmount : 0, totalCancelAmount: keepC ? totalCancelAmount : 0,
      hasAmount,
      outlets: outlets.map((o) => ({ ...o, void: keepV ? o.void : 0, cancel: keepC ? o.cancel : 0, voidAmount: keepV ? o.voidAmount : 0, cancelAmount: keepC ? o.cancelAmount : 0 })),
      perOutletReliable,
    };
  } catch (e) {
    return base(period, r, { configured: true, kind, error: e instanceof Error ? e.message : "Gagal memuat data POS." });
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
