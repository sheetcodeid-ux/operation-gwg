"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets } from "@/lib/data/store";
import { createEvent, deleteEvent, updateEvent, updateEventMilestone } from "@/lib/data/mutations";
import { DEMO_NOW_ISO } from "@/lib/now";
import type { EventMilestone, EventStatus } from "@/lib/types";

export interface EventInput {
  name: string;
  outletId: string;
  /** Coordinator Area in charge of the event. */
  picId: string;
  description: string;
  budget: number;
  startDate: string;
  endDate: string;
  milestone: EventMilestone;
  status: EventStatus;
}

function revalidateAll() {
  revalidatePath("/events");
  revalidatePath("/events/kanban");
  revalidatePath("/events/timeline");
  revalidatePath("/dashboard");
}

export async function createEventAction(input: EventInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_event")) return { error: "You don't have permission to create events." };
  if (!input.name.trim()) return { error: "Event name is required." };
  if (!canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(input.outletId)!;
  const record = createEvent({
    name: input.name.trim(),
    outletId: input.outletId,
    picId: input.picId || outlet.picId,
    description: input.description.trim(),
    budget: Math.max(0, input.budget),
    startDate: input.startDate || DEMO_NOW_ISO,
    endDate: input.endDate || DEMO_NOW_ISO,
    milestone: input.milestone,
    status: input.status,
  });

  revalidateAll();
  return { ok: true, id: record.id };
}

export async function updateEventAction(id: string, input: EventInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_event")) return { error: "You don't have permission to edit events." };
  if (!input.name.trim()) return { error: "Event name is required." };
  if (!canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(input.outletId)!;
  updateEvent(id, {
    name: input.name.trim(),
    outletId: input.outletId,
    picId: input.picId || outlet.picId,
    description: input.description.trim(),
    budget: Math.max(0, input.budget),
    startDate: input.startDate || DEMO_NOW_ISO,
    endDate: input.endDate || DEMO_NOW_ISO,
    milestone: input.milestone,
    status: input.status,
  });

  revalidateAll();
  return { ok: true };
}

export async function deleteEventAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_event")) return { error: "You don't have permission to delete events." };
  deleteEvent(id);
  revalidateAll();
  return { ok: true };
}

export async function updateEventMilestoneAction(id: string, milestone: EventMilestone) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_event")) return { error: "No permission" };
  updateEventMilestone(id, milestone);
  revalidateAll();
  return { ok: true };
}
