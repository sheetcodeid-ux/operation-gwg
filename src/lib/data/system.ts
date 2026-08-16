import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { outletName, userName } from "./store";
import { isR2Key, presignGet, r2Delete, r2KeyOf } from "@/lib/storage/r2";
import type { SysDesk, SysRequestType, SysUrgency, SystemRequest } from "@/lib/system-shared";

/**
 * System-Support request workflow — DB-direct (no SEED hydration).
 *
 * Supervisors raise an IT/system ticket; the Operation (System Support) team
 * triages it in "Antrian System", forwards it into the Work Tracker assigned to
 * a handler, and closes it when done.
 */

interface Row {
  id: string;
  requester_id: string;
  requester_name: string;
  position: string;
  outlet_id: string;
  wa_number: string | null;
  request_type: SysRequestType;
  title: string;
  description: string | null;
  impact: string | null;
  urgency: SysUrgency;
  needed_date: string | null;
  attachment_link: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  status: SystemRequest["status"];
  handler_id: string | null;
  note: string | null;
  result_paths: string[] | null;
  work_task_id: string | null;
  processed_by: string | null;
  processed_at: string | null;
  completed_at: string | null;
  created_at: string;
  ticket_no: string | null;
  desk: SysDesk;
  first_response_at: string | null;
  satisfaction: number | null;
  satisfaction_note: string | null;
}

const SIGN_TTL = 60 * 60;

/** Batch-sign uploaded-attachment paths in one API call → path→URL map. */
async function signBatch(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;
  for (const p of unique) {
    if (!isR2Key(p)) continue;
    try {
      const url = await presignGet(r2KeyOf(p), SIGN_TTL);
      if (url) map.set(p, url);
    } catch {
      /* leave this file's link empty rather than throwing the page */
    }
  }
  const sb = unique.filter((p) => !isR2Key(p));
  if (dbEnabled && sb.length > 0) {
    try {
      const { data } = await db().storage.from("system-attachments").createSignedUrls(sb, SIGN_TTL);
      for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
    } catch {
      /* signing unavailable — rows still render, just without a download link */
    }
  }
  return map;
}

function toRequest(r: Row, signed: Map<string, string>): SystemRequest {
  const fileUrl = r.attachment_path ? signed.get(r.attachment_path) ?? null : null;
  return {
    id: r.id,
    ticketNo: r.ticket_no,
    desk: r.desk ?? "system",
    requesterId: r.requester_id,
    requesterName: r.requester_name,
    position: r.position,
    outletId: r.outlet_id,
    outletName: outletName(r.outlet_id),
    waNumber: r.wa_number,
    requestType: r.request_type,
    title: r.title,
    description: r.description,
    impact: r.impact,
    urgency: r.urgency,
    neededDate: r.needed_date,
    attachmentUrl: fileUrl ?? r.attachment_link,
    attachmentName: r.attachment_path ? r.attachment_name || "Berkas lampiran" : r.attachment_link ? "Link lampiran" : null,
    attachmentIsFile: !!fileUrl,
    status: r.status,
    handlerId: r.handler_id,
    handlerName: r.handler_id ? userName(r.handler_id) : null,
    note: r.note,
    resultUrls: (r.result_paths ?? []).map((p) => signed.get(p)).filter((u): u is string => !!u),
    workTaskId: r.work_task_id,
    processedByName: r.processed_by ? userName(r.processed_by) : null,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    firstResponseAt: r.first_response_at,
    satisfaction: r.satisfaction,
    satisfactionNote: r.satisfaction_note,
  };
}

/**
 * Daftar tiket, terbaru dulu.
 *
 * `desk` WAJIB disebut pemanggilnya. Nilai bawaan diam-diam pernah jadi sumber
 * kebocoran di modul lain: satu pemanggil lupa menyaring, lalu antrean satu
 * meja menampilkan tiket meja lain tanpa ada yang menyadarinya.
 */
export async function listSystemRequests(
  desk: SysDesk,
  requesterId?: string,
): Promise<SystemRequest[]> {
  if (!dbEnabled) return [];
  let q = db()
    .from("system_requests")
    .select("*")
    .eq("desk", desk)
    .order("created_at", { ascending: false })
    .limit(300);
  if (requesterId) q = q.eq("requester_id", requesterId);
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data as Row[];
  const paths = rows.flatMap((r) => [r.attachment_path, ...(r.result_paths ?? [])]).filter((p): p is string => !!p);
  const signed = await signBatch(paths);
  return rows.map((r) => toRequest(r, signed));
}

