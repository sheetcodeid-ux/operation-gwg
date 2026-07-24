"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db, dbEnabled } from "@/lib/data/db";
import { getOutlet, getOutlets, outletName, userName } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import { saveNotification } from "@/lib/data/persist";
import {
  completeHcSubmission,
  createHcSubmission,
  getHcSubmissionRow,
  startHcProcessing,
} from "@/lib/data/hc";
import { canReviewHc, canSubmitHc, type HcDetails, type HcDocType } from "@/lib/hc-shared";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file (KTP scan or finished PDF)

async function uploadFile(userId: string, folder: string, file: File): Promise<{ path?: string; error?: string }> {
  if (file.size > MAX_BYTES) return { error: `Berkas "${file.name}" melebihi 8 MB.` };
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return { error: `"${file.name}" harus berupa gambar atau PDF.` };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `${folder}/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  const { error } = await db().storage.from("hc-documents").upload(path, file, { contentType: file.type });
  if (error) return { error: `Upload gagal: ${error.message}` };
  return { path };
}

/* ------------------------------------------------------------------ */
/* Supervisor — submit a request                                       */
/* ------------------------------------------------------------------ */

/** Upload the employee KTP scan; returns the storage path (kept private). */
export async function uploadHcKtpAction(formData: FormData) {
  const user = await getSessionUser();
  if (!canSubmitHc(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  return uploadFile(user!.id, "ktp", file);
}

export interface HcSubmitInput {
  employeeName: string;
  docType: HcDocType;
  outletId: string;
  ktpPath: string | null;
  details: HcDetails;
}

export async function submitHcRequestAction(input: HcSubmitInput) {
  const user = await getSessionUser();
  if (!canSubmitHc(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Database belum aktif." };

  const employeeName = input.employeeName?.trim();
  if (!employeeName) return { error: "Nama karyawan wajib diisi." };
  if (!input.outletId) return { error: "Cabang wajib dipilih." };
  if (!canAccessOutlet(user!, input.outletId, getOutlets())) return { error: "Cabang di luar cakupan Anda." };
  if (!["bpjs", "pkwt", "teguran"].includes(input.docType)) return { error: "Jenis pengajuan tidak valid." };

  // Doc-type-specific required fields.
  const d = input.details ?? {};
  if (input.docType === "bpjs" && !d.motherName?.trim()) return { error: "Nama ibu kandung wajib untuk BPJS." };
  if (input.docType === "teguran" && !d.chronology?.trim()) return { error: "Kronologi pelanggaran wajib untuk Surat Teguran." };

  const rec = await createHcSubmission({
    employeeName,
    docType: input.docType,
    outletId: input.outletId,
    supervisorId: user!.id,
    ktpPath: input.ktpPath ?? null,
    details: d,
  });
  if (!rec) return { error: "Gagal menyimpan pengajuan. Coba lagi." };

  revalidatePath("/hc/pengajuan");
  revalidatePath("/hc/antrian");
  return { ok: true, id: rec.id };
}

/* ------------------------------------------------------------------ */
/* Human Capital — process the queue                                   */
/* ------------------------------------------------------------------ */

export async function startHcProcessingAction(id: string) {
  const user = await getSessionUser();
  if (!canReviewHc(user)) return { error: "Tidak punya akses." };
  const res = await startHcProcessing(id, user!.id);
  if (res.error) return { error: res.error };
  revalidatePath("/hc/antrian");
  return { ok: true };
}

/** Upload the finished document (PDF) HC produced; returns the storage path. */
export async function uploadHcFinalAction(formData: FormData) {
  const user = await getSessionUser();
  if (!canReviewHc(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  return uploadFile(user!.id, "final", file);
}

export async function completeHcRequestAction(input: { id: string; note: string; finalDocPath: string }) {
  const user = await getSessionUser();
  if (!canReviewHc(user)) return { error: "Tidak punya akses." };
  if (!input.finalDocPath) return { error: "Unggah dokumen jadi (PDF) terlebih dahulu." };

  const rec = await getHcSubmissionRow(input.id);
  if (!rec) return { error: "Pengajuan tidak ditemukan." };
  if (rec.status === "done") return { error: "Pengajuan sudah selesai." };

  const res = await completeHcSubmission(input.id, user!.id, input.note?.trim() ?? "", input.finalDocPath);
  if (res.error) return { error: res.error };

  // Notify the submitting supervisor — they can now download the finished doc.
  const label = getOutlet(rec.outlet_id) ? outletName(rec.outlet_id) : rec.outlet_id;
  await saveNotification({
    id: `ntf_${randomUUID()}`,
    kind: "hc_done",
    title: "Dokumen selesai diproses",
    message: `Dokumen ${rec.employee_name} (${label}) telah diselesaikan oleh ${userName(user!.id)} — siap diunduh.`,
    targetUser: rec.supervisor_id,
    severity: "info",
    read: false,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/hc/antrian");
  revalidatePath("/hc/pengajuan");
  return { ok: true };
}
