import type { Role } from "@/lib/types";
import type { AssessmentSchedule } from "@/lib/data/assessment-schedule";

/** Where "now" sits relative to the assessment window. */
export type AssessmentPhase = "before" | "open" | "closed";

export interface AccessUser {
  role: Role;
  jabatan?: string | null;
  department?: string | null;
}

export function assessmentPhase(schedule: AssessmentSchedule, now: number = Date.now()): AssessmentPhase {
  const start = schedule.startAt ? Date.parse(schedule.startAt) : null;
  const end = schedule.endAt ? Date.parse(schedule.endAt) : null;
  if (start && now < start) return "before";
  if (end && now > end) return "closed";
  return "open";
}

/** A Head / Director / Legal — keeps assessment access after the window closes
 *  (they run the interviews). Detected by role OR by jabatan/department, since
 *  most Head-Office accounts are generic `member` with their placement in the
 *  department/jabatan fields. */
export function isPrivilegedEvaluator(user: AccessUser): boolean {
  const j = (user.jabatan ?? "").trim().toLowerCase();
  const d = (user.department ?? "").trim().toLowerCase();
  return (
    user.role === "super_admin" ||
    user.role === "legal" ||
    user.role === "assessor" ||
    user.role.startsWith("head_") ||
    /^head\b/.test(j) ||
    j === "director" ||
    j === "legal" ||
    d === "legal" ||
    d === "management" // Director / Executive Assistant office
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
