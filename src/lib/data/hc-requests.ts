import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { userName } from "./store";
import { isR2Key, presignGet, r2KeyOf } from "@/lib/storage/r2";
import type { HcRequest, HcRequestAttachment, HcRequestKind, HcRequestStatus } from "@/lib/hc-request";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SIGN_TTL = 60 * 60;
const mem = new Map<string, any>();

const rawAttachments = (v: any): HcRequestAttachment[] =>
  (Array.isArray(v) ? v : [])
    .filter((a: any) => a && a.path && a.name)
    .map((a: any) => ({ path: String(a.path), name: String(a.name) }));

const fromRow = (r: any): HcRequest => ({
  id: r.id,
  kind: r.kind as HcRequestKind,
  department: r.department ?? "",
  requesterId: r.requester_id ?? "",
  requesterName: r.requester_id ? userName(r.requester_id) : "—",
  title: r.title ?? "",
  description: r.description ?? "",
  subjectName: r.subject_name ?? "",
  position: r.position ?? null,
  headcount: Number(r.headcount ?? 0),
  recruited: Number(r.recruited ?? 0),
  trainingType: r.training_type ?? null,
  participants: Number(r.participants ?? 0),
  participantNames: (Array.isArray(r.participant_names) ? r.participant_names : []).map((n: any) => String(n)),
  budget: Number(r.budget ?? 0),
  budgetApproved: Number(r.budget_approved ?? 0),
  designType: r.design_type ?? null,
  designSize: r.design_size ?? null,
  plannedDate: r.planned_date ?? null,
  attachments: rawAttachments(r.attachments),
  status: (r.status ?? "menunggu_hc") as HcRequestStatus,
  hcNote: r.hc_note ?? "",
  financeNote: r.finance_note ?? "",
  hcByName: r.hc_by ? userName(r.hc_by) : null,
  financeByName: r.finance_by ? userName(r.finance_by) : null,
  assigneeId: r.assignee_id ?? null,
  assigneeName: r.assignee_id ? userName(r.assignee_id) : null,
  workTaskId: r.work_task_id ?? null,
  revisions: (Array.isArray(r.revisions) ? r.revisions : [])
    .filter((v: any) => v && v.note)
    .map((v: any) => ({ at: String(v.at ?? ""), byName: String(v.byName ?? "—"), note: String(v.note) })),
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
  completedAt: r.completed_at ?? null,
});

async function signAll(list: HcRequest[]): Promise<void> {
  const paths = [...new Set(list.flatMap((r) => r.attachments.map((a) => a.path).filter((p): p is string => !!p)))];
  if (paths.length === 0) return;
  const map = new Map<string, string>();
  const sb: string[] = [];
  for (const p of paths) {
    if (isR2Key(p)) {
      try {
        const url = await presignGet(r2KeyOf(p), SIGN_TTL);
        if (url) map.set(p, url);
      } catch {
        /* lewati */
      }
    } else sb.push(p);
  }
  if (dbEnabled && sb.length > 0) {
    try {
      const { data } = await db().storage.from("system-attachments").createSignedUrls(sb, SIGN_TTL);
      for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
    } catch {
      /* signing tidak tersedia */
    }
  }
  for (const r of list) for (const a of r.attachments) if (a.path) a.url = map.get(a.path);
}

export interface ListRequestOpts {
  kind?: HcRequestKind;
  department?: string;
  requesterId?: string;
  /**
   * Batasi ke pengaju tertentu. Dipakai penyaringan per cabang: department tidak
   * bisa dipakai karena SEMUA supervisor memakai department yang sama, sehingga
   * menyaring dengannya membuat setiap supervisor melihat seluruh cabang.
   *
   * Daftar kosong berarti "tidak ada yang boleh dilihat" — bukan "tanpa filter".
   */
  requesterIds?: string[];
}

