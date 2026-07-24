import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { outletName, userName } from "./store";
import type { HcDetails, HcDocType, HcSubmission } from "@/lib/hc-shared";

/**
 * Human Capital document workflow — DB-direct (no SEED hydration).
 *
 * Supervisors submit an employee-document request (BPJS / PKWT / Surat Teguran);
 * HC reviews it, processes it, and returns a finished PDF. Files (KTP scan +
 * finished doc) live in the private `hc-documents` bucket and are only ever
 * exposed as short-lived signed URLs, since a KTP is PII.
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

async function signed(path: string | null): Promise<string | null> {
  if (!path || !dbEnabled) return null;
  const { data } = await db().storage.from("hc-documents").createSignedUrl(path, SIGN_TTL);
  return data?.signedUrl ?? null;
}

async function toSubmission(r: Row): Promise<HcSubmission> {
  const [ktpUrl, finalDocUrl] = await Promise.all([signed(r.ktp_path), signed(r.final_doc_path)]);
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

/** List submissions, newest first. Pass `supervisorId` to scope to one SPV. */
export async function listHcSubmissions(supervisorId?: string): Promise<HcSubmission[]> {
  if (!dbEnabled) return [];
  let q = db().from("hc_submissions").select("*").order("created_at", { ascending: false }).limit(200);
  if (supervisorId) q = q.eq("supervisor_id", supervisorId);
  const { data, error } = await q;
  if (error || !data) return [];
  return Promise.all((data as Row[]).map(toSubmission));
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

export async function createHcSubmission(input: HcCreateInput): Promise<HcSubmission | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const row: Row = {
    id: `hc_${randomUUID()}`,
    employee_name: input.employeeName,
    doc_type: input.docType,
    outlet_id: input.outletId,
    supervisor_id: input.supervisorId,
    ktp_path: input.ktpPath,
    details: input.details,
    status: "waiting",
    hc_note: null,
    final_doc_path: null,
    processed_by: null,
    processed_at: null,
    completed_by: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };
  const { error } = await db().from("hc_submissions").insert(row);
  if (error) return null;
  return toSubmission(row);
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

/** Processing → Done (HC attaches the finished doc + optional note). Locks the item. */
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
      final_doc_path: finalDocPath,
      completed_by: userId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "done"); // never re-complete a locked item
  return error ? { error: error.message } : {};
}
