import type { HppStatus } from "@/lib/data/hpp";

export type StatusTone = "muted" | "info" | "good" | "bad";

/** Display metadata for the HPP review lifecycle (client-safe, no server deps). */
export const HPP_STATUS_META: Record<HppStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "muted" },
  submitted: { label: "Diajukan", tone: "info" },
  verified: { label: "Diverifikasi", tone: "good" },
  rejected: { label: "Ditolak", tone: "bad" },
};

/** Tailwind classes for a status pill by tone. */
export const STATUS_PILL: Record<StatusTone, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  good: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  bad: "bg-red-500/12 text-red-600 dark:text-red-400",
};
