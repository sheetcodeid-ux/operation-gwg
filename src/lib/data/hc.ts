import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { outletName, userName } from "./store";
import { isR2Key, presignGet, r2Delete, r2KeyOf } from "@/lib/storage/r2";
import { HC_DOC_LABEL, type HcDetails, type HcDocType, type HcSubmission } from "@/lib/hc-shared";

/**
 * Human Capital document workflow — DB-direct (no SEED hydration).
 *
 * Supervisors submit an employee-document request (BPJS / PKWT / Surat Teguran);
 * HC reviews it, processes it, and returns a finished PDF. Files (KTP scan +
 * finished doc) live in the private `hc-documents` bucket and are only ever
 * exposed as short-lived signed URLs, since a KTP is PII.
 *
 * Performance: signed URLs are generated in ONE batch call per file kind
 * (`createSignedUrls`) instead of one request per row, so a full queue loads
 * fast even with hundreds of submissions.
 */

interface Row {
  id: string;
  employee_name: string;
  doc_type: HcDocType;
  outlet_id: string;
  supervisor_id: string;
  ktp_path: string | null;
  details: HcDetails | null;
  status: HcSubmission["status"];
  hc_note: string | null;
  final_doc_path: string | null;
  processed_by: string | null;
  processed_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
}

const SIGN_TTL = 60 * 60; // 1 hour — links are re-signed on every page load.

/**
 * Nama berkas yang aman dipakai di header Content-Disposition, dengan ekstensi
 * asli dipertahankan supaya berkasnya tetap terbuka di aplikasi yang benar.
 */
function safeFileName(base: string, path: string): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(path)?.[1]?.toLowerCase() ?? "pdf";
  const clean = base.replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 100);
  return `${clean || "Dokumen"}.${ext}`;
}

/**
 * Sign a set of storage paths → path→URL map. R2 keys are presigned locally
 * (cheap HMAC); Supabase paths are batch-signed in one API call.
 *
 * `names` memberi nama unduhan per path. Nama itu HARUS ikut ditandatangani di
 * sini — menempelkannya ke URL yang sudah jadi membatalkan tanda tangan R2.
 */
async function signBatch(paths: string[], names?: Map<string, string>): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;
  // R2-stored files — a single bad key must never blank the whole page.
  for (const p of unique) {
    if (!isR2Key(p)) continue;
    try {
      const url = await presignGet(r2KeyOf(p), SIGN_TTL, names?.get(p));
      if (url) map.set(p, url);
    } catch {
      /* leave this file's link empty rather than throwing the page */
    }
  }
  // Supabase-stored files (legacy / fallback). Namanya juga diberikan saat
  // menandatangani, bukan ditempel setelahnya — prinsip yang sama dengan R2.
  const sb = unique.filter((p) => !isR2Key(p));
  if (dbEnabled && sb.length > 0) {
    try {
      const withName = sb.filter((p) => names?.get(p));
      const plain = sb.filter((p) => !names?.get(p));
      if (plain.length > 0) {
        const { data } = await db().storage.from("hc-documents").createSignedUrls(plain, SIGN_TTL);
        for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
      }
      for (const p of withName) {
        const { data } = await db()
          .storage.from("hc-documents")
          .createSignedUrl(p, SIGN_TTL, { download: names!.get(p)! });
        if (data?.signedUrl) map.set(p, data.signedUrl);
      }
    } catch {
      /* signing unavailable — rows still render, just without a download link */
    }
  }
  return map;
}

