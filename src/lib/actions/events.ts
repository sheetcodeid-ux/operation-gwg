"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets } from "@/lib/data/store";
import { createEvent, deleteEvent, updateEvent, updateEventMilestone } from "@/lib/data/mutations";
import { persistMessage } from "@/lib/data/persist";
import { DEMO_NOW_ISO } from "@/lib/now";
import { eventInputSchema, eventMilestoneSchema, parseInput } from "@/lib/validation";
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
  const parsed = parseInput(eventInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (!canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(clean.outletId)!;
  let record;
  try {
    record = await createEvent({
      name: clean.name,
      outletId: clean.outletId,
      picId: clean.picId || outlet.picId,
      description: clean.description,
      budget: clean.budget,
      startDate: clean.startDate || DEMO_NOW_ISO,
      endDate: clean.endDate || DEMO_NOW_ISO,
      milestone: clean.milestone,
      status: clean.status,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  revalidateAll();
  return { ok: true, id: record.id };
}

export async function updateEventAction(id: string, input: EventInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_event")) return { error: "You don't have permission to edit events." };
  const parsed = parseInput(eventInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (!canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(clean.outletId)!;
  updateEvent(id, {
    name: clean.name,
    outletId: clean.outletId,
    picId: clean.picId || outlet.picId,
    description: clean.description,
    budget: clean.budget,
    startDate: clean.startDate || DEMO_NOW_ISO,
    endDate: clean.endDate || DEMO_NOW_ISO,
    milestone: clean.milestone,
    status: clean.status,
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
  if (!eventMilestoneSchema.safeParse(milestone).success) return { error: "Invalid milestone." };
  updateEventMilestone(id, milestone);
  revalidateAll();
  return { ok: true };
}
