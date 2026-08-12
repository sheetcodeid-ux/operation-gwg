"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db, dbEnabled } from "@/lib/data/db";
import {
  chatDirectory,
  createGroupThread,
  hideThread,
  listThreads,
  markAllRead,
  markRead,
  openDirectThread,
  readThread,
  sendMessage,
  setArchived,
  setFavorite,
  threadPeople,
  unreadTotal,
  REQUEST_HREF,
} from "@/lib/data/chat";
import { replyStats, type ReplyStat } from "@/lib/data/chat-stats";
import { getHcRequest, listHcRequests } from "@/lib/data/hc-requests";
import { getSystemRequestRow } from "@/lib/data/system";
import { getHcSubmissionRow } from "@/lib/data/hc";
import { canReachMenu } from "@/lib/nav";
import { isSystemSupport } from "@/lib/system-shared";
import { canSeeRequest, requestScopeFor } from "@/lib/data/request-scope";
import { presignPut, r2Enabled, R2_PREFIX } from "@/lib/storage/r2";
import { HC_REQUEST_KIND_LABEL, statusMeta, type HcRequestKind } from "@/lib/hc-request";
import type { ChatAttachment, ChatMessage, ChatPerson, ChatThread, PickableRequest, RequestDetail } from "@/lib/chat-shared";

/**
 * Pesan — obrolan internal, terbuka untuk SEMUA pengguna yang sudah masuk.
 *
 * Tidak ada pembatasan peran di sini secara sengaja: satu perusahaan harus bisa
 * saling menghubungi tanpa admin memberi izin dulu. Yang dijaga ketat adalah
 * batas percakapan — seseorang hanya boleh membaca dan menulis di percakapan
 * yang ia ikuti, dan itu diperiksa di lapisan data pada setiap pemanggilan.
 */

const MAX_BODY = 4000;
const MAX_BYTES = 10 * 1024 * 1024;

export async function chatThreadsAction(): Promise<ChatThread[]> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return [];
  return listThreads(user.id);
}

export async function chatDirectoryAction(): Promise<ChatPerson[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return chatDirectory(user.id);
}

export async function chatUnreadTotalAction(): Promise<number> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return 0;
  return unreadTotal(user.id);
}

/**
 * Buka satu percakapan: pesannya + pesertanya. `null` bila bukan peserta.
 *
 * Ketiga pekerjaannya berjalan BERSAMAAN. Berurutan, tiap perpindahan
 * percakapan menumpuk tiga perjalanan ke database — itu jeda yang terasa saat
 * berpindah cepat antar orang.
 */
export async function chatOpenAction(threadId: string): Promise<{ messages: ChatMessage[]; people: ChatPerson[] } | null> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return null;
  const [messages, people] = await Promise.all([
    readThread(threadId, user.id),
    threadPeople(threadId, user.id),
    markRead(threadId, user.id),
  ]);
  if (!messages) return null;
  return { messages, people: people ?? [] };
}

/**
 * Ambil pesan tanpa menandai sudah dibaca.
 *
 * Dipakai penyegaran berkala. Kalau ini ikut menandai baca, percakapan yang
 * tab-nya terbuka di latar akan selalu terlihat "sudah dibaca" padahal
 * orangnya tidak melihat apa pun.
 */
export async function chatPollAction(threadId: string): Promise<ChatMessage[] | null> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return null;
  return readThread(threadId, user.id);
}

