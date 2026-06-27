/**
 * Repository layer over the seed dataset.
 *
 * Every read the UI performs goes through these functions. In Phase 11 the
 * bodies are reimplemented against Supabase while signatures stay stable, so
 * pages and server actions never change.
 */

import { scopeOutlets } from "../rbac";
import type {
  Area,
  Complaint,
  HospitalityAssessment,
  HygieneAudit,
  OpsEvent,
  Outlet,
  UserProfile,
  WorkTask,
} from "../types";
import { SEED } from "./seed";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------------- org lookups ---------------- */
export function getAreas(): Area[] {
  return SEED.areas;
}
export function getOutlets(): Outlet[] {
  return SEED.outlets;
}
export function getUsers(): UserProfile[] {
  return SEED.users;
}
export function getUser(id: string): UserProfile | undefined {
  return SEED.users.find((u) => u.id === id);
}
export function getOutlet(id: string): Outlet | undefined {
  return SEED.outlets.find((o) => o.id === id);
}
export function getArea(id: string): Area | undefined {
  return SEED.areas.find((a) => a.id === id);
}
export function outletName(id: string): string {
  return getOutlet(id)?.name ?? "—";
}
export function areaName(id: string): string {
  return getArea(id)?.name ?? "—";
}
export function userName(id: string): string {
  return getUser(id)?.name ?? "—";
}

/** Outlets visible to a given user (row-level scoping). */
export function visibleOutlets(user: UserProfile): Outlet[] {
  return scopeOutlets(user, SEED.outlets);
}
function visibleOutletIdSet(user: UserProfile): Set<string> {
  return new Set(visibleOutlets(user).map((o) => o.id));
}

/* ---------------- scoped module reads ---------------- */
export function listHospitality(user: UserProfile): HospitalityAssessment[] {
  const ids = visibleOutletIdSet(user);
  return SEED.hospitality.filter((h) => ids.has(h.outletId)).sort(byDateDesc("date"));
}
export function listTasks(user: UserProfile): WorkTask[] {
  const ids = visibleOutletIdSet(user);
  return SEED.tasks.filter((t) => t.outletId === null || ids.has(t.outletId)).sort(byDateDesc("createdAt"));
}
export function listEvents(user: UserProfile): OpsEvent[] {
  const ids = visibleOutletIdSet(user);
  return SEED.events.filter((e) => ids.has(e.outletId)).sort(byDateDesc("startDate"));
}
export function listHygiene(user: UserProfile): HygieneAudit[] {
  const ids = visibleOutletIdSet(user);
  return SEED.hygiene.filter((h) => ids.has(h.outletId)).sort(byDateDesc("date"));
}
export function listComplaints(user: UserProfile): Complaint[] {
  const ids = visibleOutletIdSet(user);
  return SEED.complaints.filter((c) => ids.has(c.outletId)).sort(byDateDesc("createdAt"));
}
export function listNotifications(user: UserProfile) {
  const ids = visibleOutletIdSet(user);
  return SEED.notifications.filter((n) => !n.outletId || ids.has(n.outletId));
}

function byDateDesc<T>(key: keyof T) {
  return (a: T, b: T) => +new Date(b[key] as string) - +new Date(a[key] as string);
}

/* ---------------- score helpers ---------------- */
function latestByOutlet<T extends { outletId: string; date?: string; createdAt?: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const it of items) {
    const cur = map.get(it.outletId);
    const t = +new Date((it.date ?? it.createdAt) as string);
    if (!cur || t > +new Date((cur.date ?? cur.createdAt) as string)) map.set(it.outletId, it);
  }
  return map;
}

export function hospitalityScoreFor(outletId: string): number {
  const xs = SEED.hospitality.filter((h) => h.outletId === outletId).map((h) => h.overallScore);
  return round1(avg(xs));
}
export function hygieneScoreFor(outletId: string): number {
  const xs = SEED.hygiene.filter((h) => h.outletId === outletId).map((h) => h.hygieneScore);
  return round1(avg(xs));
}

/* ---------------- dashboard KPIs ---------------- */
export interface DashboardKpis {
  totalOutlets: number;
  totalAreas: number;
  hospitalityScore: number;
  hygieneScore: number;
  complaintsOpen: number;
  complaintsClosed: number;
  taskCompletionRate: number;
  eventProgress: number;
}

