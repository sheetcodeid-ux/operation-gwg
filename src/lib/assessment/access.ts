/**
 * Assessment-domain viewpoints and what each may see (revisi Juli 2026).
 *
 * A user's viewpoint is derived server-side from the ASSESSMENT ROSTER settings
 * (see `resolveAssessmentAccess`), never from a silent fallback — an account
 * that isn't in the roster (and isn't assigned as a peer/atasan) gets no access
 * at all. This is what fixes the old bug where any account that reached the page
 * fell back to full HR access.
 */

export type TabKey = "panduan" | "syarat" | "penilaian" | "interview" | "dashboard" | "referensi";

/** Viewpoint inside the assessment feature. "none" = not registered → blocked. */
export type AssessmentRole = "karyawan" | "peer" | "atasan" | "hr" | "director" | "none";

export interface AssessmentRoleDef {
  value: AssessmentRole;
  label: string;
  description: string;
}

export const ASSESSMENT_ROLES: AssessmentRoleDef[] = [
  { value: "karyawan", label: "Karyawan (Peserta)", description: "Peserta yang dinilai — Panduan, Syarat & Self Assessment, dan Referensi." },
  { value: "peer", label: "Rekan Sejawat (Penilai 3)", description: "Menilai rekan yang ditugaskan — Panduan, Penilaian, dan Referensi." },
  { value: "atasan", label: "Atasan Langsung (Head Divisi)", description: "Penilai 1 untuk divisinya. Menilai, interview, dashboard & report." },
  { value: "hr", label: "Human Capital (Penilai 2)", description: "Akses penuh — menilai, interview, dashboard, report & administrasi." },
  { value: "director", label: "Director", description: "Akses penuh — melihat seluruh data, menilai posisi director-only, dashboard & keputusan." },
  { value: "none", label: "Belum Terdaftar", description: "Akun belum didaftarkan di Pengaturan Assessment." },
];

/** Tabs each viewpoint may open. */
export const TAB_ACCESS: Record<AssessmentRole, TabKey[]> = {
  karyawan: ["panduan", "syarat", "referensi"],
  peer: ["panduan", "penilaian", "referensi"],
  atasan: ["panduan", "penilaian", "interview", "dashboard", "referensi"],
  hr: ["panduan", "penilaian", "interview", "dashboard", "referensi"],
  director: ["panduan", "penilaian", "interview", "dashboard", "referensi"],
  none: [],
};

/** Roles that may run interviews, approvals, and generate reports. */
export function canReport(role: AssessmentRole): boolean {
  return role === "atasan" || role === "hr" || role === "director";
}

/** Full-access roles (Director & HC). */
export function isFullAccess(role: AssessmentRole): boolean {
  return role === "hr" || role === "director";
}

export function canSeeTab(role: AssessmentRole, tab: TabKey): boolean {
  return TAB_ACCESS[role].includes(tab);
}

/** Map a resolved evaluator column (al/hc/dir) to its viewpoint. Peers are not
 *  mapped here — they resolve to "peer" directly from the roster/assignments. */
export const EVALUATOR_TO_ROLE: Record<"al" | "hc" | "dir", AssessmentRole> = {
  al: "atasan",
  hc: "hr",
  dir: "director",
};

/** Named signatories used on the printed report. */
export const DIRECTOR_NAME = "Agustio";
export const HR_NAME = "MT Adrianto";
