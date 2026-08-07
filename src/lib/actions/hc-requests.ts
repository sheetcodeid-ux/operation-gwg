"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db, dbEnabled } from "@/lib/data/db";
import { canReachMenu } from "@/lib/nav";
import { persistMessage } from "@/lib/data/persist";
import { createHcRequest, getHcRequest, listHcRequests, updateHcRequest } from "@/lib/data/hc-requests";
import { getUsers } from "@/lib/data/store";
import { createTask, getTask, updateTask, updateTaskStatus } from "@/lib/data/mutations";
import { presignPut, r2Enabled, r2Put, R2_PREFIX } from "@/lib/storage/r2";
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

/**
 * URL unggah langsung ke R2 untuk satu berkas.
 *
 * Berkas besar tidak boleh melewati server action: badan permintaan menuju
 * fungsi serverless dibatasi beberapa MB dan ditolak di lapisan platform —
 * sebelum kode kita sempat jalan — sehingga yang terlihat pengguna hanyalah
 * "an unexpected response was received from the server". Dengan presigned URL,
 * berkasnya naik dari browser langsung ke R2 dan server hanya menandatangani.
 */
export async function presignHcUploadAction(input: {
  name: string;
  contentType: string;
  size: number;
}): Promise<{ url?: string; path?: string; error?: string }> {
  const user = await getSessionUser();
  if (!canSubmit(user) && !canHc(user) && !canCreative(user)) return { error: "Tidak punya akses." };
  if (!r2Enabled()) return { error: "R2 belum aktif." };
  if (input.size > MAX_BYTES) return { error: `Berkas "${input.name}" melebihi 10 MB.` };
  if (input.contentType !== "application/pdf" && !input.contentType.startsWith("image/")) {
    return { error: `"${input.name}" harus PDF atau gambar (JPG/PNG).` };
  }
  const safe = input.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const key = `hc/request/${user!.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  try {
    const url = await presignPut(key, input.contentType || "application/octet-stream");
    return { url, path: `${R2_PREFIX}${key}` };
  } catch (e) {
    console.error("[hc-request] gagal menandatangani URL unggah:", e);
    return { error: "Gagal menyiapkan unggahan." };
  }
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

  // Design yang ditutup dari sisi pengajuan ikut menutup tugas Work Tracker-nya.
  if (req.workTaskId) updateTaskStatus(req.workTaskId, "done", 100);
  revalidateAll();
  return { ok: true };
}

/* ─────────────────── penugasan design → Work Tracker ─────────────────── */

/**
 * Creative memilih siapa yang mengerjakan satu permintaan design.
 *
 * Penugasan tidak berhenti sebagai catatan: sistem sekaligus membuat tugas di
 * Work Tracker atas nama PIC tersebut, dan menautkannya balik ke pengajuan.
 * Dengan begitu beban kerja tim Creative terlihat di satu tempat, dan status
 * kedua sisi tidak bisa berbeda — menutup salah satunya menutup keduanya.
 */
export async function assignDesignRequestAction(input: {
  id: string;
  assigneeId: string;
}): Promise<{ ok?: true; taskId?: string; error?: string }> {
  const user = await getSessionUser();
  const req = await getHcRequest(input.id);
  if (!req) return { error: "Pengajuan tidak ditemukan." };
  if (req.kind !== "design") return { error: "Penugasan PIC hanya untuk pengajuan design." };
  if (!canCreative(user)) return { error: "Tidak punya akses." };
  if (req.status === "terlaksana" || req.status === "ditolak_hc") return { error: "Pengajuan ini sudah selesai." };
  if (!input.assigneeId) return { error: "Pilih PIC yang mengerjakan." };

  const pic = getUsers().find((u) => u.id === input.assigneeId);
  if (!pic) return { error: "PIC tidak ditemukan." };

  // Ganti PIC pada pengajuan yang sudah punya tugas: perbarui tugas yang ada,
  // jangan buat tugas kedua untuk pekerjaan yang sama.
  if (req.workTaskId) {
    const existing = getTask(req.workTaskId);
    if (existing) {
      updateTask(req.workTaskId, {
        title: existing.title,
        description: existing.description,
        category: existing.category,
        priority: existing.priority,
        status: existing.status,
        division: existing.division,
        outletId: existing.outletId,
        outletIds: existing.outletIds,
        brands: existing.brands,
        picIds: [pic.id],
        picId: pic.id,
        startDate: existing.startDate,
        dueDate: existing.dueDate,
        progress: existing.progress,
      });
      await updateHcRequest(input.id, { assigneeId: pic.id });
      revalidateAssignment();
      return { ok: true, taskId: req.workTaskId };
    }
  }

  const due = req.plannedDate ? new Date(req.plannedDate).toISOString() : new Date(Date.now() + 7 * 86_400_000).toISOString();
  let task;
  try {
    task = await createTask({
      title: req.title || "Permintaan design",
      description: [req.description, req.designType && `Jenis: ${req.designType}`, req.designSize && `Ukuran: ${req.designSize}`]
        .filter(Boolean)
        .join("\n"),
      category: "Marketing",
      priority: "medium",
      status: "ongoing",
      division: "Creative",
      outletId: null,
      outletIds: [],
      brands: [],
      picIds: [pic.id],
      picId: pic.id,
      startDate: new Date().toISOString(),
      dueDate: due,
      progress: 0,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  // Menugaskan berarti pekerjaan sudah berjalan.
  await updateHcRequest(input.id, {
    assigneeId: pic.id,
    workTaskId: task.id,
    status: req.status === "menunggu_hc" ? "disetujui_hc" : req.status,
    hcBy: user!.id,
  });
  revalidateAssignment();
  return { ok: true, taskId: task.id };
}

function revalidateAssignment() {
  revalidatePath("/creative/design");
  revalidatePath("/pengajuan/design");
  revalidatePath("/pengajuan");
  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
}

/**
 * Pemohon meminta revisi atas hasil design yang sudah dikirim.
 *
 * Permintaannya tidak ditutup lalu dibuat baru — ia kembali ke tim Creative
 * dalam pengajuan yang sama, sehingga riwayat, PIC, dan tugas Work Tracker-nya
 * tetap satu benang. Catatan tiap putaran disimpan berurutan supaya revisi
 * kedua tidak menghapus alasan revisi pertama.
 */
export async function requestDesignRevisionAction(input: {
  id: string;
  note: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Tidak punya akses." };
  const req = await getHcRequest(input.id);
  if (!req) return { error: "Pengajuan tidak ditemukan." };
  if (req.kind !== "design") return { error: "Revisi hanya untuk pengajuan design." };
  if (req.status !== "terlaksana") return { error: "Revisi hanya bisa diminta setelah designnya dikirim." };
  const note = input.note.trim();
  if (!note) return { error: "Tulis dulu apa yang perlu direvisi." };

  // Yang boleh meminta revisi: pemohonnya sendiri, rekan satu departemen
  // (atasan yang menerima hasilnya), atau tim Creative yang menariknya kembali.
  const sameDept = !!user.department && user.department === req.department;
  if (req.requesterId !== user.id && !sameDept && !canCreative(user)) {
    return { error: "Hanya pemohon atau timnya yang bisa meminta revisi." };
  }

  const revisions = [...req.revisions, { at: new Date().toISOString(), byName: user.name, note }];
  const res = await updateHcRequest(input.id, {
    status: "disetujui_hc", // kembali ke "Sedang Dikerjakan"
    completedAt: null,
    revisions,
  });
  if (res.error) return { error: res.error };

  // Tugas Work Tracker PIC ikut dibuka kembali — kerjaannya memang belum usai.
  if (req.workTaskId) updateTaskStatus(req.workTaskId, "ongoing", 60);

  revalidateAssignment();
  return { ok: true };
}
