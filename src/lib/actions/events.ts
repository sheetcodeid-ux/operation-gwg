"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets } from "@/lib/data/store";
import { createEvent } from "@/lib/data/mutations";
import type { EventMilestone, EventStatus } from "@/lib/types";

export interface EventInput {
  name: string;
  outletId: string;
  description: string;
  budget: number;
  startDate: string;
  endDate: string;
  milestone: EventMilestone;
  status: EventStatus;
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
    picId: outlet.picId,
    description: input.description.trim(),
    budget: Math.max(0, input.budget),
    startDate: input.startDate || new Date().toISOString(),
    endDate: input.endDate || new Date().toISOString(),
    milestone: input.milestone,
    status: input.status,
  });

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id };
}