export function getDashboardKpis(user: UserProfile): DashboardKpis {
  const outlets = visibleOutlets(user);
  const ids = new Set(outlets.map((o) => o.id));
  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId));
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const tsk = SEED.tasks.filter((t) => t.outletId === null || ids.has(t.outletId));
  const evt = SEED.events.filter((e) => ids.has(e.outletId));

  const done = tsk.filter((t) => t.status === "done").length;
  const closed = comp.filter((c) => c.status === "closed" || c.status === "done").length;
  const open = comp.length - closed;

  return {
    totalOutlets: outlets.length,
    totalAreas: new Set(outlets.map((o) => o.areaId)).size,
    hospitalityScore: round1(avg(hosp.map((h) => h.overallScore))),
    hygieneScore: round1(avg(hyg.map((h) => h.hygieneScore))),
    complaintsOpen: open,
    complaintsClosed: closed,
    taskCompletionRate: tsk.length ? Math.round((done / tsk.length) * 100) : 0,
    eventProgress: evt.length ? Math.round(avg(evt.map((e) => e.progress))) : 0,
  };
}

/* ---------------- period-aware KPIs (real deltas vs previous window) ---------------- */
export type PeriodKey = "week" | "month" | "quarter";
const PERIOD_DAYS: Record<PeriodKey, number> = { week: 7, month: 30, quarter: 90 };
export const NOW = +new Date("2026-06-23T23:59:59Z");

export interface PeriodKpis extends DashboardKpis {
  complaintsReceived: number;
  complaintsResolved: number;
  tasksCompleted: number;
  deltas: {
    hospitality: number;
    hygiene: number;
    complaintsReceived: number;
    complaintsResolved: number;
    tasksCompleted: number;
  };
}

function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / prev) * 100);
}

export function getDashboardKpisWithPeriod(user: UserProfile, period: PeriodKey): PeriodKpis {
  const base = getDashboardKpis(user);
  const ids = new Set(visibleOutlets(user).map((o) => o.id));
  const days = PERIOD_DAYS[period];
  const win = days * 86_400_000;
  const curStart = NOW - win;
  const prevStart = NOW - 2 * win;

  const inWin = (t: number, start: number, end: number) => t >= start && t < end;

  const avgIn = (records: { date: string; v: number }[], start: number, end: number) => {
    const xs = records.filter((r) => inWin(+new Date(r.date), start, end)).map((r) => r.v);
    return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
  };

  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => ({ date: h.date, v: h.overallScore }));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => ({ date: h.date, v: h.hygieneScore }));
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const tasks = SEED.tasks.filter((t) => t.outletId !== null && ids.has(t.outletId));

  const hospCur = avgIn(hosp, curStart, NOW) || base.hospitalityScore;
  const hospPrev = avgIn(hosp, prevStart, curStart);
  const hygCur = avgIn(hyg, curStart, NOW) || base.hygieneScore;
  const hygPrev = avgIn(hyg, prevStart, curStart);

  const recCur = comp.filter((c) => inWin(+new Date(c.createdAt), curStart, NOW)).length;
  const recPrev = comp.filter((c) => inWin(+new Date(c.createdAt), prevStart, curStart)).length;
  const resCur = comp.filter((c) => c.closedAt && inWin(+new Date(c.closedAt), curStart, NOW)).length;
  const resPrev = comp.filter((c) => c.closedAt && inWin(+new Date(c.closedAt), prevStart, curStart)).length;
  const tcCur = tasks.filter((t) => t.completionDate && inWin(+new Date(t.completionDate), curStart, NOW)).length;
  const tcPrev = tasks.filter((t) => t.completionDate && inWin(+new Date(t.completionDate), prevStart, curStart)).length;

  return {
    ...base,
    hospitalityScore: hospCur,
    hygieneScore: hygCur,
    complaintsReceived: recCur,
    complaintsResolved: resCur,
    tasksCompleted: tcCur,
    deltas: {
      hospitality: pctDelta(hospCur, hospPrev),
      hygiene: pctDelta(hygCur, hygPrev),
      complaintsReceived: pctDelta(recCur, recPrev),
      complaintsResolved: pctDelta(resCur, resPrev),
      tasksCompleted: pctDelta(tcCur, tcPrev),
    },
  };
}

