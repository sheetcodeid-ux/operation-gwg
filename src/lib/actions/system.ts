"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db, dbEnabled } from "@/lib/data/db";
import { getOutlets, userName } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import { canReachMenu } from "@/lib/nav";
import { createTask } from "@/lib/data/mutations";
import { persistMessage, saveNotification } from "@/lib/data/persist";
import {
  completeSystemRequest,
  createSystemRequest,
  deleteSystemRequest,
  getSystemRequestRow,
  processSystemRequest,
  simpanKepuasan,
} from "@/lib/data/system";
import { r2Enabled, r2Put, R2_PREFIX } from "@/lib/storage/r2";
import { isSystemSupport, SYS_REQUEST_TYPES, SYS_TYPE_LABEL, type SysRequestType, type SysUrgency } from "@/lib/system-shared";
import type { Priority, UserProfile } from "@/lib/types";

const canSubmit = (u: UserProfile | null) => !!u && canReachMenu(u, "sys_submit");
// Only the System Support team (Operational + jabatan "System Support") — plus
// Super Admin — may triage, forward and close system tickets.
const canReview = (u: UserProfile | null) => isSystemSupport(u);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per supporting file
// Diturunkan dari daftar kategorinya, bukan disalin ulang. Salinan kedua pasti
// tertinggal saat kategori ditambah — dan gejalanya membingungkan: kartunya ada
// di layar, tapi kiriman ditolak "Jenis request tidak valid".
const REQ_TYPES: SysRequestType[] = SYS_REQUEST_TYPES.map((t) => t.value);
const URGENCIES: SysUrgency[] = ["urgent", "normal", "low"];
const URGENCY_PRIORITY: Record<SysUrgency, Priority> = { urgent: "high", normal: "medium", low: "low" };

