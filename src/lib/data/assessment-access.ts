import "server-only";

import { listAssignments, listRoster } from "./assessment-roster";
import { orgDepartmentId } from "@/lib/assessment/org";
import type { AssessmentRole } from "@/lib/assessment/access";

/** The resolved assessment access for a signed-in user (plain data, safe to
 *  pass to the client workspace). */
export interface AssessmentAccess {
  role: AssessmentRole;
  /** Division a Head assesses ("" = all divisions, for HC/Director). */
  scopeDepartmentId: string;
  /** Participant user-ids this user reviews as a Rekan Sejawat. */
  peerFor: string[];
  /** Participant user-ids this user is the Atasan (Penilai 1) for. */
  atasanFor: string[];
  /** True when this account is itself a participant (dinilai). */
  isParticipant: boolean;
  /** This account ALSO heads a division on top of its HC/Director role. */
  alsoHead: boolean;
}

/**
 * Derive a user's viewpoint from the roster + assignments — the single source of
 * truth. Priority: Director > HC > Head/Atasan > Rekan Sejawat > Karyawan > none.
 * Super Admin always resolves to Director (full access) for administration.
 */
export async function resolveAssessmentAccess(user: {
  id: string;
  role: string;
  department?: string | null;
}): Promise<AssessmentAccess> {
  const [roster, assignments] = await Promise.all([listRoster(), listAssignments()]);
  const entry = roster.find((r) => r.userId === user.id && r.active) ?? null;
  const peerFor = assignments.filter((a) => a.peerUserIds.includes(user.id)).map((a) => a.participantUserId);
  const atasanFor = assignments.filter((a) => a.atasanUserId === user.id).map((a) => a.participantUserId);
  // Heads are assessed too (by HC + Director), so they also fill Syarat & Self
  // Assessment — they count as participants.
  const isParticipant =
    entry?.role === "karyawan" || entry?.role === "head" || assignments.some((a) => a.participantUserId === user.id);

  const base = { peerFor, atasanFor, isParticipant, alsoHead: !!entry?.alsoHead };

  // Super Admin = administrator → full Director view.
  if (user.role === "super_admin") return { role: "director", scopeDepartmentId: "", ...base };
  if (entry?.role === "director") return { role: "director", scopeDepartmentId: "", ...base };
  if (entry?.role === "hc") return { role: "hr", scopeDepartmentId: "", ...base };
  if (entry?.role === "head" || atasanFor.length > 0) {
    const scope = entry?.scopeDepartmentId || (user.department ? orgDepartmentId(user.department) : "");
    return { role: "atasan", scopeDepartmentId: scope, ...base };
  }
  if (peerFor.length > 0) return { role: "peer", scopeDepartmentId: "", ...base };
  // A participant — from a roster `karyawan` entry OR simply from having an
  // assignment (atasan/peers set for them). Either way they get the 3-tab view.
  if (isParticipant) return { role: "karyawan", scopeDepartmentId: "", ...base };
  return { role: "none", scopeDepartmentId: "", ...base };
}
