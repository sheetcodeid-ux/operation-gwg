"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlets } from "@/lib/data/store";
import { createHospitality } from "@/lib/data/mutations";
import { persistMessage } from "@/lib/data/persist";
import type { HospitalityCategory } from "@/lib/types";

export interface HospitalityInput {
  outletId: string;
  /** Coordinator Area performing the visit (assessor). */
  coordinatorId?: string;
  staffName: string;
  staffPosition: string;
  scores: Record<HospitalityCategory, Record<string, number>>;
  notes?: string;
  date?: string;
}

export async function createHospitalityAction(input: HospitalityInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_hospitality")) return { error: "You don't have permission to create assessments." };
  if (!input.outletId) return { error: "Select an outlet." };
  if (!canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };
  if (!input.staffName.trim()) return { error: "Staff name is required." };

  let record;
  try {
    record = await createHospitality({
      outletId: input.outletId,
      assessorId: input.coordinatorId || user.id,
      staffName: input.staffName.trim(),
      staffPosition: input.staffPosition.trim() || "Staff",
      scores: input.scores,
      notes: input.notes,
      date: input.date,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  revalidatePath("/hospitality");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id, score: record.overallScore };
}