/** Store one file in R2 (fallback Supabase) under the system/<folder> prefix. */
async function putSystemFile(userId: string, folder: string, file: File): Promise<{ path?: string; name?: string; error?: string }> {
  if (file.size > MAX_BYTES) return { error: `Berkas "${file.name}" melebihi 10 MB.` };
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return { error: `"${file.name}" harus berupa foto atau PDF.` };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const name = `${folder}/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  if (r2Enabled()) {
    try {
      const key = `system/${name}`;
      await r2Put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
      return { path: `${R2_PREFIX}${key}`, name: file.name };
    } catch (e) {
      console.error("[system] R2 upload gagal, fallback ke Supabase:", e);
    }
  }
  const { error } = await db().storage.from("system-attachments").upload(name, file, { contentType: file.type });
  if (error) return { error: `Upload gagal: ${error.message}` };
  return { path: name, name: file.name };
}

/** Upload a supporting photo/file (supervisor, at submission). */
export async function uploadSystemAttachmentAction(formData: FormData) {
  const user = await getSessionUser();
  if (!canSubmit(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  return putSystemFile(user!.id, "attachment", file);
}

/** Upload a proof-of-repair photo (System Support, at completion). */
export async function uploadSystemResultAction(formData: FormData) {
  const user = await getSessionUser();
  if (!canReview(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  return putSystemFile(user!.id, "result", file);
}

/* ------------------------------------------------------------------ */
/* Supervisor — raise a request                                        */
/* ------------------------------------------------------------------ */

export interface SysSubmitInput {
  outletId: string;
  waNumber: string;
  requestType: SysRequestType;
  title: string;
  description: string;
  impact: string;
  urgency: SysUrgency;
  neededDate: string;
  attachmentLink: string;
  attachmentPath: string | null;
  attachmentName: string | null;
}

export async function submitSystemRequestAction(input: SysSubmitInput) {
  const user = await getSessionUser();
  if (!canSubmit(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Database belum aktif." };

  const title = input.title?.trim();
  if (!title) return { error: "Judul request wajib diisi." };
  // Cabang OPSIONAL. Help desk ini dipakai seluruh departemen, dan staf kantor
  // pusat (Finance, Creative, HC) memang tidak bertugas di cabang mana pun —
  // mewajibkannya berarti memaksa mereka memilih cabang yang tidak ada
  // hubungannya dengan kendalanya, dan datanya jadi menyesatkan.
  if (input.outletId && !canAccessOutlet(user!, input.outletId, getOutlets())) {
    return { error: "Cabang di luar cakupan Anda." };
  }
  if (!REQ_TYPES.includes(input.requestType)) return { error: "Jenis request tidak valid." };
  if (!URGENCIES.includes(input.urgency)) return { error: "Urgensi tidak valid." };
  if (!input.description?.trim()) return { error: "Deskripsi request wajib diisi." };

  const rec = await createSystemRequest({
    requesterId: user!.id,
    requesterName: user!.name,
    // Diambil dari profilnya. Dulu dipatok "Supervisor" karena hanya supervisor
    // yang bisa mengajukan; sekarang seluruh departemen bisa, dan jabatan yang
    // salah membuat tim IT menghubungi orang dengan anggapan yang keliru.
    position: (user!.jabatan ?? "").trim() || user!.department || "—",
    outletId: input.outletId,
    waNumber: input.waNumber?.trim() || null,
    requestType: input.requestType,
    title,
    description: input.description?.trim() || null,
    impact: input.impact?.trim() || null,
    urgency: input.urgency,
    neededDate: input.neededDate || null,
    attachmentLink: input.attachmentLink?.trim() || null,
    attachmentPath: input.attachmentPath ?? null,
    attachmentName: input.attachmentName ?? null,
  });
  if (!rec) return { error: "Gagal menyimpan request. Coba lagi." };

  revalidatePath("/system/pengajuan");
  revalidatePath("/system/antrian");
  return { ok: true, id: rec.id };
}

/* ------------------------------------------------------------------ */
/* System Support — triage & forward to Work Tracker                   */
/* ------------------------------------------------------------------ */

export async function processSystemRequestAction(input: { id: string; handlerId: string; note: string }) {
  const user = await getSessionUser();
  if (!canReview(user)) return { error: "Tidak punya akses." };
  if (!input.handlerId) return { error: "Pilih penanggung jawab (PIC) terlebih dahulu." };

  const req = await getSystemRequestRow(input.id);
  if (!req) return { error: "Request tidak ditemukan." };
  if (req.status !== "waiting") return { error: "Request sudah diproses." };

  // Forward into the Work Tracker as a System Operation task for the handler.
  const desc = [
    `Jenis: ${SYS_TYPE_LABEL[req.request_type]}`,
    req.description ? `\nDeskripsi:\n${req.description}` : "",
    req.impact ? `\n\nDampak jika tidak ditangani:\n${req.impact}` : "",
    `\n\nPengaju: ${req.requester_name}${req.position ? ` (${req.position})` : ""}${req.wa_number ? ` · WA ${req.wa_number}` : ""}`,
    req.attachment_link ? `\nLampiran: ${req.attachment_link}` : "",
  ].join("");

  let task;
  try {
    task = await createTask({
      title: `[System] ${req.title}`,
      description: desc.trim(),
      category: "IT / Systems",
      priority: URGENCY_PRIORITY[req.urgency],
      status: "ongoing",
      division: "Operational",
      outletId: req.outlet_id,
      picIds: [input.handlerId],
      picId: input.handlerId,
      startDate: new Date().toISOString(),
      dueDate: req.needed_date ? new Date(`${req.needed_date}T12:00:00`).toISOString() : new Date().toISOString(),
      progress: 0,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  const res = await processSystemRequest(input.id, {
    handlerId: input.handlerId,
    note: input.note?.trim() ?? "",
    workTaskId: task.id,
    processedBy: user!.id,
    firstResponseAt: req.first_response_at,
  });
  if (res.error) return { error: res.error };

  // Tell the supervisor their ticket is being handled.
  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "sys_update",
    title: "Request system sedang diproses",
    message: `"${req.title}" sedang dikerjakan oleh ${userName(input.handlerId)} (System Support).`,
    targetUser: req.requester_id,
    href: "/system/pengajuan",
    severity: "info",
    read: false,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/system/antrian");
  revalidatePath("/system/pengajuan");
  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
  return { ok: true, taskId: task.id };
}

export async function completeSystemRequestAction(input: { id: string; resultPaths?: string[] }) {
  const user = await getSessionUser();
  if (!canReview(user)) return { error: "Tidak punya akses." };
  const req = await getSystemRequestRow(input.id);
  if (!req) return { error: "Request tidak ditemukan." };
  const resultPaths = (input.resultPaths ?? []).filter((p) => typeof p === "string" && p);
  const res = await completeSystemRequest(input.id, resultPaths);
  if (res.error) return { error: res.error };

  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "sys_update",
    title: "Request system selesai",
    message: `"${req.title}" telah diselesaikan oleh System Support${resultPaths.length ? " (dengan bukti perbaikan)" : ""}.`,
    targetUser: req.requester_id,
    href: "/system/pengajuan",
    severity: "info",
    read: false,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/system/antrian");
  revalidatePath("/system/pengajuan");
  return { ok: true };
}

/** Delete a request — Super Admin only. */
export async function deleteSystemRequestAction(id: string) {
  const user = await getSessionUser();
  if (user?.role !== "super_admin") return { error: "Hanya Super Admin yang dapat menghapus request." };
  const res = await deleteSystemRequest(id);
  if (res.error) return { error: res.error };
  revalidatePath("/system/antrian");
  revalidatePath("/system/pengajuan");
  return { ok: true };
}

/**
 * Pelapor menilai tiketnya sendiri setelah ditutup.
 *
 * Selama ini tiket ditutup sepihak oleh yang menangani, dan tidak ada satu pun
 * tanda apakah masalahnya benar-benar beres di tempat pelapor. Nilai ini yang
 * membedakan "ditutup" dari "selesai".
 *
 * Pemeriksaan kepemilikan dan status ada di lapisan data, ditegakkan lewat
 * kueri — bukan di sini — supaya tidak bisa dilewati lewat jalur lain.
 */
export async function beriKepuasanAction(input: { id: string; nilai: number; catatan?: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "Tidak punya akses." };
  if (!Number.isInteger(input.nilai) || input.nilai < 1 || input.nilai > 5) {
    return { error: "Nilai kepuasan harus antara 1 sampai 5." };
  }
  const res = await simpanKepuasan(input.id, user.id, input.nilai, (input.catatan ?? "").trim().slice(0, 500));
  if (res.error) return { error: res.error };
  revalidatePath("/system/pengajuan");
  revalidatePath("/system/antrian");
  return { ok: true };
}
