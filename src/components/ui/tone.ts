import type { Tone } from "@/lib/constants";

/** Soft "pill" styling per tone — light + dark aware (light bg/dark text vs. translucent/bright text). */
export const TONE_PILL: Record<Tone, string> = {
  // "brand" is neutral (Aniq-ui style); green is reserved for success.
  brand: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25",
  cyan: "bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25",
  amber: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25",
  success: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25",
  warning: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25",
  danger: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25",
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

/** Solid accent color (hex) per tone — for charts / rings. */
export const TONE_HEX: Record<Tone, string> = {
  brand: "#64748b",
  cyan: "#3b82f6",
  amber: "#f59e0b",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#ef4444",
  neutral: "#94a3b8",
};

/** Map a 0-100 score to a tone band. */
export function scoreTone(score: number): Tone {
  if (score >= 85) return "success";
  if (score >= 70) return "cyan";
  if (score >= 50) return "warning";
  return "danger";
}