/* ---------------- rankings ---------------- */
export interface OutletRankRow {
  outlet: Outlet;
  hospitality: number;
  hygiene: number;
  complaints: number;
  composite: number;
}

export function outletRanking(user: UserProfile): OutletRankRow[] {
  const outlets = visibleOutlets(user);
  const hospLatest = latestByOutlet(SEED.hospitality);
  const hygLatest = latestByOutlet(SEED.hygiene);
  const complaintsByOutlet = new Map<string, number>();
  for (const c of SEED.complaints) {
    if (c.status !== "closed" && c.status !== "done") {
      complaintsByOutlet.set(c.outletId, (complaintsByOutlet.get(c.outletId) ?? 0) + 1);
    }
  }
  return outlets
    .map((outlet) => {
      const hospitality = round1(hospLatest.get(outlet.id)?.overallScore ?? 0);
      const hygiene = round1(hygLatest.get(outlet.id)?.hygieneScore ?? 0);
      const complaints = complaintsByOutlet.get(outlet.id) ?? 0;
      const composite = round1(hospitality * 0.45 + hygiene * 0.45 - complaints * 2);
      return { outlet, hospitality, hygiene, complaints, composite };
    })
    .sort((a, b) => b.composite - a.composite);
}

/** Ranked outlet with scores computed inside a date window (fallback to latest), plus area + coordinator name. */
export interface RankedOutletRow {
  outlet: Outlet;
  area: string;
  coordinator: string;
  hospitality: number;
  hygiene: number;
  complaints: number;
  composite: number;
}

export function outletRankingInRange(outletIds: string[], endMs: number, days: number): RankedOutletRow[] {
  const idSet = new Set(outletIds);
  const outlets = SEED.outlets.filter((o) => idSet.has(o.id));
  const startMs = endMs - days * 86_400_000;
  const inWin = (t: number) => t >= startMs && t <= endMs;

  const hospLatest = latestByOutlet(SEED.hospitality);
  const hygLatest = latestByOutlet(SEED.hygiene);

  const coordOf = new Map<string, string>();
  for (const u of SEED.users) {
    if (u.role === "area_coordinator") for (const oid of u.outletIds ?? []) coordOf.set(oid, u.name);
  }

  return outlets
    .map((outlet) => {
      const hosp = SEED.hospitality
        .filter((h) => h.outletId === outlet.id && inWin(+new Date(h.date)))
        .map((h) => h.overallScore);
      const hyg = SEED.hygiene
        .filter((h) => h.outletId === outlet.id && inWin(+new Date(h.date)))
        .map((h) => h.hygieneScore);
      const hospitality = round1(hosp.length ? avg(hosp) : hospLatest.get(outlet.id)?.overallScore ?? 0);
      const hygiene = round1(hyg.length ? avg(hyg) : hygLatest.get(outlet.id)?.hygieneScore ?? 0);
      const complaints = SEED.complaints.filter((c) => c.outletId === outlet.id && inWin(+new Date(c.createdAt))).length;
      const composite = round1(hospitality * 0.45 + hygiene * 0.45 - complaints * 2);
      return {
        outlet,
        area: getArea(outlet.areaId)?.name ?? "—",
        coordinator: coordOf.get(outlet.id) ?? "—",
        hospitality,
        hygiene,
        complaints,
        composite,
      };
    })
    .sort((a, b) => b.composite - a.composite);
}

export interface AreaRankRow {
  area: Area;
  outlets: number;
  hospitality: number;
  hygiene: number;
  complaintsOpen: number;
  composite: number;
}

export function areaRanking(user: UserProfile): AreaRankRow[] {
  const outlets = visibleOutlets(user);
  const byArea = new Map<string, Outlet[]>();
  for (const o of outlets) byArea.set(o.areaId, [...(byArea.get(o.areaId) ?? []), o]);

  return [...byArea.entries()]
    .map(([areaId, areaOutlets]) => {
      const ids = new Set(areaOutlets.map((o) => o.id));
      const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => h.overallScore);
      const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => h.hygieneScore);
      const complaintsOpen = SEED.complaints.filter(
        (c) => ids.has(c.outletId) && c.status !== "closed" && c.status !== "done",
      ).length;
      const hospitality = round1(avg(hosp));
      const hygiene = round1(avg(hyg));
      return {
        area: getArea(areaId)!,
        outlets: areaOutlets.length,
        hospitality,
        hygiene,
        complaintsOpen,
        composite: round1(hospitality * 0.5 + hygiene * 0.5 - complaintsOpen * 0.5),
      };
    })
    .sort((a, b) => b.composite - a.composite);
}

