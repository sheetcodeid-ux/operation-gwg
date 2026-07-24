"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { dbEnabled } from "@/lib/data/db";
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
} from "@/lib/data/system";
import { SYS_TYPE_LABEL, type SysRequestType, type SysUrgency } from "@/lib/system-shared";
import type { Priority, UserProfile } from "@/lib/types";

const canSubmit = (u: UserProfile | null) => !!u && canReachMenu(u, "sys_submit");
const canReview = (u: UserProfile | null) => !!u && canReachMenu(u, "sys_review");

const REQ_TYPES: SysRequestType[] = ["fitur", "bug", "akses", "hardware", "training", "lainnya"];
const URGENCIES: SysUrgency[] = ["urgent", "normal", "low"];
const URGENCY_PRIORITY: Record<SysUrgency, Priority> = { urgent: "high", normal: "medium", low: "low" };

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
}

export async function submitSystemRequestAction(input: SysSubmitInput) {
  const user = await getSessionUser();
  if (!canSubmit(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Database belum aktif." };

  const title = input.title?.trim();
  if (!title) return { error: "Judul request wajib diisi." };
  if (!input.outletId) return { error: "Cabang wajib dipilih." };
  if (!canAccessOutlet(user!, input.outletId, getOutlets())) return { error: "Cabang di luar cakupan Anda." };
  if (!REQ_TYPES.includes(input.requestType)) return { error: "Jenis request tidak valid." };
  if (!URGENCIES.includes(input.urgency)) return { error: "Urgensi tidak valid." };
  if (!input.description?.trim()) return { error: "Deskripsi request wajib diisi." };

  const rec = await createSystemRequest({
    requesterId: user!.id,
    requesterName: user!.name,
    position: "Supervisor",
    outletId: input.outletId,
    waNumber: input.waNumber?.trim() || null,
    requestType: input.requestType,
    title,
    description: input.description?.trim() || null,
    impact: input.impact?.trim() || null,
    urgency: input.urgency,
    neededDate: input.neededDate || null,
    attachmentLink: input.attachmentLink?.trim() || null,
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
    `\n\nPengaju: ${req.requester_name} (Supervisor)${req.wa_number ? ` · WA ${req.wa_number}` : ""}`,
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
  });
  if (res.error) return { error: res.error };

  // Tell the supervisor their ticket is being handled.
  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "sys_update",
    title: "Request system sedang diproses",
    message: `"${req.title}" sedang dikerjakan oleh ${userName(input.handlerId)} (System Support).`,
    targetUser: req.requester_id,
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

export async function completeSystemRequestAction(id: string) {
  const user = await getSessionUser();
  if (!canReview(user)) return { error: "Tidak punya akses." };
  const req = await getSystemRequestRow(id);
  if (!req) return { error: "Request tidak ditemukan." };
  const res = await completeSystemRequest(id);
  if (res.error) return { error: res.error };

  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "sys_update",
    title: "Request system selesai",
    message: `"${req.title}" telah diselesaikan oleh System Support.`,
    targetUser: req.requester_id,
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
