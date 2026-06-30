import { areaName, getUsers, listEvents, outletName, userName, visibleOutlets } from "@/lib/data/store";
import type { UserProfile } from "@/lib/types";
import type { EventRow } from "./event-table";

/** Enriched event rows shared by the Event Tracker table, kanban and timeline. */
export function buildEventRows(user: UserProfile): EventRow[] {
  return listEvents(user).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    outletId: e.outletId,
    outlet: outletName(e.outletId),
    areaId: e.areaId,
    area: areaName(e.areaId),
    picId: e.picId,
    pic: userName(e.picId),
    budget: e.budget,
    startDate: e.startDate,
    endDate: e.endDate,
    milestone: e.milestone,
    status: e.status,
    progress: e.progress,
  }));
}

export interface EventOutlet {
  id: string;
  name: string;
  areaId: string;
  coordinatorId: string | null;
}

/** Outlets (with their area coordinator) + the coordinator list for the event form. */
export function buildEventFormData(user: UserProfile) {
  const all = visibleOutlets(user);
  const allIds = new Set(all.map((o) => o.id));
  const coordinators = getUsers().filter(
    (u) => u.role === "area_coordinator" && (u.outletIds ?? []).some((id) => allIds.has(id)),
  );
  const coordByOutlet = new Map<string, string>();
  for (const c of coordinators) for (const oid of c.outletIds ?? []) coordByOutlet.set(oid, c.id);

  return {
    outlets: all.map((o) => ({ id: o.id, name: o.name, areaId: o.areaId, coordinatorId: coordByOutlet.get(o.id) ?? null })),
    coordinators: coordinators.map((c) => ({ id: c.id, name: c.name })),
  };
}
