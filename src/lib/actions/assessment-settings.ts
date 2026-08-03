"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { persistMessage } from "@/lib/data/persist";
import { getUsers } from "@/lib/data/store";
import { getOrgExtra } from "@/lib/data/org";
import { allDepartments, setOrgExtras } from "@/lib/assessment/org";
import {
  listAssignments,
  listRoster,
  saveAssignment,
  saveRosterEntry,
  removeRosterEntry,
  deleteAssignment,
  type RosterRole,
} from "@/lib/data/assessment-roster";
import { getReportSignatories, listSignatures, saveSignature } from "@/lib/data/assessment-signature";
import { listBlockedParticipants, unblockParticipant } from "@/lib/data/assessment";
import type { UserProfile } from "@/lib/types";

/** Who may edit the assessment settings: Super Admin only (owner decision). */
async function canManage(): Promise<UserProfile | null> {
  const user = await getSessionUser();
  return user && user.role === "super_admin" ? user : null;
}

/** Everything the settings panel needs — fetched on demand so the Pengaturan tab
 *  opens instantly (client-side) instead of a full route navigation. */
export async function getAssessmentSettingsData() {
  if (!(await canManage())) return null;
  setOrgExtras(await getOrgExtra());
  const [roster, assignments, signatures, blocked] = await Promise.all([
    listRoster(),
    listAssignments(),
    listSignatures(),
    listBlockedParticipants(),
  ]);
  const accounts = getUsers()
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, department: u.department ?? null, jabatan: u.jabatan ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const departments = allDepartments().map((d) => ({ value: d.id, label: d.name }));
  const initialRoster = Object.fromEntries(
    roster.map((r) => [r.userId, { role: r.role, scopeDepartmentId: r.scopeDepartmentId, alsoHead: !!r.alsoHead, alsoHeadScope: r.alsoHeadScope ?? "" }]),
  );
  const initialAssignments = Object.fromEntries(assignments.map((a) => [a.participantUserId, { atasanUserId: a.atasanUserId, peerUserIds: a.peerUserIds }]));
  return { accounts, departments, initialRoster, initialAssignments, initialSignatures: signatures, initialBlocked: blocked };
}

/** Save one signatory's TTD (name + optional signature image data URL). Admin only. */
export async function saveSignatureAction(input: { userId: string; name: string; image: string | null }) {
  if (!(await canManage())) return { error: "Hanya Admin yang dapat mengatur assessment." };
  try {
    // Guard against oversized images (keep the row sane).
    if (input.image && input.image.length > 600_000) return { error: "Gambar TTD terlalu besar (maks ±400 KB). Kompres dulu." };
    await saveSignature(input.userId, input.name, input.image);
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

/** The HC & Director signatories (name + TTD image) for the printed report. Any
 *  signed-in user may read these to render the PDF. */
export async function getReportSignatoriesAction(participantUserId?: string) {
  const user = await getSessionUser();
  if (!user) return { hc: null, director: null, atasan: null };
  return getReportSignatories(participantUserId);
}

/** Re-open assessment for a participant whose record the admin deleted, so a
 *  brand-new assessment can be started from zero. */
export async function unblockAssessmentAction(userId: string, employeeName?: string) {
  if (!(await canManage())) return { error: "Hanya Admin yang dapat mengatur assessment." };
  try {
    await unblockParticipant(userId, employeeName ?? null);
    revalidatePath("/assessment");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export async function saveRosterEntryAction(input: {
  userId: string;
  role: RosterRole;
  scopeDepartmentId?: string;
  active?: boolean;
  alsoHead?: boolean;
  alsoHeadScope?: string;
}) {
  if (!(await canManage())) return { error: "Hanya Admin yang dapat mengatur assessment." };
  try {
    await saveRosterEntry({
      userId: input.userId,
      role: input.role,
      scopeDepartmentId: input.scopeDepartmentId ?? "",
      active: input.active ?? true,
      alsoHead: input.alsoHead,
      alsoHeadScope: input.alsoHeadScope,
    });
    // Karyawan AND Head are participants (a Head is assessed by Director + HC and
    // may also have Rekan Sejawat), so both keep their assignment. Only HC and
    // Director are pure evaluators — drop any stale participant row for them.
    if (input.role !== "karyawan" && input.role !== "head") await deleteAssignment(input.userId);
    // Re-registering someone is a deliberate fresh start — lift any delete block.
    await unblockParticipant(input.userId);
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
