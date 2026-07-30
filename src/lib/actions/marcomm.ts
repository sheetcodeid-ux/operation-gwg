"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { approveReview, rejectReview, resetReview } from "@/lib/data/marcomm";
import { createEvent } from "@/lib/data/mutations";
import { getOutlet } from "@/lib/data/store";
import { persistMessage } from "@/lib/data/persist";
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

/** Marketing Communication proposes an event/promo directly (not only CA). It
 *  lands in the queue like a CA proposal; budget & classification are set at ACC. */
export async function createMarcommEventAction(input: { name: string; outletId: string; description: string; startDate: string; endDate: string }) {
  const user = await getSessionUser();
  if (!canMarcomm(user)) return { error: "Tidak punya akses." };
  if (!input.name.trim()) return { error: "Nama event wajib diisi." };
  if (!input.outletId) return { error: "Pilih outlet." };
  if (!input.startDate || !input.endDate) return { error: "Tentukan tanggal mulai & selesai." };
  if (new Date(input.endDate) < new Date(input.startDate)) return { error: "Tanggal selesai harus setelah tanggal mulai." };

  const outlet = getOutlet(input.outletId);
  try {
    await createEvent({
      name: input.name.trim(),
      outletId: input.outletId,
      picId: outlet?.picId || user!.id,
      description: input.description.trim(),
      budget: 0, // set by MarComm at ACC
      startDate: new Date(input.startDate).toISOString(),
      endDate: new Date(input.endDate).toISOString(),
      milestone: "planning",
      status: "upcoming",
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }
  revalidate();
  return { ok: true };
}
