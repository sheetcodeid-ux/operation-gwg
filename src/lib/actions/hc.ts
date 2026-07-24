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
  deleteHcSubmission,
  getHcSubmissionRow,
  startHcProcessing,
} from "@/lib/data/hc";
import { canReachMenu } from "@/lib/nav";
import { r2Enabled, r2Put, R2_PREFIX } from "@/lib/storage/r2";
import type { HcDetails, HcDocType } from "@/lib/hc-shared";
import type { UserProfile } from "@/lib/types";

// Access is department-aware (mirrors the sidebar): supervisors submit, Human
// Capital reviews — including department-aligned `member` accounts, not just
// the `legal`/`supervisor` roles.
const canSubmit = (u: UserProfile | null) => !!u && canReachMenu(u, "hc_submit");
const canReview = (u: UserProfile | null) => !!u && canReachMenu(u, "hc_review");

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file (KTP scan or finished PDF)

async function uploadFile(userId: string, folder: string, file: File): Promise<{ path?: string; error?: string }> {
  if (file.size > MAX_BYTES) return { error: `Berkas "${file.name}" melebihi 8 MB.` };
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return { error: `"${file.name}" harus berupa gambar atau PDF.` };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  // Prefer R2 (keeps Supabase storage free); fall back to Supabase on any error.
  if (r2Enabled()) {
    try {
      const key = `hc/${folder}/${userId}/${name}`;
      await r2Put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
      return { path: `${R2_PREFIX}${key}` };
    } catch (e) {
      console.error("[hc] R2 upload gagal, fallback ke Supabase:", e);
    }
  }
  const path = `${folder}/${userId}/${name}`;
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
  if (!canSubmit(user)) return { error: "Tidak punya akses." };
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
  if (!canSubmit(user)) return { error: "Tidak punya akses." };
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
  if (!canReview(user)) return { error: "Tidak punya akses." };
  const res = await startHcProcessing(id, user!.id);
  if (res.error) return { error: res.error };
  revalidatePath("/hc/antrian");
  return { ok: true };
}

/** Upload the finished document (PDF) HC produced; returns the storage path. */
export async function uploadHcFinalAction(formData: FormData) {
  const user = await getSessionUser();
  if (!canReview(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  return uploadFile(user!.id, "final", file);
}

export async function completeHcRequestAction(input: { id: string; note: string; finalDocPath: string }) {
  const user = await getSessionUser();
  if (!canReview(user)) return { error: "Tidak punya akses." };
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

/** Delete a submission — Super Admin only (clears out test/dummy pengajuan). */
export async function deleteHcRequestAction(id: string) {
  const user = await getSessionUser();
  if (user?.role !== "super_admin") return { error: "Hanya Super Admin yang dapat menghapus pengajuan." };
  const res = await deleteHcSubmission(id);
  if (res.error) return { error: res.error };
  revalidatePath("/hc/antrian");
  revalidatePath("/hc/pengajuan");
  return { ok: true };
}