/* ---------------- trends (last N days, bucketed weekly) ---------------- */
export function complaintTrend(user: UserProfile, weeks = 8) {
  const ids = visibleOutletIdSet(user);
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const now = +new Date("2026-06-23T00:00:00Z");
  const week = 7 * 86_400_000;
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = now - (weeks - i) * week;
    const end = start + week;
    const received = comp.filter((c) => {
      const t = +new Date(c.createdAt);
      return t >= start && t < end;
    }).length;
    const resolved = comp.filter((c) => c.closedAt && +new Date(c.closedAt) >= start && +new Date(c.closedAt) < end).length;
    return { label: `W${i + 1}`, received, resolved };
  });
  return buckets;
}

export function complaintsByCategory(user: UserProfile) {
  const ids = visibleOutletIdSet(user);
  const counts = new Map<string, number>();
  for (const c of SEED.complaints) {
    if (!ids.has(c.outletId)) continue;
    counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
  }
  return counts;
}

/* ---------------- Complaint comparison (this period vs previous) ---------------- */
export interface DayComparePoint {
  label: string; // day-of-month "1".."31"
  current: number; // received in selected month on this day
  previous: number; // received on same day-of-month, previous month
  weekend: boolean; // Sat/Sun in the selected month
}
export interface MonthComparePoint {
  label: string; // "Jan".."Dec"
  current: number; // received in this month
  previous: number; // received in the preceding month (rolling)
}
export interface ComplaintCompareData {
  year: number;
  defaultMonth: number; // 0-11
  months: { month: number; label: string; days: DayComparePoint[] }[];
  yearly: MonthComparePoint[];
}

/** Combo-chart data for the Complaint Trend card (scoped to outletIds). "Received" = complaint createdAt. */
export function complaintCompareData(outletIds: string[]): ComplaintCompareData {
  const ids = new Set(outletIds);
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const created = comp.map((c) => +new Date(c.createdAt));
  const countIn = (start: number, end: number) => created.filter((t) => t >= start && t < end).length;

  const year = new Date(NOW).getUTCFullYear();
  const defaultMonth = new Date(NOW).getUTCMonth();

  const dayCount = (y: number, m: number, d: number) => countIn(Date.UTC(y, m, d), Date.UTC(y, m, d + 1));
  const monthCount = (y: number, m: number) => countIn(Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1));

  const months = Array.from({ length: 12 }, (_, m) => {
    const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const prevY = m === 0 ? year - 1 : year;
    const prevM = m === 0 ? 11 : m - 1;
    const prevDays = new Date(Date.UTC(prevY, prevM + 1, 0)).getUTCDate();
    const days: DayComparePoint[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(Date.UTC(year, m, d)).getUTCDay();
      days.push({
        label: String(d),
        current: dayCount(year, m, d),
        previous: d <= prevDays ? dayCount(prevY, prevM, d) : 0,
        weekend: dow === 0 || dow === 6,
      });
    }
    return { month: m, label: new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), days };
  });

  const yearly: MonthComparePoint[] = Array.from({ length: 12 }, (_, m) => {
    const prevY = m === 0 ? year - 1 : year;
    const prevM = m === 0 ? 11 : m - 1;
    return {
      label: new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      current: monthCount(year, m),
      previous: monthCount(prevY, prevM),
    };
  });

  return { year, defaultMonth, months, yearly };
}

/* ---------------- analytics aggregations ---------------- */
export interface AreaMetricRow {
  area: Area;
  hospitality: number;
  hygiene: number;
  taskCompletion: number;
  resolution: number;
}

