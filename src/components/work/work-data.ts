import { areaName, getUsers, listTasks, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { allDepartments, setOrgExtras } from "@/lib/assessment/org";
import { getOrgExtra } from "@/lib/data/org";
import { getNavExtra } from "@/lib/data/nav";
import type { UserProfile } from "@/lib/types";
import type { WorkRow } from "./work-table";

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

/** The selectable org departments/divisions (assessment built-in + admin-added
 *  + custom sidebar divisions) — the single "division" list used for tasks. */
export async function departmentList(): Promise<string[]> {
  setOrgExtras(await getOrgExtra());
  const nav = await getNavExtra();
  return [...new Set([...allDepartments().map((d) => d.name), ...nav.divisions.map((d) => d.name)])];
}

/** Coordinator-aware outlets + department members for the New Task sheet.
 *  Tasks are organised by department (Finance, Creative, …); PIC candidates are
 *  the active members of the chosen department. */
export async function buildTaskSheetData(user: UserProfile) {
  const all = visibleOutlets(user);
  const allIds = new Set(all.map((o) => o.id));
  const coordinators = getUsers().filter(
    (u) => u.role === "area_coordinator" && (u.outletIds ?? []).some((id) => allIds.has(id)),
  );
  const coordByOutlet = new Map<string, string>();
  for (const c of coordinators) for (const oid of c.outletIds ?? []) coordByOutlet.set(oid, c.id);

  const divisions = await departmentList();
  const activeUsers = getUsers().filter((u) => u.active);
  const members: DivisionMembers = {};
  for (const d of divisions) {
    members[d] = activeUsers.filter((u) => u.department === d).map((u) => ({ id: u.id, name: u.name }));
  }

  // Default to the creator's own department; fall back to the first division.
  const defaultDivision = (user.department && divisions.includes(user.department) ? user.department : divisions[0]) ?? "";

  return {
    outlets: all.map((o) => ({ id: o.id, name: o.name, coordinatorId: coordByOutlet.get(o.id) ?? null })),
    coordinators: coordinators.map((c) => ({ id: c.id, name: c.name })),
    members,
    divisions,
    defaultDivision,
  };
}