export async function getSystemRequestRow(id: string): Promise<Row | null> {
  if (!dbEnabled) return null;
  const { data, error } = await db().from("system_requests").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

export interface SysCreateInput {
  requesterId: string;
  requesterName: string;
  position: string;
  outletId: string;
  waNumber: string | null;
  desk: SysDesk;
  requestType: SysRequestType;
  title: string;
  description: string | null;
  impact: string | null;
  urgency: SysUrgency;
  neededDate: string | null;
  attachmentLink: string | null;
  attachmentPath: string | null;
  attachmentName: string | null;
}

/**
 * Nomor tiket berikutnya untuk bulan berjalan: IT-YYYYMM-NNNN.
 *
 * Nomornya dibaca dari tiket TERAKHIR bulan itu, bukan dari jumlah baris —
 * menghitung baris membuat nomor terpakai ulang begitu ada satu tiket dihapus.
 *
 * Kalau dua tiket dibuat pada detik yang sama, keduanya bisa memperebutkan
 * nomor yang sama. Indeks unik di basis data yang memutuskan, dan pemanggilnya
 * mencoba lagi. Nomor kembar jauh lebih merepotkan daripada satu percobaan
 * ulang: dua orang menyebut "tiket IT-202608-0007" untuk dua masalah berbeda.
 */
async function nomorTiketBerikutnya(): Promise<string> {
  const wib = new Date(Date.now() + 7 * 3_600_000);
  const periode = `${wib.getUTCFullYear()}${String(wib.getUTCMonth() + 1).padStart(2, "0")}`;
  const { data } = await db()
    .from("system_requests")
    .select("ticket_no")
    .like("ticket_no", `IT-${periode}-%`)
    .order("ticket_no", { ascending: false })
    .limit(1);
  const terakhir = (data as { ticket_no: string }[] | null)?.[0]?.ticket_no ?? "";
  const urut = Number(terakhir.slice(-4)) || 0;
  return `IT-${periode}-${String(urut + 1).padStart(4, "0")}`;
}

export async function createSystemRequest(input: SysCreateInput): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `sys_${randomUUID()}`;
  const { error } = await db().from("system_requests").insert({
    id,
    ticket_no: await nomorTiketBerikutnya(),
    desk: input.desk,
    requester_id: input.requesterId,
    requester_name: input.requesterName,
    position: input.position,
    outlet_id: input.outletId,
    wa_number: input.waNumber,
    request_type: input.requestType,
    title: input.title,
    description: input.description,
    impact: input.impact,
    urgency: input.urgency,
    needed_date: input.neededDate,
    attachment_link: input.attachmentLink,
    attachment_path: input.attachmentPath,
    attachment_name: input.attachmentName,
    status: "waiting",
    created_at: new Date().toISOString(),
  });
  if (error) return null;
  return { id };
}

/** Waiting → Processing: record the assigned handler, note, and the created task. */
export async function processSystemRequest(
  id: string,
  input: { handlerId: string; note: string; workTaskId: string; processedBy: string; firstResponseAt: string | null },
): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("system_requests")
    .update({
      status: "processing",
      handler_id: input.handlerId,
      note: input.note || null,
      work_task_id: input.workTaskId,
      processed_by: input.processedBy,
      processed_at: new Date().toISOString(),
      // Hanya sentuhan PERTAMA yang dicatat. Kalau ditimpa tiap kali tiket
      // disentuh lagi, angkanya berubah jadi "waktu sentuhan terakhir" dan
      // tiket yang terlantar tiga hari lalu dibuka sebentar akan terlihat
      // seolah direspons seketika.
      first_response_at: input.firstResponseAt ?? new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "waiting");
  return error ? { error: error.message } : {};
}

/** Processing → Done (System Support closes the ticket, with proof photos). */
export async function completeSystemRequest(id: string, resultPaths: string[] = []): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("system_requests")
    .update({ status: "done", result_paths: resultPaths, completed_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "done");
  return error ? { error: error.message } : {};
}

/**
 * Penilaian pelapor atas tiket yang sudah ditutup.
 *
 * Dibatasi ke tiket miliknya sendiri DAN yang statusnya sudah selesai. Dua
 * syarat itu ditegakkan di kueri, bukan hanya di layar: tanpa `eq` pada
 * pelapor, siapa pun yang tahu id tiket bisa menilai tiket orang lain, dan
 * angka kepuasan tim IT jadi bisa dikarang dari luar.
 */
export async function simpanKepuasan(
  id: string,
  requesterId: string,
  nilai: number,
  catatan: string,
): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { data, error } = await db()
    .from("system_requests")
    .update({ satisfaction: nilai, satisfaction_note: catatan || null, satisfaction_at: new Date().toISOString() })
    .eq("id", id)
    .eq("requester_id", requesterId)
    .eq("status", "done")
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Tiket tidak ditemukan, bukan milik Anda, atau belum selesai." };
  return {};
}

/** Delete a request (and all uploaded files) — Super Admin cleanup. */
export async function deleteSystemRequest(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row = await getSystemRequestRow(id);
  const files = [row?.attachment_path, ...(row?.result_paths ?? [])].filter((p): p is string => !!p);
  await Promise.all(files.filter(isR2Key).map((p) => r2Delete(r2KeyOf(p))));
  const sb = files.filter((p) => !isR2Key(p));
  if (sb.length > 0) await db().storage.from("system-attachments").remove(sb);
  const { error } = await db().from("system_requests").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