/** Per-area matrix used by the analytics heatmap. */
export function areaMetricMatrix(user: UserProfile): AreaMetricRow[] {
  const outlets = visibleOutlets(user);
  const byArea = new Map<string, Outlet[]>();
  for (const o of outlets) byArea.set(o.areaId, [...(byArea.get(o.areaId) ?? []), o]);

  return [...byArea.entries()]
    .map(([areaId, areaOutlets]) => {
      const ids = new Set(areaOutlets.map((o) => o.id));
      const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => h.overallScore);
      const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => h.hygieneScore);
      const tasks = SEED.tasks.filter((t) => t.outletId !== null && ids.has(t.outletId));
      const done = tasks.filter((t) => t.status === "done").length;
      const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
      const closed = comp.filter((c) => c.status === "closed" || c.status === "done").length;
      return {
        area: getArea(areaId)!,
        hospitality: round1(avg(hosp)),
        hygiene: round1(avg(hyg)),
        taskCompletion: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        resolution: comp.length ? Math.round((closed / comp.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.hospitality - a.hospitality);
}

/** Weekly average hospitality & hygiene (carry-forward when a week is empty). */
export function scoreTrend(user: UserProfile, weeks = 8) {
  const ids = visibleOutletIdSet(user);
  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId));
  const now = +new Date("2026-06-23T00:00:00Z");
  const week = 7 * 86_400_000;

  let lastHosp = round1(avg(hosp.map((h) => h.overallScore))) || 80;
  let lastHyg = round1(avg(hyg.map((h) => h.hygieneScore))) || 80;

  return Array.from({ length: weeks }, (_, i) => {
    const start = now - (weeks - i) * week;
    const end = start + week;
    const inWeek = <T extends { date: string }>(xs: T[]) =>
      xs.filter((x) => +new Date(x.date) >= start && +new Date(x.date) < end);
    const h = inWeek(hosp).map((x) => x.overallScore);
    const g = inWeek(hyg).map((x) => x.hygieneScore);
    if (h.length) lastHosp = round1(avg(h));
    if (g.length) lastHyg = round1(avg(g));
    return { label: `W${i + 1}`, hospitality: lastHosp, hygiene: lastHyg };
  });
}

/* ---------------- Outlet 360° ---------------- */
export interface OutletDetail {
  outlet: Outlet;
  areaName: string;
  supervisorName: string;
  picName: string;
  coordinatorName: string;
  hospitality: number;
  hygiene: number;
  tasksOpen: number;
  tasksDone: number;
  taskCompletion: number;
  complaintsOpen: number;
  eventsRunning: number;
  tasks: WorkTask[];
  events: OpsEvent[];
  hygieneAudits: HygieneAudit[];
  complaints: Complaint[];
  hospitalityAssessments: HospitalityAssessment[];
}

export function getOutletDetail(outletId: string): OutletDetail | null {
  const outlet = getOutlet(outletId);
  if (!outlet) return null;
  const tasks = SEED.tasks.filter((t) => t.outletId === outletId).sort(byDateDesc("createdAt"));
  const events = SEED.events.filter((e) => e.outletId === outletId).sort(byDateDesc("startDate"));
  const hygieneAudits = SEED.hygiene.filter((h) => h.outletId === outletId).sort(byDateDesc("date"));
  const complaints = SEED.complaints.filter((c) => c.outletId === outletId).sort(byDateDesc("createdAt"));
  const hospitalityAssessments = SEED.hospitality.filter((h) => h.outletId === outletId).sort(byDateDesc("date"));
  const done = tasks.filter((t) => t.status === "done").length;
  const area = getArea(outlet.areaId);
  return {
    outlet,
    areaName: area?.name ?? "—",
    supervisorName: userName(outlet.supervisorId),
    picName: userName(outlet.picId),
    coordinatorName: area ? userName(area.coordinatorId) : "—",
    hospitality: hospitalityScoreFor(outletId),
    hygiene: hygieneScoreFor(outletId),
    tasksOpen: tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
    tasksDone: done,
    taskCompletion: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    complaintsOpen: complaints.filter((c) => c.status !== "closed" && c.status !== "done").length,
    eventsRunning: events.filter((e) => e.status === "running").length,
    tasks,
    events,
    hygieneAudits,
    complaints,
    hospitalityAssessments,
  };
}

/* ---------------- Reports: month-over-month comparison ---------------- */
export interface MetricCompare {
  cur: number;
  prev: number;
  delta: number;
}
export interface ReportData {
  hospitality: MetricCompare;
  hygiene: MetricCompare;
  complaintsReceived: MetricCompare;
  complaintsResolved: MetricCompare;
  tasksCompleted: MetricCompare;
  perOutlet: { name: string; code: string; hospCur: number; hospPrev: number; hygCur: number; hygPrev: number }[];
}

