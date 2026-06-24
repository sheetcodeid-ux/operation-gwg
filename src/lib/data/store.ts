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
  return SEED.tasks.filter((t) => ids.has(t.outletId)).sort(byDateDesc("createdAt"));
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
  const tsk = SEED.tasks.filter((t) => ids.has(t.outletId));
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
      const tasks = SEED.tasks.filter((t) => ids.has(t.outletId));
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

/* current identity placeholder (replaced by real session in Phase 2 wiring) */
export function getCurrentUser(): UserProfile {
  return SEED.currentUser;
}
