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
  outletName: string;
  picName: string;
  proposedBudget: number; // budget as filled operationally (proposal)
  startDate: string;
  endDate: string;
  status: string; // operational lifecycle
  createdAt: string;
  review: MarcommReview;
}

export function fmtRupiah(n: number): string {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

/** Inclusive day count of a measurement window. */
export function windowDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = +new Date(end) - +new Date(start);
  return ms < 0 ? 0 : Math.round(ms / 86_400_000) + 1;
}
