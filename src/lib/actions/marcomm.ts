"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { approveReview, rejectReview, resetReview } from "@/lib/data/marcomm";
import type { MarcommEventType } from "@/lib/marcomm-shared";
import type { UserProfile } from "@/lib/types";

const canMarcomm = (u: UserProfile | null) => !!u && canReachMenu(u, "mc_events");

function revalidate() {
  revalidatePath("/marcomm/events");
}

export interface ApproveInput {
  eventId: string;
  budget: number;
  eventType: MarcommEventType;
  productNames: string[];
  outletIds: string[];
  measureStart: string;
  measureEnd: string;
  note: string;
}

export async function approveEventAction(input: ApproveInput) {
  const user = await getSessionUser();
  if (!canMarcomm(user)) return { error: "Hanya Marketing Communication yang dapat meng-ACC." };

  if (!(input.budget >= 0)) return { error: "Budget tidak valid." };
  if (input.eventType === "promo" && input.productNames.filter(Boolean).length === 0)
    return { error: "Pilih minimal satu produk untuk promo." };
  if (input.eventType === "event" && input.outletIds.filter(Boolean).length === 0)
    return { error: "Pilih minimal satu outlet yang terdampak." };
  if (!input.measureStart || !input.measureEnd) return { error: "Tentukan tanggal mulai & selesai." };
  if (new Date(input.measureEnd) < new Date(input.measureStart)) return { error: "Tanggal selesai harus setelah tanggal mulai." };

  const res = await approveReview({
    eventId: input.eventId,
    budget: Math.max(0, Math.round(input.budget || 0)),
    eventType: input.eventType,
    productNames: input.productNames.map((p) => p.trim()).filter(Boolean),
    outletIds: input.outletIds.filter(Boolean),
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
