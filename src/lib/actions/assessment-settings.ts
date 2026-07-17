"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { persistMessage } from "@/lib/data/persist";
import {
  saveAssignment,
  saveRosterEntry,
  removeRosterEntry,
  deleteAssignment,
  type RosterRole,
} from "@/lib/data/assessment-roster";
import type { UserProfile } from "@/lib/types";

/** Who may edit the assessment settings: Super Admin only (owner decision). */
async function canManage(): Promise<UserProfile | null> {
  const user = await getSessionUser();
  return user && user.role === "super_admin" ? user : null;
}

export async function saveRosterEntryAction(input: {
  userId: string;
  role: RosterRole;
  scopeDepartmentId?: string;
  active?: boolean;
}) {
  if (!(await canManage())) return { error: "Hanya Admin yang dapat mengatur assessment." };
  try {
    await saveRosterEntry({
      userId: input.userId,
      role: input.role,
      scopeDepartmentId: input.scopeDepartmentId ?? "",
      active: input.active ?? true,
    });
    // Atasan/peer assignment only applies to a Karyawan participant — drop it
    // when the account becomes a Head/HC/Director so no stale participant lingers.
    if (input.role !== "karyawan") await deleteAssignment(input.userId);
    revalidatePath("/assessment/settings");
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function removeRosterEntryAction(userId: string) {
  if (!(await canManage())) return { error: "Hanya Admin yang dapat mengatur assessment." };
  try {
    await removeRosterEntry(userId);
    await deleteAssignment(userId);
    revalidatePath("/assessment/settings");
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function saveAssignmentAction(input: {
  participantUserId: string;
  atasanUserId: string | null;
  peerUserIds: string[];
}) {
  if (!(await canManage())) return { error: "Hanya Admin yang dapat mengatur assessment." };
  try {
    await saveAssignment(input);
    revalidatePath("/assessment/settings");
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