/** Current window vs previous equal window across a set of outlets (default 30 days, ending NOW). */
export function reportPeriodCompare(outletIds: string[], days = 30, endMs = NOW): ReportData {
  const ids = new Set(outletIds);
  const win = days * 86_400_000;
  const end = endMs;
  const curStart = end - win;
  const prevStart = end - 2 * win;
  const inW = (t: number, s: number, e: number) => t >= s && t < e;
  const avg2 = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);

  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId));
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const tasks = SEED.tasks.filter((t) => t.outletId !== null && ids.has(t.outletId));

  const mc = (cur: number, prev: number): MetricCompare => ({ cur, prev, delta: pctDelta(cur, prev) });
  const avgWin = (recs: { date: string; v: number }[], s: number, e: number) =>
    avg2(recs.filter((r) => inW(+new Date(r.date), s, e)).map((r) => r.v));

  const hospRecs = hosp.map((h) => ({ date: h.date, v: h.overallScore }));
  const hygRecs = hyg.map((h) => ({ date: h.date, v: h.hygieneScore }));

  const perOutlet = outletIds
    .map((id) => getOutlet(id))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((o) => {
      const h = hosp.filter((x) => x.outletId === o.id).map((x) => ({ date: x.date, v: x.overallScore }));
      const g = hyg.filter((x) => x.outletId === o.id).map((x) => ({ date: x.date, v: x.hygieneScore }));
      return {
        name: o.name,
        code: o.code,
        hospCur: avgWin(h, curStart, end) || hospitalityScoreFor(o.id),
        hospPrev: avgWin(h, prevStart, curStart),
        hygCur: avgWin(g, curStart, end) || hygieneScoreFor(o.id),
        hygPrev: avgWin(g, prevStart, curStart),
      };
    });

  return {
    hospitality: mc(avgWin(hospRecs, curStart, end) || avg2(hospRecs.map((r) => r.v)), avgWin(hospRecs, prevStart, curStart)),
    hygiene: mc(avgWin(hygRecs, curStart, end) || avg2(hygRecs.map((r) => r.v)), avgWin(hygRecs, prevStart, curStart)),
    complaintsReceived: mc(
      comp.filter((c) => inW(+new Date(c.createdAt), curStart, end)).length,
      comp.filter((c) => inW(+new Date(c.createdAt), prevStart, curStart)).length,
    ),
    complaintsResolved: mc(
      comp.filter((c) => c.closedAt && inW(+new Date(c.closedAt), curStart, end)).length,
      comp.filter((c) => c.closedAt && inW(+new Date(c.closedAt), prevStart, curStart)).length,
    ),
    tasksCompleted: mc(
      tasks.filter((t) => t.completionDate && inW(+new Date(t.completionDate), curStart, end)).length,
      tasks.filter((t) => t.completionDate && inW(+new Date(t.completionDate), prevStart, curStart)).length,
    ),
    perOutlet,
  };
}

/* ---------------- Reports: aggregation over a set of outlets ---------------- */
export interface OutletsAggregate {
  outlets: number;
  hospitality: number;
  hygiene: number;
  tasksTotal: number;
  tasksDone: number;
  taskCompletion: number;
  complaintsTotal: number;
  complaintsOpen: number;
  complaintsClosed: number;
  resolution: number;
  eventsTotal: number;
  eventsRunning: number;
  totalBudget: number;
}

export function aggregateOutlets(outletIds: string[]): OutletsAggregate {
  const ids = new Set(outletIds);
  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => h.overallScore);
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => h.hygieneScore);
  const tasks = SEED.tasks.filter((t) => t.outletId !== null && ids.has(t.outletId));
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const closed = comp.filter((c) => c.status === "closed" || c.status === "done").length;
  const events = SEED.events.filter((e) => ids.has(e.outletId));
  return {
    outlets: ids.size,
    hospitality: round1(avg(hosp)),
    hygiene: round1(avg(hyg)),
    tasksTotal: tasks.length,
    tasksDone,
    taskCompletion: tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0,
    complaintsTotal: comp.length,
    complaintsOpen: comp.length - closed,
    complaintsClosed: closed,
    resolution: comp.length ? Math.round((closed / comp.length) * 100) : 0,
    eventsTotal: events.length,
    eventsRunning: events.filter((e) => e.status === "running").length,
    totalBudget: events.reduce((a, b) => a + b.budget, 0),
  };
}