function toSubmission(r: Row, ktpUrl: string | null, finalDocUrl: string | null): HcSubmission {
  return {
    id: r.id,
    employeeName: r.employee_name,
    docType: r.doc_type,
    outletId: r.outlet_id,
    outletName: outletName(r.outlet_id),
    supervisorId: r.supervisor_id,
    supervisorName: userName(r.supervisor_id),
    ktpUrl,
    details: r.details ?? {},
    status: r.status,
    hcNote: r.hc_note,
    finalDocUrl,
    processedByName: r.processed_by ? userName(r.processed_by) : null,
    completedByName: r.completed_by ? userName(r.completed_by) : null,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

export interface ListHcOptions {
  /** Scope to a single supervisor's own submissions. */
  supervisorId?: string;
  /** Sign the KTP scan too (HC review needs it; supervisor list doesn't). */
  withKtp?: boolean;
}

/** List submissions, newest first. Signs the finished doc always, KTP on demand. */
export async function listHcSubmissions(opts: ListHcOptions = {}): Promise<HcSubmission[]> {
  if (!dbEnabled) return [];
  let q = db().from("hc_submissions").select("*").order("created_at", { ascending: false }).limit(200);
  if (opts.supervisorId) q = q.eq("supervisor_id", opts.supervisorId);
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data as Row[];

  // Nama unduhan dirakit di sini — sisi server tahu nama karyawan & jenis
  // dokumennya, dan hanya di sinilah nama itu masih bisa ikut ditandatangani.
  const finalNames = new Map<string, string>();
  const ktpNames = new Map<string, string>();
  for (const r of rows) {
    const who = (r.employee_name || "Dokumen").trim();
    if (r.final_doc_path) finalNames.set(r.final_doc_path, safeFileName(`${who} - ${HC_DOC_LABEL[r.doc_type]}`, r.final_doc_path));
    if (r.ktp_path) ktpNames.set(r.ktp_path, safeFileName(`KTP ${who}`, r.ktp_path));
  }

  const [finalMap, ktpMap] = await Promise.all([
    signBatch(rows.map((r) => r.final_doc_path).filter((p): p is string => !!p), finalNames),
    opts.withKtp
      ? signBatch(rows.map((r) => r.ktp_path).filter((p): p is string => !!p), ktpNames)
      : Promise.resolve(new Map<string, string>()),
  ]);

  return rows.map((r) =>
    toSubmission(r, r.ktp_path ? ktpMap.get(r.ktp_path) ?? null : null, r.final_doc_path ? finalMap.get(r.final_doc_path) ?? null : null),
  );
}

export async function getHcSubmissionRow(id: string): Promise<Row | null> {
  if (!dbEnabled) return null;
  const { data, error } = await db().from("hc_submissions").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

export interface HcCreateInput {
  employeeName: string;
  docType: HcDocType;
  outletId: string;
  supervisorId: string;
  ktpPath: string | null;
  details: HcDetails;
}

export async function createHcSubmission(input: HcCreateInput): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `hc_${randomUUID()}`;
  const { error } = await db().from("hc_submissions").insert({
    id,
    employee_name: input.employeeName,
    doc_type: input.docType,
    outlet_id: input.outletId,
    supervisor_id: input.supervisorId,
    ktp_path: input.ktpPath,
    details: input.details,
    status: "waiting",
    created_at: new Date().toISOString(),
  });
  if (error) return null;
  return { id };
}

/** Waiting → Processing (HC claims the item). */
export async function startHcProcessing(id: string, userId: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("hc_submissions")
    .update({ status: "processing", processed_by: userId, processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "waiting");
  return error ? { error: error.message } : {};
}

/** Processing → Menunggu Berkas (pending): HC records info (e.g. No. BPJS) but
 *  the result file isn't issued yet. Awaits the file to finish. */
export async function holdHcSubmission(id: string, note: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("hc_submissions")
    .update({ status: "pending", hc_note: note || null })
    .eq("id", id)
    .eq("status", "processing");
  return error ? { error: error.message } : {};
}

/**
 * Menutup pengajuan yang batal — tanpa dokumen terbit.
 *
 * Bukan penghapusan, dan itu disengaja: siapa yang membatalkan dan alasannya
 * tetap tersimpan, karena pertanyaan "kenapa surat itu tidak jadi" muncul
 * justru berminggu-minggu kemudian. Yang sudah selesai tidak bisa dibatalkan —
 * dokumennya sudah terbit dan sudah ada di tangan orang.
 */
export async function rejectHcSubmission(id: string, userId: string, alasan: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("hc_submissions")
    .update({
      status: "rejected",
      hc_note: alasan,
      processed_by: userId,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["waiting", "processing", "pending"]);
  return error ? { error: error.message } : {};
}

/** Processing/Pending → Done (HC attaches the finished doc + optional note). Locks the item. */
export async function completeHcSubmission(
  id: string,
  userId: string,
  note: string,
  finalDocPath: string,
): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("hc_submissions")
    .update({
      status: "done",
      hc_note: note || null,
      final_doc_path: finalDocPath || null,
      completed_by: userId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["processing", "pending"]); // only from an in-progress state
  return error ? { error: error.message } : {};
}

/** Delete a submission and its stored files (super-admin cleanup of test data). */
export async function deleteHcSubmission(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row = await getHcSubmissionRow(id);
  const files = [row?.ktp_path, row?.final_doc_path].filter((p): p is string => !!p);
  await Promise.all(files.filter(isR2Key).map((p) => r2Delete(r2KeyOf(p))));
  const sb = files.filter((p) => !isR2Key(p));
  if (sb.length > 0) await db().storage.from("hc-documents").remove(sb);
  const { error } = await db().from("hc_submissions").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
