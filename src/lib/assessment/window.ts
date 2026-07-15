import type { Role } from "@/lib/types";
import type { AssessmentSchedule } from "@/lib/data/assessment-schedule";

/** Where "now" sits relative to the assessment window. */
export type AssessmentPhase = "before" | "open" | "closed";

export interface AccessUser {
  role: Role;
  jabatan?: string | null;
}

export function assessmentPhase(schedule: AssessmentSchedule, now: number = Date.now()): AssessmentPhase {
  const start = schedule.startAt ? Date.parse(schedule.startAt) : null;
  const end = schedule.endAt ? Date.parse(schedule.endAt) : null;
  if (start && now < start) return "before";
  if (end && now > end) return "closed";
  return "open";
}

/** A Head / Director / Legal — keeps assessment access after the window closes
 *  (they run the interviews). Director = super_admin. */
export function isPrivilegedEvaluator(user: AccessUser): boolean {
  return (
    user.role === "super_admin" ||
    user.role === "legal" ||
    user.role === "assessor" ||
    user.role.startsWith("head_") ||
    (!!user.jabatan && /^\s*head\b/i.test(user.jabatan))
  );
}

/**
 * Can this user open the assessment right now?
 * - Supervisor: never (field staff, not Head Office).
 * - Privileged (Head/Director/Legal): always, regardless of the window.
 * - Everyone else: only while the window is OPEN.
 */
export function canAccessAssessment(
  user: AccessUser,
  schedule: AssessmentSchedule,
  now: number = Date.now(),
): boolean {
  if (user.role === "supervisor") return false;
  if (isPrivilegedEvaluator(user)) return true;
  return assessmentPhase(schedule, now) === "open";
}
