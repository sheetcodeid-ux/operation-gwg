import type { Tone } from "@/lib/constants";

/** Soft "pill" styling per tone — light + dark aware (light bg/dark text vs. translucent/bright text). */
export const TONE_PILL: Record<Tone, string> = {
  brand: "bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/25",
  cyan: "bg-cyan-100 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/25",
  amber: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25",
  success: "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25",
  warning: "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25",
  danger: "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25",
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

/** Solid accent color (hex) per tone — for charts / rings. */
export const TONE_HEX: Record<Tone, string> = {
  brand: "#a78bfa",
  cyan: "#22d3ee",
  amber: "#fbbf24",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  neutral: "#94a3b8",
};

/** Map a 0-100 score to a tone band. */
export function scoreTone(score: number): Tone {
  if (score >= 85) return "success";
  if (score >= 70) return "cyan";
  if (score >= 50) return "warning";
  return "danger";
}