export async function chatStartDirectAction(otherId: string): Promise<{ threadId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (otherId === user.id) return { error: "Tidak bisa mengobrol dengan diri sendiri." };
  try {
    const threadId = await openDirectThread(user.id, otherId);
    revalidatePath("/pesan");
    return { threadId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal membuka percakapan." };
  }
}

export async function chatCreateGroupAction(input: {
  title: string;
  memberIds: string[];
}): Promise<{ threadId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  const title = input.title.trim();
  if (!title) return { error: "Nama grup wajib diisi." };
  if (input.memberIds.length === 0) return { error: "Pilih minimal satu anggota." };
  try {
    const threadId = await createGroupThread(user.id, title, input.memberIds);
    revalidatePath("/pesan");
    return { threadId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal membuat grup." };
  }
}

export async function chatSendAction(input: {
  threadId: string;
  body: string;
  attachments?: ChatAttachment[];
  refRequestId?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };

  const body = input.body.trim().slice(0, MAX_BODY);
  const attachments = input.attachments ?? [];
  if (!body && attachments.length === 0 && !input.refRequestId) {
    return { error: "Pesan kosong." };
  }

  // Meneruskan pengajuan hanya boleh untuk pengajuan yang memang boleh ia
  // lihat — kalau tidak, obrolan jadi jalan pintas untuk membaca pengajuan
  // cabang lain lewat id tebakan.
  if (input.refRequestId) {
    const req = await getHcRequest(input.refRequestId);
    if (!req) return { error: "Pengajuan tidak ditemukan." };
    if (!canSeeRequest(user, req)) {
      return { error: "Tidak punya akses ke pengajuan itu." };
    }
  }

  const res = await sendMessage({
    threadId: input.threadId,
    senderId: user.id,
    body,
    attachments,
    ref: input.refRequestId ? { kind: "pengajuan", id: input.refRequestId } : null,
  });
  if (res.error) return { error: res.error };
  revalidatePath("/pesan");
  return { ok: true };
}

/**
 * Teruskan sebuah pengajuan ke seseorang — membuka japri lalu mengirimnya.
 *
 * Ini jalur "bahas pengajuan ini" dari halaman Pengajuan: satu langkah, tidak
 * perlu membuka Pesan lalu mencari orangnya sendiri.
 */
export async function chatForwardRequestAction(input: {
  requestId: string;
  toUserIds: string[];
  note: string;
}): Promise<{ threadId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (input.toUserIds.length === 0) return { error: "Pilih dulu tujuannya." };

  const req = await getHcRequest(input.requestId);
  if (!req) return { error: "Pengajuan tidak ditemukan." };
  if (!canSeeRequest(user, req)) {
    return { error: "Tidak punya akses ke pengajuan itu." };
  }

  try {
    let threadId: string;
    if (input.toUserIds.length === 1) {
      threadId = await openDirectThread(user.id, input.toUserIds[0]);
    } else {
      threadId = await createGroupThread(user.id, `Bahas: ${req.title}`.slice(0, 80), input.toUserIds);
    }
    const res = await sendMessage({
      threadId,
      senderId: user.id,
      body: input.note.trim(),
      ref: { kind: "pengajuan", id: req.id },
    });
    if (res.error) return { error: res.error };
    revalidatePath("/pesan");
    return { threadId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal meneruskan pengajuan." };
  }
}

/**
 * Teruskan sebuah REQUEST SYSTEM ke seseorang untuk ditanyakan.
 *
 * Terpisah dari `chatForwardRequestAction` karena request system adalah
 * catatan yang berbeda dengan pengajuan HC — memakai jalur yang sama berarti
 * kartunya akan dicari di tabel yang salah dan selalu tampil "sudah dihapus".
 *
 * Yang boleh meneruskan: tim System Support (yang menangani antreannya) atau
 * pemohonnya sendiri. Tanpa batas ini, id tebakan bisa dipakai menarik judul
 * request milik cabang lain ke dalam obrolan.
 */
export async function chatForwardSystemAction(input: {
  requestId: string;
  toUserIds: string[];
  note: string;
}): Promise<{ threadId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (input.toUserIds.length === 0) return { error: "Pilih dulu tujuannya." };

  const req = await getSystemRequestRow(input.requestId);
  if (!req) return { error: "Request tidak ditemukan." };
  if (!isSystemSupport(user) && req.requester_id !== user.id && user.role !== "super_admin") {
    return { error: "Tidak punya akses ke request itu." };
  }

  try {
    const threadId =
      input.toUserIds.length === 1
        ? await openDirectThread(user.id, input.toUserIds[0])
        : await createGroupThread(user.id, `Bahas: ${req.title}`.slice(0, 80), input.toUserIds);
    const res = await sendMessage({
      threadId,
      senderId: user.id,
      body: input.note.trim(),
      ref: { kind: "system", id: req.id },
    });
    if (res.error) return { error: res.error };
    revalidatePath("/pesan");
    return { threadId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal meneruskan request." };
  }
}

/**
 * Teruskan sebuah DOKUMEN HC (PKWT, SP, dsb) ke seseorang untuk ditanyakan.
 *
 * Yang boleh: tim HC yang menangani antreannya, supervisor yang mengajukannya,
 * atau admin. Dokumen HC memuat data pribadi karyawan, jadi batas ini lebih
 * penting daripada pada jenis rujukan lain.
 */
export async function chatForwardDocAction(input: {
  requestId: string;
  toUserIds: string[];
  note: string;
}): Promise<{ threadId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (input.toUserIds.length === 0) return { error: "Pilih dulu tujuannya." };

  const doc = await getHcSubmissionRow(input.requestId);
  if (!doc) return { error: "Dokumen tidak ditemukan." };
  const bolehHc = canReachMenu(user, "hc_review");
  if (!bolehHc && doc.supervisor_id !== user.id && user.role !== "super_admin") {
    return { error: "Tidak punya akses ke dokumen itu." };
  }

  try {
    const judul = `Bahas: ${doc.employee_name}`.slice(0, 80);
    const threadId =
      input.toUserIds.length === 1
        ? await openDirectThread(user.id, input.toUserIds[0])
        : await createGroupThread(user.id, judul, input.toUserIds);
    const res = await sendMessage({
      threadId,
      senderId: user.id,
      body: input.note.trim(),
      ref: { kind: "dokumen", id: doc.id },
    });
    if (res.error) return { error: res.error };
    revalidatePath("/pesan");
    return { threadId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal meneruskan dokumen." };
  }
}

export async function chatMarkReadAction(threadId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return;
  await markRead(threadId, user.id);
}

export async function chatMarkAllReadAction(): Promise<{ ok: true }> {
  const user = await getSessionUser();
  if (user && dbEnabled) await markAllRead(user.id);
  revalidatePath("/pesan");
  return { ok: true };
}

export async function chatHideThreadAction(threadId: string): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  const res = await hideThread(threadId, user.id);
  if (res.error) return { error: res.error };
  revalidatePath("/pesan");
  return { ok: true };
}

/** URL unggah langsung ke R2 untuk satu lampiran obrolan. */
export async function chatPresignAction(input: {
  name: string;
  contentType: string;
  size: number;
}): Promise<{ url?: string; path?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Tidak punya akses." };
  if (!r2Enabled()) return { error: "Penyimpanan berkas belum aktif." };
  if (input.size > MAX_BYTES) return { error: `Berkas "${input.name}" melebihi 10 MB.` };
  const safe = input.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const key = `chat/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  try {
    const url = await presignPut(key, input.contentType || "application/octet-stream");
    return { url, path: `${R2_PREFIX}${key}` };
  } catch (e) {
    console.error("[chat] gagal menandatangani URL unggah:", e);
    return { error: "Gagal menyiapkan unggahan." };
  }
}

/** Jalur cadangan saat R2 belum aktif: unggah kecil lewat server action. */
export async function chatUploadAction(
  formData: FormData,
): Promise<{ path?: string; name?: string; type?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  if (file.size > MAX_BYTES) return { error: `Berkas "${file.name}" melebihi 10 MB.` };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const path = `chat/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  const { error } = await db().storage.from("system-attachments").upload(path, file, { contentType: file.type });
  if (error) return { error: `Upload gagal: ${error.message}` };
  return { path, name: file.name, type: file.type || undefined };
}

/**
 * Pengajuan yang bisa diteruskan pengguna ke obrolan.
 *
 * Dipakai pemilih lampiran: tekan ikon "Pengajuan Design", muncul daftar design
 * yang memang boleh ia lihat. Cakupannya persis sama dengan halaman Pengajuan —
 * obrolan tidak boleh jadi jalan memutar untuk melihat pengajuan cabang lain.
 */
export async function chatPickableRequestsAction(kind: HcRequestKind): Promise<PickableRequest[]> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return [];
  const rows = await listHcRequests({ ...requestScopeFor(user), kind });
  return rows.slice(0, 50).map((r) => ({
    id: r.id,
    title: r.title,
    kindLabel: HC_REQUEST_KIND_LABEL[r.kind],
    statusLabel: statusMeta(r.kind, r.status).label,
    requesterName: r.requesterName,
    createdAt: r.createdAt,
  }));
}

export async function chatSetFavoriteAction(threadId: string, on: boolean): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  const res = await setFavorite(threadId, user.id, on);
  return res.error ? { error: res.error } : { ok: true };
}

export async function chatSetArchivedAction(threadId: string, on: boolean): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  const res = await setArchived(threadId, user.id, on);
  return res.error ? { error: res.error } : { ok: true };
}

/**
 * Detail satu pengajuan untuk dibuka DARI DALAM obrolan.
 *
 * Membuka halaman Pengajuan berarti meninggalkan percakapan; padahal yang
 * dibutuhkan setelah melihat detailnya justru membalas di obrolan yang sama.
 */
export async function chatRequestDetailAction(id: string): Promise<RequestDetail | null> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return null;
  const r = await getHcRequest(id);
  if (!r) return null;
  if (!canSeeRequest(user, r)) return null;
  return {
    id: r.id,
    kindLabel: HC_REQUEST_KIND_LABEL[r.kind],
    title: r.title,
    description: r.description,
    statusLabel: statusMeta(r.kind, r.status).label,
    requesterName: r.requesterName,
    department: r.department,
    assigneeName: r.assigneeName,
    designType: r.designType,
    designSize: r.designSize,
    plannedDate: r.plannedDate,
    position: r.position,
    headcount: r.headcount,
    trainingType: r.trainingType,
    participants: r.participants,
    budget: r.budget,
    createdAt: r.createdAt,
    revisions: r.revisions,
    attachments: r.attachments.map((a) => ({ name: a.name, url: a.url })),
    href: REQUEST_HREF[r.kind] ?? "/pengajuan",
  };
}

/** Statistik kecepatan balas di percakapan yang diikuti pengguna. */
export async function chatReplyStatsAction(): Promise<ReplyStat[]> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return [];
  return replyStats(user.id);
}