export async function listHcRequests(opts: ListRequestOpts = {}): Promise<HcRequest[]> {
  // Daftar pengaju kosong = tidak ada yang boleh dilihat. Membedakannya dari
  // "tanpa filter" itu penting: keliru sedikit di sini artinya membuka seluruh
  // pengajuan ke orang yang seharusnya tidak melihat satu pun.
  if (opts.requesterIds && opts.requesterIds.length === 0) return [];

  let rows: HcRequest[];
  if (!dbEnabled) {
    rows = [...mem.values()]
      .map(fromRow)
      .filter(
        (r) =>
          (!opts.kind || r.kind === opts.kind) &&
          (!opts.department || r.department === opts.department) &&
          (!opts.requesterId || r.requesterId === opts.requesterId) &&
          (!opts.requesterIds || opts.requesterIds.includes(r.requesterId)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    let q = db().from("hc_requests").select("*").order("created_at", { ascending: false }).limit(500);
    if (opts.kind) q = q.eq("kind", opts.kind);
    if (opts.department) q = q.eq("department", opts.department);
    if (opts.requesterId) q = q.eq("requester_id", opts.requesterId);
    if (opts.requesterIds) q = q.in("requester_id", opts.requesterIds);
    const { data } = await q;
    rows = ((data ?? []) as any[]).map(fromRow);
  }
  await signAll(rows);
  return rows;
}

export interface CreateRequestInput {
  kind: HcRequestKind;
  department: string;
  requesterId: string;
  title: string;
  description: string;
  subjectName?: string;
  position?: string | null;
  headcount?: number;
  trainingType?: string | null;
  participants?: number;
  participantNames?: string[];
  budget?: number;
  designType?: string | null;
  designSize?: string | null;
  plannedDate?: string | null;
  attachments: HcRequestAttachment[];
}

export async function createHcRequest(input: CreateRequestInput): Promise<{ id?: string; error?: string }> {
  const id = `hcr_${randomUUID()}`;
  const row = {
    id,
    kind: input.kind,
    department: input.department,
    requester_id: input.requesterId,
    title: input.title,
    description: input.description ?? "",
    subject_name: input.subjectName ?? "",
    position: input.position ?? null,
    headcount: input.headcount ?? 0,
    recruited: 0,
    training_type: input.trainingType ?? null,
    participants: input.participants ?? 0,
    participant_names: (input.participantNames ?? []).map((n) => String(n).trim()).filter(Boolean).slice(0, 100),
    budget: input.budget ?? 0,
    budget_approved: 0,
    design_type: input.designType ?? null,
    design_size: input.designSize ?? null,
    planned_date: input.plannedDate || null,
    attachments: input.attachments.filter((a) => a?.path && a?.name).map((a) => ({ path: a.path, name: a.name })),
    status: "menunggu_hc" as HcRequestStatus,
    hc_note: "",
    finance_note: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!dbEnabled) {
    mem.set(id, row);
    return { id };
  }
  const { error } = await db().from("hc_requests").insert(row);
  return error ? { error: error.message } : { id };
}

export interface UpdateRequestPatch {
  status?: HcRequestStatus;
  hcNote?: string;
  financeNote?: string;
  hcBy?: string;
  financeBy?: string;
  budgetApproved?: number;
  recruited?: number;
  completedAt?: string | null;
  assigneeId?: string | null;
  workTaskId?: string | null;
  revisions?: { at: string; byName: string; note: string }[];
}

export async function updateHcRequest(id: string, patch: UpdateRequestPatch): Promise<{ error?: string }> {
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.hcNote !== undefined) row.hc_note = patch.hcNote;
  if (patch.financeNote !== undefined) row.finance_note = patch.financeNote;
  if (patch.hcBy !== undefined) row.hc_by = patch.hcBy;
  if (patch.financeBy !== undefined) row.finance_by = patch.financeBy;
  if (patch.budgetApproved !== undefined) row.budget_approved = patch.budgetApproved;
  if (patch.recruited !== undefined) row.recruited = patch.recruited;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
  if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;
  if (patch.workTaskId !== undefined) row.work_task_id = patch.workTaskId;
  if (patch.revisions !== undefined) row.revisions = patch.revisions;

  if (!dbEnabled) {
    const cur = mem.get(id);
    if (cur) mem.set(id, { ...cur, ...row });
    return {};
  }
  const { error } = await db().from("hc_requests").update(row).eq("id", id);
  return error ? { error: error.message } : {};
}

/** Pengajuan yang tertaut ke satu tugas Work Tracker — dipakai saat tugasnya
 *  ditutup dari sisi Work Tracker, supaya pengajuannya ikut selesai. */
export async function getHcRequestByTask(taskId: string): Promise<HcRequest | null> {
  if (!dbEnabled) {
    for (const r of mem.values()) if (r.work_task_id === taskId) return fromRow(r);
    return null;
  }
  const { data } = await db().from("hc_requests").select("*").eq("work_task_id", taskId).maybeSingle();
  return data ? fromRow(data) : null;
}

export async function getHcRequest(id: string): Promise<HcRequest | null> {
  if (!dbEnabled) {
    const r = mem.get(id);
    return r ? fromRow(r) : null;
  }
  const { data } = await db().from("hc_requests").select("*").eq("id", id).maybeSingle();
  return data ? fromRow(data) : null;
}

/**
 * Hapus satu pengajuan berikut tugas Work Tracker yang tertaut.
 *
 * Tugasnya ikut dihapus supaya tidak tertinggal sebagai pekerjaan yatim yang
 * merujuk pengajuan yang sudah tidak ada. Lampiran di penyimpanan sengaja
 * DIBIARKAN: berkas yang sama bisa dipakai catatan lain, dan menghapus berkas
 * orang lain jauh lebih sulit dipulihkan daripada menyisakan satu objek.
 */
export async function deleteHcRequest(id: string): Promise<{ error?: string }> {
  const req = await getHcRequest(id);
  if (!req) return { error: "Pengajuan tidak ditemukan." };

  if (!dbEnabled) {
    mem.delete(id);
    return {};
  }
  if (req.workTaskId) {
    const t = await db().from("tasks").delete().eq("id", req.workTaskId);
    if (t.error) return { error: `Gagal menghapus tugas terkait: ${t.error.message}` };
  }
  const { error } = await db().from("hc_requests").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
