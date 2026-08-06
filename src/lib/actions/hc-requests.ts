"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db, dbEnabled } from "@/lib/data/db";
import { canReachMenu } from "@/lib/nav";
import { persistMessage } from "@/lib/data/persist";
import { createHcRequest, getHcRequest, listHcRequests, updateHcRequest } from "@/lib/data/hc-requests";
import { r2Enabled, r2Put, R2_PREFIX } from "@/lib/storage/r2";
import type { HcRequest, HcRequestAttachment, HcRequestKind } from "@/lib/hc-request";
import type { UserProfile } from "@/lib/types";

/** Setiap departemen boleh mengajukan (menu hc_request). */
const canSubmit = (u: UserProfile | null) => !!u && canReachMenu(u, "hc_request");
/** HC memproses pengajuan — permintaan karyawan maupun pelatihan. */
const canHc = (u: UserProfile | null) => !!u && (canReachMenu(u, "hc_reqreview") || canReachMenu(u, "hc_training"));
/** Creative meninjau pengajuan design (menu creative_design). */
const canCreative = (u: UserProfile | null) => !!u && canReachMenu(u, "creative_design");
/** Finance menyetujui dana pelatihan (menu fin_training). */
const canFinance = (u: UserProfile | null) => !!u && canReachMenu(u, "fin_training");
/** Peninjau yang berhak untuk satu jenis pengajuan. */
const canReview = (u: UserProfile | null, kind: HcRequestKind) => (kind === "design" ? canCreative(u) : canHc(u));

const MAX_BYTES = 10 * 1024 * 1024;

