import type { Tone } from "@/lib/constants";

/**
 * Marketing Communication — shared shapes for the event/promo ACC (approval) +
 * budget + revenue-impact layer that sits over the operational Event Tracker.
 * Coordinator Area proposes events operationally; MarComm reviews, sets the
 * budget, classifies promo (product) vs event (outlet), and — in Fase B —
 * measures the omzet impact against the budget.
 */

export type MarcommStatus = "pending" | "approved" | "rejected";
export type MarcommEventType = "promo" | "event";

export const MC_STATUS_META: Record<MarcommStatus, { label: string; tone: Tone }> = {
  pending: { label: "Menunggu ACC", tone: "warning" },
  approved: { label: "Disetujui", tone: "success" },
  rejected: { label: "Ditolak", tone: "danger" },
};

export const MC_TYPE_META: Record<MarcommEventType, { label: string; tone: Tone }> = {
  promo: { label: "Promo Produk", tone: "brand" },
  event: { label: "Event Outlet", tone: "cyan" },
};

/** MarComm's review of one operational event. */
export interface MarcommReview {
  eventId: string;
  status: MarcommStatus;
  budget: number;
  eventType: MarcommEventType | null;
  productNames: string[];
  outletIds: string[];
  /** Event applies to every outlet (measured company-wide). */
  allOutlets: boolean;
  measureStart: string | null;
  measureEnd: string | null;
  note: string;
  rejectReason: string;
  approvedByName: string | null;
  approvedAt: string | null;
}

/** An operational event joined with its MarComm review (+ display labels). */
export interface ReviewableEvent {
  id: string;
  name: string;
  description: string;
  outletId: string;
  /** Human display of scope: outlet name / "N outlet" / "Semua Outlet". */
  outletName: string;
  picName: string;
  /** Who filed it: Coordinator Area (operational) or Marketing Communication. */
  origin: "ca" | "marcomm";
  proposedBudget: number; // budget as filled operationally (proposal)
  startDate: string;
  endDate: string;
  status: string; // operational lifecycle
  createdAt: string;
  review: MarcommReview;
}

export function fmtRupiah(n: number): string {
  const neg = n < 0;
  return (neg ? "-Rp " : "Rp ") + Math.round(Math.abs(n) || 0).toLocaleString("id-ID");
}

/* ---------------- impact analysis (Fase B) ---------------- */

export type ImpactVerdict = "impactful" | "marginal" | "no_impact" | "no_data";

export const VERDICT_META: Record<ImpactVerdict, { label: string; tone: Tone }> = {
  impactful: { label: "Berdampak", tone: "success" },
  marginal: { label: "Marginal", tone: "amber" },
  no_impact: { label: "Tidak Berdampak", tone: "danger" },
  no_data: { label: "Data Belum Tersedia", tone: "neutral" },
};

export interface ProductBreakdown {
  name: string;
  windowOmzet: number;
  baselineOmzet: number;
  uplift: number;
}

/** Computed revenue impact for one approved event/promo. */
export interface EventImpact {
  eventId: string;
  name: string;
  type: MarcommEventType;
  budget: number;
  measureStart: string;
  measureEnd: string;
  days: number;
  /** Whether omzet came from matched outlets ("outlet") or company-wide ("all"). */
  omzetScope: "outlet" | "all";
  windowOmzet: number;
  baselineOmzet: number;
  uplift: number;
  upliftPct: number;
  roi: number; // uplift / budget
  net: number; // uplift - budget
  verdict: ImpactVerdict;
  /** Promo only: per-product monthly omzet window vs baseline. */
  productBreakdown: ProductBreakdown[];
  /** Extra note (e.g. omzet is company-wide, or data not synced). */
  note: string;
}

export function verdictOf(uplift: number, budget: number, hasData: boolean): ImpactVerdict {
  if (!hasData) return "no_data";
  if (uplift <= 0) return "no_impact";
  if (uplift <= budget) return "marginal";
  return "impactful";
}

/** Inclusive day count of a measurement window. */
export function windowDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = +new Date(end) - +new Date(start);
  return ms < 0 ? 0 : Math.round(ms / 86_400_000) + 1;
}
