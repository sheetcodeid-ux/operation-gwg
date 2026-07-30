"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { approveReview, createMarcommProposal, rejectReview, resetReview } from "@/lib/data/marcomm";
import type { MarcommEventType } from "@/lib/marcomm-shared";
import type { UserProfile } from "@/lib/types";

const canMarcomm = (u: UserProfile | null) => !!u && canReachMenu(u, "mc_events");
// Coordinator Area (operational Event Tracker) may PROPOSE; only MarComm can ACC.
const canPropose = (u: UserProfile | null) => !!u && (canReachMenu(u, "mc_events") || canReachMenu(u, "events"));

function revalidate() {
  revalidatePath("/marcomm/events");
}

export interface ApproveInput {
  eventId: string;
  budget: number;
  eventType: MarcommEventType;
  productNames: string[];
  outletIds: string[];
  allOutlets: boolean;
  measureStart: string;
  measureEnd: string;
  note: string;
}

function validateScope(eventType: MarcommEventType, productNames: string[], outletIds: string[], allOutlets: boolean): string | null {
  if (eventType === "promo" && productNames.filter(Boolean).length === 0) return "Pilih minimal satu produk untuk promo.";
  if (eventType === "event" && !allOutlets && outletIds.filter(Boolean).length === 0) return "Pilih outlet yang terdampak, atau centang Semua Outlet.";
  return null;
}

export async function approveEventAction(input: ApproveInput) {
  const user = await getSessionUser();
  if (!canMarcomm(user)) return { error: "Hanya Marketing Communication yang dapat meng-ACC." };

  if (!(input.budget >= 0)) return { error: "Budget tidak valid." };
  const scopeErr = validateScope(input.eventType, input.productNames, input.outletIds, input.allOutlets);
  if (scopeErr) return { error: scopeErr };
  if (!input.measureStart || !input.measureEnd) return { error: "Tentukan tanggal mulai & selesai." };
  if (new Date(input.measureEnd) < new Date(input.measureStart)) return { error: "Tanggal selesai harus setelah tanggal mulai." };

  const res = await approveReview({
    eventId: input.eventId,
    budget: Math.max(0, Math.round(input.budget || 0)),
    eventType: input.eventType,
    productNames: input.productNames.map((p) => p.trim()).filter(Boolean),
    outletIds: input.outletIds.filter(Boolean),
    allOutlets: input.allOutlets,
    measureStart: input.measureStart,
    measureEnd: input.measureEnd,
    note: input.note?.trim() ?? "",
    approvedBy: user!.id,
  });
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function rejectEventAction(input: { eventId: string; reason: string }) {
  const user = await getSessionUser();
  if (!canMarcomm(user)) return { error: "Tidak punya akses." };
  if (!input.reason?.trim()) return { error: "Isi alasan penolakan." };
  const res = await rejectReview(input.eventId, input.reason.trim(), user!.id);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function resetReviewAction(eventId: string) {
  const user = await getSessionUser();
  if (!canMarcomm(user)) return { error: "Tidak punya akses." };
  const res = await resetReview(eventId);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export interface ProposalActionInput {
  title: string;
  description: string;
  eventType: MarcommEventType;
  productNames: string[];
  outletIds: string[];
  allOutlets: boolean;
  startDate: string;
  endDate: string;
}

/** File a new event/promo proposal (MarComm; also usable by CA if granted). It
 *  lands pre-classified as pending — ACC only sets the budget. */
export async function createMarcommProposalAction(input: ProposalActionInput) {
  const user = await getSessionUser();
  if (!canPropose(user)) return { error: "Tidak punya akses." };
  if (!input.title.trim()) return { error: "Nama event/promo wajib diisi." };
  const scopeErr = validateScope(input.eventType, input.productNames, input.outletIds, input.allOutlets);
  if (scopeErr) return { error: scopeErr };
  if (!input.startDate || !input.endDate) return { error: "Tentukan tanggal mulai & selesai." };
  if (new Date(input.endDate) < new Date(input.startDate)) return { error: "Tanggal selesai harus setelah tanggal mulai." };

  const rec = await createMarcommProposal({
    title: input.title.trim(),
    description: input.description.trim(),
    eventType: input.eventType,
    productNames: input.productNames.map((p) => p.trim()).filter(Boolean),
    outletIds: input.outletIds.filter(Boolean),
    allOutlets: input.allOutlets,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (!rec) return { error: "Gagal menyimpan proposal." };
  revalidate();
  return { ok: true, id: rec.id };
}