/** Unggah lampiran pengajuan (foto kegiatan, formulir, proposal…). */
export async function uploadHcRequestFileAction(formData: FormData): Promise<{ path?: string; name?: string; error?: string }> {
  const user = await getSessionUser();
  if (!canSubmit(user) && !canHc(user) && !canCreative(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  if (file.size > MAX_BYTES) return { error: `Berkas "${file.name}" melebihi 10 MB.` };
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    return { error: `"${file.name}" harus PDF atau gambar (JPG/PNG).` };
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const name = `request/${user!.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  if (r2Enabled()) {
    try {
      const key = `hc/${name}`;
      await r2Put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
      return { path: `${R2_PREFIX}${key}`, name: file.name };
    } catch (e) {
      console.error("[hc-request] R2 upload gagal, fallback Supabase:", e);
    }
  }
  const { error } = await db().storage.from("system-attachments").upload(`hc/${name}`, file, { contentType: file.type });
  if (error) return { error: `Upload gagal: ${error.message}` };
  return { path: `hc/${name}`, name: file.name };
}

export interface SubmitRequestInput {
  kind: HcRequestKind;
  title: string;
  description: string;
  subjectName?: string;
  position?: string;
  headcount?: number;
  trainingType?: string;
  participants?: number;
  participantNames?: string[];
  budget?: number;
  designType?: string;
  designSize?: string;
  plannedDate?: string;
  attachments: HcRequestAttachment[];
}

export async function submitHcRequestAction(input: SubmitRequestInput): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!canSubmit(user)) return { error: "Tidak punya akses." };
  if (!input.title.trim()) return { error: "Judul pengajuan wajib diisi." };
  if (input.kind === "rekrutmen" && (!input.position?.trim() || !input.headcount || input.headcount < 1)) {
    return { error: "Posisi dan jumlah pegawai yang diminta wajib diisi." };
  }
  if (input.kind === "pelatihan" && !input.trainingType?.trim()) {
    return { error: "Jenis pelatihan wajib dipilih." };
  }
  if (input.kind === "design" && !input.designType?.trim()) {
    return { error: "Jenis design wajib dipilih." };
  }
  if (input.kind === "design" && !input.subjectName?.trim()) {
    return { error: "Nama pemohon design wajib diisi." };
  }
  try {
    const res = await createHcRequest({
      kind: input.kind,
      department: user!.department ?? "—",
      requesterId: user!.id,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      subjectName: input.subjectName?.trim() ?? "",
      position: input.position?.trim() || null,
      headcount: input.headcount ?? 0,
      trainingType: input.trainingType?.trim() || null,
      participants: input.participants ?? 0,
      participantNames: input.participantNames ?? [],
      budget: input.budget ?? 0,
      designType: input.designType?.trim() || null,
      designSize: input.designSize?.trim() || null,
      plannedDate: input.plannedDate || null,
      attachments: input.attachments ?? [],
    });
    if (res.error) return { error: res.error };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

function revalidateAll() {
  revalidatePath("/pengajuan");
  revalidatePath("/pengajuan/karyawan");
  revalidatePath("/pengajuan/pelatihan");
  revalidatePath("/hc/permintaan");
  revalidatePath("/hc/pelatihan");
  revalidatePath("/finance/pelatihan");
  revalidatePath("/pengajuan/design");
  revalidatePath("/creative/design");
  revalidatePath("/hc/kpi");
}

/** Pengajuan milik saya / departemen saya. */
export async function myHcRequestsAction(): Promise<HcRequest[]> {
  const user = await getSessionUser();
  if (!canSubmit(user)) return [];
  // Semua pengajuan dari departemen yang sama, agar satu tim melihat antreannya.
  return listHcRequests({ department: user!.department ?? "—" });
}

/** Pengajuan yang masuk ke HC — dibatasi satu jenis bila diminta. */
export async function allHcRequestsAction(kind?: HcRequestKind): Promise<HcRequest[]> {
  const user = await getSessionUser();
  if (kind === "design" ? !canCreative(user) : !canHc(user)) return [];
  return listHcRequests(kind ? { kind } : {});
}

/** Pelatihan yang menunggu / sudah diputus Finance. */
export async function financeTrainingRequestsAction(): Promise<HcRequest[]> {
  const user = await getSessionUser();
  if (!canFinance(user)) return [];
  const all = await listHcRequests({ kind: "pelatihan" });
  // Finance hanya perlu melihat yang sudah lolos HC.
  return all.filter((r) => r.status !== "menunggu_hc" && r.status !== "ditolak_hc");
}

/** HC menyetujui / menolak. Pelatihan yang disetujui diteruskan ke Finance. */
export async function hcDecideRequestAction(input: { id: string; approve: boolean; note: string }): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  const req = await getHcRequest(input.id);
  if (!req) return { error: "Pengajuan tidak ditemukan." };
  if (!canReview(user, req.kind)) return { error: "Tidak punya akses." };
  if (req.status !== "menunggu_hc") return { error: "Pengajuan ini sudah diproses." };
  const status = !input.approve ? "ditolak_hc" : req.kind === "pelatihan" ? "menunggu_finance" : "disetujui_hc";
  const res = await updateHcRequest(input.id, { status, hcNote: input.note ?? "", hcBy: user!.id });
  if (res.error) return { error: res.error };
  revalidateAll();
  return { ok: true };
}

/** Finance menyetujui / menolak dana pelatihan. */
export async function financeDecideRequestAction(input: {
  id: string;
  approve: boolean;
  budgetApproved: number;
  note: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!canFinance(user)) return { error: "Tidak punya akses." };
  const req = await getHcRequest(input.id);
  if (!req) return { error: "Pengajuan tidak ditemukan." };
  if (req.kind !== "pelatihan") return { error: "Hanya pengajuan pelatihan yang melewati Finance." };
  if (req.status !== "menunggu_finance") return { error: "Pengajuan ini sudah diputus." };
  if (input.approve && input.budgetApproved < 0) return { error: "Dana tidak boleh negatif." };
  const res = await updateHcRequest(input.id, {
    status: input.approve ? "disetujui_finance" : "ditolak_finance",
    budgetApproved: input.approve ? input.budgetApproved : 0,
    financeNote: input.note ?? "",
    financeBy: user!.id,
  });
  if (res.error) return { error: res.error };
  revalidateAll();
  return { ok: true };
}

/**
 * HC menutup pengajuan sebagai TERLAKSANA — inilah yang dihitung KPI.
 *  • rekrutmen → isi berapa pegawai yang benar-benar direkrut
 *  • pelatihan → tandai program sudah dijalankan (lampirkan foto/daftar hadir)
 */
export async function completeHcRequestAction(input: {
  id: string;
  recruited?: number;
  note?: string;
  attachments?: HcRequestAttachment[];
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  const req = await getHcRequest(input.id);
  if (!req) return { error: "Pengajuan tidak ditemukan." };
  if (!canReview(user, req.kind)) return { error: "Tidak punya akses." };
  const ready = req.kind === "pelatihan" ? req.status === "disetujui_finance" : req.status === "disetujui_hc";
  if (!ready) return { error: "Pengajuan belum siap ditandai terlaksana." };

  // Lampiran tambahan (laporan, daftar hadir, foto kegiatan) digabung.
  const merged = [...req.attachments.map((a) => ({ path: a.path, name: a.name })), ...(input.attachments ?? [])]
    .filter((a) => a?.path && a?.name)
    .slice(0, 12) as HcRequestAttachment[];

  if (dbEnabled && merged.length !== req.attachments.length) {
    await db().from("hc_requests").update({ attachments: merged.map((a) => ({ path: a.path, name: a.name })) }).eq("id", input.id);
  }

  const res = await updateHcRequest(input.id, {
    status: "terlaksana",
    recruited: req.kind === "rekrutmen" ? Math.max(0, input.recruited ?? 0) : 0,
    hcNote: input.note ? `${req.hcNote ? `${req.hcNote}\n` : ""}${input.note}` : req.hcNote,
    completedAt: new Date().toISOString(),
  });
  if (res.error) return { error: res.error };
  revalidateAll();
  return { ok: true };
}
