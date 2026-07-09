import { areaName, getUsers, listTasks, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { WORK_DIVISIONS } from "@/lib/nav";
import type { Role, UserProfile } from "@/lib/types";
import type { WorkRow } from "./work-table";

const DIVISIONS = WORK_DIVISIONS;
export type DivisionMembers = Record<string, { id: string; name: string }[]>;

/** Enriched task rows shared by the Work Tracker table, Kanban and Calendar views. */
export function buildWorkRows(user: UserProfile): WorkRow[] {
  return listTasks(user).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    division: t.division,
    outletId: t.outletId ?? "",
    outlet: t.outletId ? outletName(t.outletId) : "No branch",
    area: t.areaId ? areaName(t.areaId) : "—",
    picIds: t.picIds,
    pic: t.picIds.length ? t.picIds.map(userName).join(", ") : "—",
    startDate: t.startDate,
    dueDate: t.dueDate,
    progress: t.progress,
  }));
}

/** Coordinator-aware outlets + coordinator list for the New Task sheet. */
export function buildTaskSheetData(user: UserProfile) {
  const all = visibleOutlets(user);
  const allIds = new Set(all.map((o) => o.id));
  const coordinators = getUsers().filter(
    (u) => u.role === "area_coordinator" && (u.outletIds ?? []).some((id) => allIds.has(id)),
  );
  const coordByOutlet = new Map<string, string>();
  for (const c of coordinators) for (const oid of c.outletIds ?? []) coordByOutlet.set(oid, c.id);
  const members: DivisionMembers = {};
  for (const r of DIVISIONS) {
    members[r] = getUsers()
      .filter((u) => u.role === r && u.active)
      .map((u) => ({ id: u.id, name: u.name }));
  }

  // Pre-select the creator's own division when they open the New Task form,
  // instead of always defaulting to Operation.
  const defaultDivision: Role = (DIVISIONS as Role[]).includes(user.role) ? user.role : DIVISIONS[0];

  return {
    outlets: all.map((o) => ({ id: o.id, name: o.name, coordinatorId: coordByOutlet.get(o.id) ?? null })),
    coordinators: coordinators.map((c) => ({ id: c.id, name: c.name })),
    members,
    defaultDivision,
  };
}
