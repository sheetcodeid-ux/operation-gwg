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
  position: r.position ?? null,
  headcount: Number(r.headcount ?? 0),
  recruited: Number(r.recruited ?? 0),
  trainingType: r.training_type ?? null,
  participants: Number(r.participants ?? 0),
  budget: Number(r.budget ?? 0),
  budgetApproved: Number(r.budget_approved ?? 0),
  plannedDate: r.planned_date ?? null,
  attachments: rawAttachments(r.attachments),
  status: (r.status ?? "menunggu_hc") as HcRequestStatus,
  hcNote: r.hc_note ?? "",
  financeNote: r.finance_note ?? "",
  hcByName: r.hc_by ? userName(r.hc_by) : null,
  financeByName: r.finance_by ? userName(r.finance_by) : null,
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
}

export async function listHcRequests(opts: ListRequestOpts = {}): Promise<HcRequest[]> {
  let rows: HcRequest[];
  if (!dbEnabled) {
    rows = [...mem.values()].map(fromRow);
  } else {
    let q = db().from("hc_requests").select("*").order("created_at", { ascending: false }).limit(500);
    if (opts.kind) q = q.eq("kind", opts.kind);
    if (opts.department) q = q.eq("department", opts.department);
    if (opts.requesterId) q = q.eq("requester_id", opts.requesterId);
    const { data } = await q;
    rows = ((data ?? []) as any[]).map(fromRow);
  }
  if (!dbEnabled) {
    rows = rows.filter(
      (r) =>
        (!opts.kind || r.kind === opts.kind) &&
        (!opts.department || r.department === opts.department) &&
        (!opts.requesterId || r.requesterId === opts.requesterId),
    );
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
  position?: string | null;
  headcount?: number;
  trainingType?: string | null;
  participants?: number;
  budget?: number;
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
    position: input.position ?? null,
    headcount: input.headcount ?? 0,
    recruited: 0,
    training_type: input.trainingType ?? null,
    participants: input.participants ?? 0,
    budget: input.budget ?? 0,
    budget_approved: 0,
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

  if (!dbEnabled) {
    const cur = mem.get(id);
    if (cur) mem.set(id, { ...cur, ...row });
    return {};
  }
  const { error } = await db().from("hc_requests").update(row).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function getHcRequest(id: string): Promise<HcRequest | null> {
  if (!dbEnabled) {
    const r = mem.get(id);
    return r ? fromRow(r) : null;
  }
  const { data } = await db().from("hc_requests").select("*").eq("id", id).maybeSingle();
  return data ? fromRow(data) : null;
}

/* ─────────────────── agregasi otomatis untuk KPI HC ─────────────────── */

/** SLA dokumen administrasi personalia: selesai ≤ 7 hari = "tepat waktu". */
export const DOC_SLA_DAYS = 7;

export interface KpiAuto {
  /** Jumlah pegawai yang diminta pada periode (target Jumlah Rekrutmen). */
  rekrutmenDiminta: number;
  /** Jumlah pegawai yang berhasil direkrut pada periode (realisasi). */
  rekrutmenTerpenuhi: number;
  /** Program pelatihan yang TERLAKSANA pada periode (realisasi Development). */
  pelatihanTerlaksana: number;
  /** Dokumen HC selesai tepat waktu & sesuai standar (realisasi Administrasi). */
  dokumenSelesai: number;
}

const monthRange = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  return { from, to };
};

/**
 * Angka realisasi yang bisa dihitung sistem sendiri untuk satu periode.
 * Dipakai sebagai nilai bawaan KPI — HC tetap boleh menimpanya secara manual.
 */
export async function kpiAutoFigures(period: string): Promise<KpiAuto> {
  const empty: KpiAuto = { rekrutmenDiminta: 0, rekrutmenTerpenuhi: 0, pelatihanTerlaksana: 0, dokumenSelesai: 0 };
  if (!dbEnabled) return empty;
  const { from, to } = monthRange(period);

  try {
    const [reqRes, trainRes, docRes] = await Promise.all([
      // Permintaan pegawai yang DIBUAT pada periode ini.
      db().from("hc_requests").select("headcount,recruited,status").eq("kind", "rekrutmen").gte("created_at", from).lt("created_at", to),
      // Pelatihan yang TERLAKSANA pada periode ini (pakai tanggal penyelesaian).
      db().from("hc_requests").select("id").eq("kind", "pelatihan").eq("status", "terlaksana").gte("completed_at", from).lt("completed_at", to),
      // Dokumen HC yang selesai pada periode ini.
      db().from("hc_submissions").select("created_at,updated_at,status").eq("status", "done").gte("updated_at", from).lt("updated_at", to),
    ]);

    const reqs = (reqRes.data ?? []) as { headcount: number; recruited: number }[];
    const docs = (docRes.data ?? []) as { created_at: string; updated_at: string }[];
    const onTime = docs.filter((d) => {
      const days = (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86_400_000;
      return days <= DOC_SLA_DAYS;
    });

    return {
      rekrutmenDiminta: reqs.reduce((a, r) => a + Number(r.headcount ?? 0), 0),
      rekrutmenTerpenuhi: reqs.reduce((a, r) => a + Number(r.recruited ?? 0), 0),
      pelatihanTerlaksana: (trainRes.data ?? []).length,
      dokumenSelesai: onTime.length,
    };
  } catch {
    return empty;
  }
}
