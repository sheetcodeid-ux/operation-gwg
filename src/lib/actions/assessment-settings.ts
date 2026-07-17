"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { persistMessage } from "@/lib/data/persist";
import { resolveAssessmentAccess } from "@/lib/data/assessment-access";
import {
  saveAssignment,
  saveRosterEntry,
  removeRosterEntry,
  type RosterRole,
} from "@/lib/data/assessment-roster";
import type { UserProfile } from "@/lib/types";

/** Who may edit the assessment settings: Super Admin, HC, or Director. */
async function canManage(): Promise<UserProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role === "super_admin") return user;
  const access = await resolveAssessmentAccess({ id: user.id, role: user.role, department: user.department });
  return access.role === "hr" || access.role === "director" ? user : null;
}

export async function saveRosterEntryAction(input: {
  userId: string;
  role: RosterRole;
  scopeDepartmentId?: string;
  active?: boolean;
}) {
  if (!(await canManage())) return { error: "Hanya Admin / HC / Director yang dapat mengatur assessment." };
  try {
    await saveRosterEntry({
      userId: input.userId,
      role: input.role,
      scopeDepartmentId: input.scopeDepartmentId ?? "",
      active: input.active ?? true,
    });
    revalidatePath("/assessment/settings");
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function removeRosterEntryAction(userId: string) {
  if (!(await canManage())) return { error: "Hanya Admin / HC / Director yang dapat mengatur assessment." };
  try {
    await removeRosterEntry(userId);
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
  if (!(await canManage())) return { error: "Hanya Admin / HC / Director yang dapat mengatur assessment." };
  try {
    await saveAssignment(input);
    revalidatePath("/assessment/settings");
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