/** Per-outlet rows (scoped) for report listings. */
export function outletReportRows(user: UserProfile) {
  return visibleOutlets(user).map((o) => ({
    outlet: o,
    areaName: areaName(o.areaId),
    hospitality: hospitalityScoreFor(o.id),
    hygiene: hygieneScoreFor(o.id),
  }));
}

/** Area coordinators visible to the user, with their assigned-outlet aggregate. */
export function coordinatorReportRows(user: UserProfile) {
  const visibleIds = new Set(visibleOutlets(user).map((o) => o.id));
  return SEED.users
    .filter((u) => u.role === "area_coordinator")
    .map((c) => {
      const outletIds = (c.outletIds ?? []).filter((id) => visibleIds.has(id));
      return { coordinator: c, outletIds, agg: aggregateOutlets(outletIds) };
    })
    .filter((r) => r.outletIds.length > 0);
}

/** Areas visible to the user, with aggregate. */
export function areaReportRows(user: UserProfile) {
  const visible = visibleOutlets(user);
  const byArea = new Map<string, string[]>();
  for (const o of visible) byArea.set(o.areaId, [...(byArea.get(o.areaId) ?? []), o.id]);
  return [...byArea.entries()].map(([areaId, outletIds]) => ({
    area: getArea(areaId)!,
    outletIds,
    agg: aggregateOutlets(outletIds),
  }));
}

/* ---------------- Performance Metrics (monthly completion tracking) ---------------- */
export interface MonthPoint {
  label: string;
  value: number;
}
export function monthlyPerformance(outletIds: string[]): {
  points: MonthPoint[];
  avg: number;
  aboveTarget: number;
  best: string;
  target: number;
} {
  const ids = new Set(outletIds);
  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId));
  const overall = round1(avg([...hosp.map((h) => h.overallScore), ...hyg.map((h) => h.hygieneScore)])) || 80;

  // Last 5 months ending the seed "now" (June 2026 = month index 5).
  let last = overall;
  const points: MonthPoint[] = [];
  for (let i = 4; i >= 0; i--) {
    const start = +new Date(2026, 5 - i, 1);
    const end = +new Date(2026, 5 - i + 1, 1);
    const inM = (d: string) => {
      const t = +new Date(d);
      return t >= start && t < end;
    };
    const vals = [
      ...hosp.filter((h) => inM(h.date)).map((h) => h.overallScore),
      ...hyg.filter((h) => inM(h.date)).map((h) => h.hygieneScore),
    ];
    if (vals.length) last = round1(avg(vals));
    points.push({ label: new Date(2026, 5 - i, 1).toLocaleDateString("en-US", { month: "short" }), value: last });
  }

  const target = 80;
  return {
    points,
    avg: round1(avg(points.map((p) => p.value))),
    aboveTarget: points.filter((p) => p.value >= target).length,
    best: points.reduce((a, b) => (b.value > a.value ? b : a), points[0]).label,
    target,
  };
}

/* ---------------- Performance by coordinator area ---------------- */
export interface CoordinatorPerf {
  id: string;
  name: string;
  hospitality: number;
  hygiene: number;
  complaints: number;
}

/** One row per area coordinator (scoped to the given outlet ids). */
export function coordinatorPerformance(outletIds: string[]): CoordinatorPerf[] {
  const scope = new Set(outletIds);
  return SEED.users
    .filter((u) => u.role === "area_coordinator")
    .map((c) => ({ c, ids: new Set((c.outletIds ?? []).filter((id) => scope.has(id))) }))
    .filter(({ ids }) => ids.size > 0)
    .map(({ c, ids }) => {
      const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => h.overallScore);
      const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => h.hygieneScore);
      const complaints = SEED.complaints.filter(
        (c2) => ids.has(c2.outletId) && c2.status !== "closed" && c2.status !== "done",
      ).length;
      return {
        id: c.id,
        name: c.name,
        hospitality: round1(avg(hosp)),
        hygiene: round1(avg(hyg)),
        complaints,
      };
    });
}

