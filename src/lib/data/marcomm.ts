import "server-only";

import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { getOutlets, outletName, userName } from "./store";
import { eventFromRow } from "./rows";
import { listHpp } from "./hpp";
import type { MarcommEventType, MarcommReview, MarcommStatus, ReviewableEvent } from "@/lib/marcomm-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Marketing Communication data — the ACC/review + budget layer over operational
 * events. Events themselves stay in `ops_events` (owned by Operation); MarComm's
 * decision lives in `marcomm_reviews`, keyed by event id.
 */

const emptyReview = (eventId: string): MarcommReview => ({
  eventId,
  status: "pending",
  budget: 0,
  eventType: null,
  productNames: [],
  outletIds: [],
  measureStart: null,
  measureEnd: null,
  note: "",
  rejectReason: "",
  approvedByName: null,
  approvedAt: null,
});

const reviewFromRow = (r: any): MarcommReview => ({
  eventId: r.event_id,
  status: (r.status ?? "pending") as MarcommStatus,
  budget: Number(r.budget ?? 0),
  eventType: (r.event_type ?? null) as MarcommEventType | null,
  productNames: Array.isArray(r.product_names) ? r.product_names : [],
  outletIds: Array.isArray(r.outlet_ids) ? r.outlet_ids : [],
  measureStart: r.measure_start ?? null,
  measureEnd: r.measure_end ?? null,
  note: r.note ?? "",
  rejectReason: r.reject_reason ?? "",
  approvedByName: r.approved_by ? userName(r.approved_by) : null,
  approvedAt: r.approved_at ?? null,
});

/** Every operational event joined with its MarComm review (default = pending). */
export async function listReviewableEvents(): Promise<ReviewableEvent[]> {
  if (!dbEnabled) return [];
  const [{ data: evRows }, { data: revRows }] = await Promise.all([
    db().from("ops_events").select("*").order("start_date", { ascending: false }).limit(500),
    db().from("marcomm_reviews").select("*"),
  ]);
  const reviews = new Map<string, MarcommReview>();
  for (const r of (revRows ?? []) as any[]) reviews.set(r.event_id, reviewFromRow(r));

  return ((evRows ?? []) as any[]).map((row) => {
    const e = eventFromRow(row);
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      outletId: e.outletId,
      outletName: outletName(e.outletId),
      picName: userName(e.picId),
      proposedBudget: e.budget,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
      createdAt: e.createdAt,
      review: reviews.get(e.id) ?? emptyReview(e.id),
    };
  });
}

export async function getReview(eventId: string): Promise<MarcommReview> {
  if (!dbEnabled) return emptyReview(eventId);
  const { data } = await db().from("marcomm_reviews").select("*").eq("event_id", eventId).maybeSingle();
  return data ? reviewFromRow(data) : emptyReview(eventId);
}

export interface ApproveReviewInput {
  eventId: string;
  budget: number;
  eventType: MarcommEventType;
  productNames: string[];
  outletIds: string[];
  measureStart: string;
  measureEnd: string;
  note: string;
  approvedBy: string;
}

export async function approveReview(input: ApproveReviewInput): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db().from("marcomm_reviews").upsert(
    {
      event_id: input.eventId,
      status: "approved" as MarcommStatus,
      budget: input.budget,
      event_type: input.eventType,
      product_names: input.eventType === "promo" ? input.productNames : [],
      outlet_ids: input.eventType === "event" ? input.outletIds : [],
      measure_start: input.measureStart,
      measure_end: input.measureEnd,
      note: input.note,
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
      reject_reason: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  return error ? { error: error.message } : {};
}

export async function rejectReview(eventId: string, reason: string, by: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db().from("marcomm_reviews").upsert(
    { event_id: eventId, status: "rejected" as MarcommStatus, reject_reason: reason, approved_by: by, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "event_id" },
  );
  return error ? { error: error.message } : {};
}

/** Reset a review back to pending (undo an ACC/rejection). */
export async function resetReview(eventId: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db().from("marcomm_reviews").delete().eq("event_id", eventId);
  return error ? { error: error.message } : {};
}

/** Product options for promo classification — the HPP menu catalog. */
export async function productOptions(): Promise<{ name: string; brand: string }[]> {
  const menus = await listHpp();
  const seen = new Set<string>();
  const out: { name: string; brand: string }[] = [];
  for (const m of menus) {
    const key = m.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: m.name, brand: m.brand });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function outletOptions(): { id: string; name: string }[] {
  return getOutlets().map((o) => ({ id: o.id, name: o.name })).sort((a, b) => a.name.localeCompare(b.name));
}
