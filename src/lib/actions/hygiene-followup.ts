"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { dbEnabled } from "@/lib/data/db";
import { openDirectThread, sendMessage } from "@/lib/data/chat";
import {
  followupCountsByAudit,
  getFollowup,
  pendingFollowupsFor,
  raiseFollowup,
  resolveFollowup,
} from "@/lib/data/hygiene-followup";
import { getOutlets, getUsers } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import type { ChatAttachment, HygieneFollowup } from "@/lib/chat-shared";

/**
 * Tindak lanjut temuan hygiene lewat Pesan.
 *
 * Pemeriksa melihat foto kotor → kirim ke supervisor outletnya → temuan itu
 * menggantung dengan tanda merah di obrolan sampai supervisornya menutupnya
 * DENGAN foto bukti.
 */

/**
 * Supervisor yang bertanggung jawab atas sebuah outlet.
 *
 * Penugasan yang BENAR ada di `users.outletIds` — itu yang diisi lewat User
 * Management. Kolom `outlets.supervisorId` adalah peninggalan lama yang di
 * basis data ini menunjuk akun Admin untuk SETIAP outlet; memakainya lebih dulu
 * membuat semua temuan terkirim ke Admin, bukan ke supervisor cabangnya.
 *
 * Kolom lama tetap dipakai sebagai cadangan, tapi hanya kalau orangnya memang
 * seorang supervisor — bukan akun admin.
 */
function supervisorOf(outletId: string): { id: string; name: string } | null {
  const outlet = getOutlets().find((o) => o.id === outletId);
  if (!outlet) return null;

  const byAssignment = getUsers().find(
    (u) =>
      u.active &&
      u.role === "supervisor" &&
      (u.outletIds ?? []).some((id) => id === outlet.id || id === outlet.code),
  );
  if (byAssignment) return { id: byAssignment.id, name: byAssignment.name };

  const legacy = outlet.supervisorId
    ? getUsers().find((u) => u.id === outlet.supervisorId && u.active && u.role === "supervisor")
    : null;
  return legacy ? { id: legacy.id, name: legacy.name } : null;
}

/** Siapa yang akan menerima temuan untuk outlet ini (dipakai label tombol). */
export async function hygieneSupervisorAction(outletId: string): Promise<{ id: string; name: string } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return supervisorOf(outletId);
}

export async function hygieneRaiseFollowupAction(input: {
  hygieneId: string;
  outletId: string;
  photo: ChatAttachment;
  area: string;
  note: string;
}): Promise<{ threadId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };

  // Hanya untuk outlet yang memang boleh ia lihat — kalau tidak, id outlet
  // tebakan bisa dipakai mengirim temuan ke cabang mana pun.
  if (!canAccessOutlet(user, input.outletId, getOutlets())) {
    return { error: "Tidak punya akses ke outlet itu." };
  }

  const spv = supervisorOf(input.outletId);
  if (!spv) return { error: "Outlet ini belum punya supervisor aktif — atur dulu di User Management." };
  if (spv.id === user.id) return { error: "Anda supervisor outlet ini; kirimkan ke rekan lain bila perlu." };
  if (!input.note.trim()) return { error: "Tulis dulu apa yang perlu diperbaiki." };

  try {
    const threadId = await openDirectThread(user.id, spv.id);
    const res = await raiseFollowup({
      hygieneId: input.hygieneId,
      outletId: input.outletId,
      photo: input.photo,
      area: input.area,
      note: input.note.trim(),
      raisedBy: user.id,
      assignedTo: spv.id,
      threadId,
    });
    if (res.error || !res.id) return { error: res.error ?? "Gagal membuat temuan." };

    const sent = await sendMessage({
      threadId,
      senderId: user.id,
      body: input.note.trim(),
      ref: { kind: "hygiene", id: res.id },
    });
    if (sent.error) return { error: sent.error };

    revalidatePath("/pesan");
    revalidatePath("/hygiene");
    return { threadId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim temuan." };
  }
}

export async function hygieneFollowupAction(id: string): Promise<HygieneFollowup | null> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return null;
  return getFollowup(id);
}

export async function hygieneResolveFollowupAction(input: {
  id: string;
  resolution: string;
  proof: ChatAttachment[];
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };

  const before = await getFollowup(input.id);
  if (!before) return { error: "Temuan tidak ditemukan." };

  const res = await resolveFollowup({
    id: input.id,
    userId: user.id,
    resolution: input.resolution,
    proof: input.proof,
  });
  if (res.error) return { error: res.error };

  // Bukti ikut dikirim ke obrolan yang sama, supaya pelapor melihatnya tanpa
  // harus membuka halaman lain.
  if (before.threadId) {
    await sendMessage({
      threadId: before.threadId,
      senderId: user.id,
      body: input.resolution.trim() || "Sudah ditindaklanjuti.",
      attachments: input.proof,
      ref: { kind: "hygiene", id: input.id },
    });
  }

  revalidatePath("/pesan");
  revalidatePath("/hygiene");
  return { ok: true };
}

/** Temuan yang masih menggantung untuk pengguna ini — dasar lencana merah. */
export async function hygienePendingFollowupsAction(): Promise<HygieneFollowup[]> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return [];
  return pendingFollowupsFor(user.id);
}

/** Berapa temuan sudah dikirim per audit — menandai tombol di halaman Hygiene. */
export async function hygieneFollowupCountsAction(hygieneIds: string[]): Promise<Record<string, number>> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return {};
  return Object.fromEntries(await followupCountsByAudit(hygieneIds));
}