/* ---------------- Quality trend (hospitality vs hygiene over time) ---------------- */
export interface QualityPoint {
  label: string;
  hospitality: number;
  hygiene: number;
}
export interface QualitySeries {
  daily: QualityPoint[];
  weekly: QualityPoint[];
  monthly: QualityPoint[];
  yearly: QualityPoint[];
}

export function qualitySeries(outletIds: string[]): QualitySeries {
  const ids = new Set(outletIds);
  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => ({ t: +new Date(h.date), v: h.overallScore }));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => ({ t: +new Date(h.date), v: h.hygieneScore }));
  const baseH = round1(avg(hosp.map((x) => x.v))) || 80;
  const baseG = round1(avg(hyg.map((x) => x.v))) || 80;
  const avgIn = (arr: { t: number; v: number }[], s: number, e: number) => {
    const xs = arr.filter((x) => x.t >= s && x.t < e).map((x) => x.v);
    return xs.length ? round1(avg(xs)) : null;
  };
  const build = (buckets: { label: string; start: number; end: number }[]): QualityPoint[] => {
    let lh = baseH;
    let lg = baseG;
    return buckets.map((b) => {
      const h = avgIn(hosp, b.start, b.end);
      if (h != null) lh = h;
      const g = avgIn(hyg, b.start, b.end);
      if (g != null) lg = g;
      return { label: b.label, hospitality: lh, hygiene: lg };
    });
  };

  const DAY = 86_400_000;
  const ny = new Date(NOW).getUTCFullYear();
  const nm = new Date(NOW).getUTCMonth();

  const daily = build(
    Array.from({ length: 14 }, (_, i) => {
      const end = NOW - (13 - i) * DAY;
      return { label: new Date(end).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" }), start: end - DAY, end };
    }),
  );
  const weekly = build(
    Array.from({ length: 8 }, (_, i) => {
      const end = NOW - (7 - i) * 7 * DAY;
      return { label: `W${i + 1}`, start: end - 7 * DAY, end };
    }),
  );
  const monthly = build(
    Array.from({ length: 12 }, (_, i) => {
      const m = new Date(Date.UTC(ny, nm - (11 - i), 1));
      return {
        label: m.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        start: +m,
        end: +new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)),
      };
    }),
  );
  const yearly = build(
    Array.from({ length: 3 }, (_, i) => {
      const y = ny - 2 + i;
      return { label: String(y), start: Date.UTC(y, 0, 1), end: Date.UTC(y + 1, 0, 1) };
    }),
  );

  return { daily, weekly, monthly, yearly };
}

/** GitHub-style heatmap: per-area weekly average quality score (hospitality + hygiene), carry-forward. */
export function areaWeeklyQuality(outletIds: string[], weeks = 52): { labels: string[]; rows: { label: string; values: number[] }[] } {
  const ids = new Set(outletIds);
  const byArea = new Map<string, Set<string>>();
  for (const o of SEED.outlets) {
    if (!ids.has(o.id)) continue;
    if (!byArea.has(o.areaId)) byArea.set(o.areaId, new Set());
    byArea.get(o.areaId)!.add(o.id);
  }
  const WK = 7 * 86_400_000;
  const wins = Array.from({ length: weeks }, (_, i) => {
    const end = NOW - (weeks - 1 - i) * WK;
    return { start: end - WK, end };
  });
  const labels = wins.map((w) => new Date(w.end).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" }));

  const rows = [...byArea.entries()].map(([areaId, set]) => {
    const pts = [
      ...SEED.hospitality.filter((h) => set.has(h.outletId)).map((h) => ({ t: +new Date(h.date), v: h.overallScore })),
      ...SEED.hygiene.filter((h) => set.has(h.outletId)).map((h) => ({ t: +new Date(h.date), v: h.hygieneScore })),
    ];
    let last = round1(avg(pts.map((p) => p.v))) || 0;
    const values = wins.map((w) => {
      const xs = pts.filter((p) => p.t >= w.start && p.t < w.end).map((p) => p.v);
      if (xs.length) last = round1(avg(xs));
      return last;
    });
    return { label: getArea(areaId)?.name ?? "—", values };
  });

  return { labels, rows };
}

/* current identity placeholder (replaced by real session in Phase 2 wiring) */
export function getCurrentUser(): UserProfile {
  return SEED.currentUser;
}
