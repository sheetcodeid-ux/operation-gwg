/**
 * Assessment-domain roles and what each may see (spec §3).
 *
 * These are viewpoints WITHIN the assessment feature — distinct from the app's
 * login roles. The workspace exposes a role switcher so the flow can be driven
 * from each viewpoint; wiring these to real per-user identities is a later step.
 */

export type TabKey = "panduan" | "syarat" | "penilaian" | "interview" | "dashboard" | "referensi";

export type AssessmentRole = "karyawan" | "atasan" | "hr" | "director";

export interface AssessmentRoleDef {
  value: AssessmentRole;
  label: string;
  person?: string;
  description: string;
}

export const ASSESSMENT_ROLES: AssessmentRoleDef[] = [
  {
    value: "karyawan",
    label: "Karyawan",
    description: "Mengisi Panduan, Syarat & Self Assessment, dan Referensi saja.",
  },
  {
    value: "atasan",
    label: "Atasan Langsung (Head Divisi)",
    description: "Seluruh Head tiap divisi. Dapat menilai, interview, dashboard, approval & report.",
  },
  {
    value: "hr",
    label: "Human Resource — MT Adrianto",
    description: "Full access — sama seperti Director.",
  },
  {
    value: "director",
    label: "Director — Agustio",
    description: "Full access — melihat seluruh data, menilai, interview, dashboard, report, approval.",
  },
];

/** Evaluators don't fill Syarat & SA — that's the employee's step (spec revisi §3). */
const EVALUATOR_TABS: TabKey[] = ["panduan", "penilaian", "interview", "dashboard", "referensi"];

/** Tabs each role may open. */
export const TAB_ACCESS: Record<AssessmentRole, TabKey[]> = {
  karyawan: ["panduan", "syarat", "referensi"],
  atasan: EVALUATOR_TABS,
  hr: EVALUATOR_TABS,
  director: EVALUATOR_TABS,
};

/** Roles that may run interviews, approvals, and generate reports. */
export function canReport(role: AssessmentRole): boolean {
  return role !== "karyawan";
}

/** Full-access roles (Director & HR). */
export function isFullAccess(role: AssessmentRole): boolean {
  return role === "hr" || role === "director";
}

export function canSeeTab(role: AssessmentRole, tab: TabKey): boolean {
  return TAB_ACCESS[role].includes(tab);
}

/** Named people fixed by the spec. */
export const DIRECTOR_NAME = "Agustio";
export const HR_NAME = "MT Adrianto";
