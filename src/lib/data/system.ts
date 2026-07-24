import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { outletName, userName } from "./store";
import type { SysRequestType, SysUrgency, SystemRequest } from "@/lib/system-shared";

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
  work_task_id: string | null;
  processed_by: string | null;
  processed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const SIGN_TTL = 60 * 60;

/** Batch-sign uploaded-attachment paths in one API call → path→URL map. */
async function signBatch(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!dbEnabled || unique.length === 0) return map;
  const { data } = await db().storage.from("system-attachments").createSignedUrls(unique, SIGN_TTL);
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

function toRequest(r: Row, signed: Map<string, string>): SystemRequest {
  const fileUrl = r.attachment_path ? signed.get(r.attachment_path) ?? null : null;
  return {
    id: r.id,
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
    workTaskId: r.work_task_id,
    processedByName: r.processed_by ? userName(r.processed_by) : null,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  };
}

/** List requests, newest first. Pass `requesterId` to scope to one supervisor. */
export async function listSystemRequests(requesterId?: string): Promise<SystemRequest[]> {
  if (!dbEnabled) return [];
  let q = db().from("system_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (requesterId) q = q.eq("requester_id", requesterId);
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data as Row[];
  const signed = await signBatch(rows.map((r) => r.attachment_path).filter((p): p is string => !!p));
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

export async function createSystemRequest(input: SysCreateInput): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `sys_${randomUUID()}`;
  const { error } = await db().from("system_requests").insert({
    id,
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
  input: { handlerId: string; note: string; workTaskId: string; processedBy: string },
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
    })
    .eq("id", id)
    .eq("status", "waiting");
  return error ? { error: error.message } : {};
}

/** Processing → Done (System Support closes the ticket). */
export async function completeSystemRequest(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db()
    .from("system_requests")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "done");
  return error ? { error: error.message } : {};
}

/** Delete a request (and any uploaded attachment) — Super Admin cleanup. */
export async function deleteSystemRequest(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row = await getSystemRequestRow(id);
  if (row?.attachment_path) await db().storage.from("system-attachments").remove([row.attachment_path]);
  const { error } = await db().from("system_requests").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
