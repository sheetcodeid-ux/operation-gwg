import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { outletName, userName } from "./store";
import { scopeManpowerValid } from "@/lib/hc-request";
import type {
  HcRequest,
  HcRequestAttachment,
  HcRequestHasil,
  HcRequestKind,
  HcRequestStatus,
  ScopeManpower,
} from "@/lib/hc-request";

/* eslint-disable @typescript-eslint/no-explicit-any */

const mem = new Map<string, any>();

const rawAttachments = (v: any): HcRequestAttachment[] =>
  (Array.isArray(v) ? v : [])
    .filter((a: any) => a && a.path && a.name)
    .map((a: any) => ({ path: String(a.path), name: String(a.name) }));

/**
 * Hasil design yang tersimpan di kolom `hasil`.
 *
 * Baris lama tidak punya kolom ini sama sekali, dan itu bukan kesalahan —
 * artinya designer-nya memang belum pernah men-submit apa pun. Null, bukan
 * objek kosong: keduanya terlihat mirip di layar tapi hanya satu yang jujur.
 */
const rawHasil = (v: any): HcRequestHasil | null => {
  if (!v || typeof v !== "object") return null;
  return {
    at: String(v.at ?? ""),
    byId: v.byId ? String(v.byId) : null,
    byName: String(v.byName ?? "—"),
    note: String(v.note ?? ""),
    attachments: rawAttachments(v.attachments),
    tolakan: (Array.isArray(v.tolakan) ? v.tolakan : [])
      .filter((t: any) => t && t.note)
      .map((t: any) => ({ at: String(t.at ?? ""), byName: String(t.byName ?? "—"), note: String(t.note) })),
    accAt: v.accAt ? String(v.accAt) : null,
    accByName: v.accByName ? String(v.accByName) : null,
  };
};

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
  scope: scopeManpowerValid(r.scope ?? "") ? r.scope : "manajemen",
  outletId: r.outlet_id ?? null,
  outletName: r.outlet_id ? outletName(r.outlet_id) : null,
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
  hasil: rawHasil(r.hasil),
  createdAt: r.created_at ?? new Date().toISOString(),
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
  completedAt: r.completed_at ?? null,
});

/**
 * Tautan lampiran yang TIDAK BISA KEDALUWARSA.
 *
 * Yang ditanam ke halaman adalah alamat aplikasi, bukan tanda tangan
 * penyimpanan. Tanda tangan punya masa berlaku; halaman tidak — aplikasi ini
 * dipasang sebagai PWA dan tabnya bisa menganggur berhari-hari, sehingga
 * presigned URL yang ikut terkirim bersama daftar sudah mati jauh sebelum
 * berkasnya diklik. Yang muncul saat itu bukan gambarnya, melainkan jawaban
 * mentah penyimpanan: "ExpiredRequest — Request has expired".
 *
 * Rute `/api/berkas/pengajuan/[id]` menandatangani pada detik berkasnya
 * diklik, setelah memeriksa ulang hak akses sesi yang sedang berjalan. Selain
 * tidak pernah basi, ini juga menghapus seluruh kerja penandatanganan dari
 * pemuatan daftar: sebelumnya setiap kali antrian dibuka, SEMUA lampiran dari
 * ratusan pengajuan ikut ditandatangani padahal hampir tidak ada yang dibuka.
 */
function tautkanLampiran(list: HcRequest[]): void {
  for (const r of list) {
    // Hasil yang menunggu ACC ikut ditautkan: atasannya tidak bisa memutuskan
    // apa pun tanpa membuka berkasnya. Rutenya memeriksa ulang hak akses sesi,
    // jadi tautannya tetap tidak berguna di tangan yang tidak berhak.
    for (const a of [...r.attachments, ...(r.hasil?.attachments ?? [])]) {
      if (a.path) a.url = `/api/berkas/pengajuan/${encodeURIComponent(r.id)}?p=${encodeURIComponent(a.path)}`;
    }
  }
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
  /**
   * Baca SELURUH barisnya, halaman demi halaman, bukan 500 terbaru.
   *
   * Dipakai layar yang menghitung rekap sepanjang waktu — memotongnya di 500
   * membuat bulan-bulan lama diam-diam hilang dari rata-rata, dan tidak ada
   * yang tampak salah di layar. Antrian harian tetap memakai batas 500: yang
   * dikerjakan hari ini tidak pernah sebanyak itu.
   */
  semua?: boolean;
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
    const saring = <T extends { eq: any; in: any }>(q: T): T => {
      let x: any = q;
      if (opts.kind) x = x.eq("kind", opts.kind);
      if (opts.department) x = x.eq("department", opts.department);
      if (opts.requesterId) x = x.eq("requester_id", opts.requesterId);
      if (opts.requesterIds) x = x.in("requester_id", opts.requesterIds);
      return x as T;
    };

    if (opts.semua) {
      // Halamannya diurut `id` — kunci utama, satu-satunya urutan yang benar
      // stabil antar halaman. `created_at` tidak unik: dua pengajuan pada detik
      // yang sama bisa bergeser di batas halaman lalu terlewat atau terbaca dua
      // kali. Urutan tampilannya dikembalikan di memori sesudahnya.
      const data = await selectAll<any>("hc_requests", (from, to) =>
        saring(db().from("hc_requests").select("*").order("id", { ascending: true })).range(from, to),
      );
      rows = data.map(fromRow).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else {
      const { data } = await saring(
        db().from("hc_requests").select("*").order("created_at", { ascending: false }).limit(500),
      );
      rows = ((data ?? []) as any[]).map(fromRow);
    }
  }
  tautkanLampiran(rows);
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
  scope?: ScopeManpower;
  outletId?: string | null;
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
    scope: input.scope ?? "manajemen",
    outlet_id: input.outletId ?? null,
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
  hasil?: HcRequestHasil | null;
  attachments?: HcRequestAttachment[];
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
  if (patch.hasil !== undefined) row.hasil = patch.hasil;
  if (patch.attachments !== undefined) {
    row.attachments = patch.attachments.filter((a) => a?.path && a?.name).map((a) => ({ path: a.path, name: a.name }));
  }

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
