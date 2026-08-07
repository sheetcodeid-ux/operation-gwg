import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getUser, getUsers } from "./store";
import { getHcRequest } from "./hc-requests";
import { isR2Key, presignGet, r2KeyOf } from "@/lib/storage/r2";
import { ROLE_LABEL } from "@/lib/constants";
import { HC_REQUEST_KIND_LABEL, statusMeta } from "@/lib/hc-request";
import { previewOf, type ChatAttachment, type ChatMessage, type ChatPerson, type ChatRef, type ChatThread } from "@/lib/chat-shared";
import type { Role, UserProfile } from "@/lib/types";

/**
 * Pesan — obrolan internal.
 *
 * Semua akses lewat sini supaya satu aturan berlaku di mana-mana: seseorang
 * hanya boleh menyentuh percakapan yang ia ikuti. Pengecekan itu ada di
 * `isParticipant`, dan setiap fungsi yang menerima `threadId` dari luar
 * memanggilnya lebih dulu.
 */

const SIGN_TTL = 60 * 60;
/** Satu layar riwayat. Percakapan lama tidak perlu ikut terbaca tiap kali. */
export const MESSAGE_PAGE = 60;

/**
 * Sejauh mana ke belakang pesan belum dibaca dihitung.
 *
 * Lencana hanya perlu memberitahu "ada yang baru". Menghitungnya sejak awal
 * waktu berarti membaca seluruh riwayat obrolan perusahaan setiap kali daftar
 * digambar — beban yang tumbuh selamanya dan tidak menambah informasi apa pun.
 */
const UNREAD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface ThreadRow {
  id: string;
  kind: string;
  title: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
  last_message_text: string;
  last_sender_id: string | null;
}

interface ParticipantRow {
  thread_id: string;
  user_id: string;
  last_read_at: string;
  hidden_at: string | null;
}

interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  attachments: unknown;
  ref_kind: string | null;
  ref_id: string | null;
  created_at: string;
}

export const chatEnabled = () => dbEnabled;

const personOf = (u: UserProfile): ChatPerson => ({
  id: u.id,
  name: u.name,
  role: u.role,
  roleLabel: ROLE_LABEL[u.role as Role] ?? u.role,
  department: u.department ?? "",
  jabatan: u.jabatan ?? null,
  avatarUrl: u.avatarUrl ?? null,
  email: u.email,
  phone: u.phone ?? null,
});

/** Rekan yang bisa diajak bicara: seluruh pengguna aktif, kecuali diri sendiri. */
export function chatDirectory(meId: string): ChatPerson[] {
  return getUsers()
    .filter((u) => u.active && u.id !== meId)
    .map(personOf)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

const attachmentsOf = (v: unknown): ChatAttachment[] =>
  (Array.isArray(v) ? v : [])
    .filter((a): a is { path: string; name: string } => !!a && typeof a === "object" && "path" in a && "name" in a)
    .map((a) => ({ path: String(a.path), name: String(a.name) }));

/** Apakah `userId` benar-benar peserta percakapan itu. */
async function isParticipant(threadId: string, userId: string): Promise<boolean> {
  const { data } = await db()
    .from("chat_participants")
    .select("user_id")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/* ─────────────────────────── daftar percakapan ─────────────────────────── */

export async function listThreads(meId: string): Promise<ChatThread[]> {
  if (!dbEnabled) return [];

  const mine = await selectAll<ParticipantRow>("chat_participants", (a, b) =>
    db().from("chat_participants").select("*").eq("user_id", meId).order("thread_id").range(a, b),
  );
  // Percakapan yang disembunyikan muncul lagi begitu ada pesan baru — persis
  // seperti aplikasi pesan lain; menyembunyikan bukan memblokir.
  const ids = mine.map((p) => p.thread_id);
  if (ids.length === 0) return [];

  const [threads, everyone] = await Promise.all([
    selectAll<ThreadRow>("chat_threads", (a, b) =>
      db().from("chat_threads").select("*").in("id", ids).order("id").range(a, b),
    ),
    selectAll<ParticipantRow>("chat_participants", (a, b) =>
      db().from("chat_participants").select("thread_id,user_id,last_read_at,hidden_at").in("thread_id", ids).order("thread_id").range(a, b),
    ),
  ]);

  const readAt = new Map(mine.map((p) => [p.thread_id, p]));
  const membersOf = new Map<string, string[]>();
  for (const p of everyone) {
    if (p.user_id === meId) continue;
    const list = membersOf.get(p.thread_id);
    if (list) list.push(p.user_id);
    else membersOf.set(p.thread_id, [p.user_id]);
  }

  // Jumlah belum dibaca: satu kueri untuk semua percakapan sekaligus, bukan
  // satu per baris. Hanya id yang diambil — isinya tidak dipakai di daftar.
  const unread = await unreadCounts(meId, mine);

  const out: ChatThread[] = [];
  for (const t of threads) {
    const me = readAt.get(t.id);
    // Disembunyikan DAN belum ada pesan baru sesudahnya ⇒ jangan tampilkan.
    if (me?.hidden_at && Date.parse(t.last_message_at) <= Date.parse(me.hidden_at)) continue;

    const others = (membersOf.get(t.id) ?? [])
      .map((id) => getUser(id))
      .filter((u): u is UserProfile => !!u)
      .map(personOf);

    const solo = others[0];
    out.push({
      id: t.id,
      kind: t.kind === "group" ? "group" : "dm",
      title: t.kind === "group" ? (t.title || "Grup tanpa nama") : (solo?.name ?? "Pengguna dihapus"),
      subtitle:
        t.kind === "group"
          ? `${others.length + 1} anggota`
          : [solo?.jabatan, solo?.department].filter(Boolean).join(" · ") || (solo?.roleLabel ?? ""),
      others,
      lastMessageText: t.last_message_text,
      lastMessageAt: t.last_message_at,
      lastSenderIsMe: t.last_sender_id === meId,
      unread: unread.get(t.id) ?? 0,
    });
  }

  return out.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/**
 * Berapa pesan yang belum dibaca per percakapan.
 *
 * Satu kueri untuk seluruh percakapan, lalu dihitung di memori — versi
 * per-percakapan berarti puluhan kueri hanya untuk menggambar daftar.
 *
 * Yang dibaca DIBATASI pada pesan setelah batas-baca paling lama. Tanpa batas
 * itu, menggambar daftar berarti membaca seluruh riwayat obrolan perusahaan
 * setiap kali halaman dibuka — beban yang tumbuh selamanya.
 */
async function unreadCounts(meId: string, mine: ParticipantRow[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (mine.length === 0) return out;
  const ids = mine.map((p) => p.thread_id);
  const readAt = new Map(mine.map((p) => [p.thread_id, Date.parse(p.last_read_at)]));

  // Batas baca sebuah percakapan yang belum pernah dibuka adalah 'epoch', jadi
  // mengambil "sejak batas terlama" berarti membaca SELURUH riwayat. Pandangan
  // ke belakang karena itu dibatasi UNREAD_WINDOW: lencana hanya perlu
  // memberitahu ada yang baru, bukan menghitung tepat pesan dua tahun lalu.
  const floor = Date.now() - UNREAD_WINDOW_MS;
  const oldest = Math.min(...[...readAt.values()].map((n) => (Number.isFinite(n) ? n : 0)));
  const earliest = new Date(Math.max(oldest, floor)).toISOString();

  const rows = await selectAll<{ thread_id: string; sender_id: string; created_at: string }>(
    "chat_messages",
    (a, b) =>
      db()
        .from("chat_messages")
        .select("thread_id,sender_id,created_at")
        .in("thread_id", ids)
        .gt("created_at", earliest)
        .order("id")
        .range(a, b),
  );
  for (const m of rows) {
    if (m.sender_id === meId) continue; // pesan sendiri tidak pernah "belum dibaca"
    if (Date.parse(m.created_at) <= (readAt.get(m.thread_id) ?? 0)) continue;
    out.set(m.thread_id, (out.get(m.thread_id) ?? 0) + 1);
  }
  return out;
}

/** Total pesan belum dibaca — dipakai lencana di sidebar. */
export async function unreadTotal(meId: string): Promise<number> {
  if (!dbEnabled) return 0;
  const mine = await selectAll<ParticipantRow>("chat_participants", (a, b) =>
    db().from("chat_participants").select("*").eq("user_id", meId).order("thread_id").range(a, b),
  );
  let n = 0;
  for (const v of (await unreadCounts(meId, mine)).values()) n += v;
  return n;
}

/* ───────────────────────────── isi percakapan ───────────────────────────── */

/** Ubah rujukan pengajuan jadi kartu yang bisa dibaca. */
async function refOf(kind: string | null, id: string | null): Promise<ChatRef | null> {
  if (kind !== "pengajuan" || !id) return null;
  const r = await getHcRequest(id);
  if (!r) {
    return {
      kind: "pengajuan",
      id,
      title: "Pengajuan sudah dihapus",
      kindLabel: "Pengajuan",
      statusLabel: "—",
      requesterName: "—",
      href: "/pengajuan",
      missing: true,
    };
  }
  const href =
    r.kind === "design" ? "/pengajuan/design" : r.kind === "pelatihan" ? "/pengajuan/pelatihan" : "/pengajuan/karyawan";
  return {
    kind: "pengajuan",
    id: r.id,
    title: r.title,
    kindLabel: HC_REQUEST_KIND_LABEL[r.kind],
    statusLabel: statusMeta(r.kind, r.status).label,
    requesterName: r.requesterName,
    href,
  };
}

/** Tanda tangani lampiran supaya bisa dibuka (bucket-nya privat). */
async function signAttachments(list: ChatMessage[]): Promise<void> {
  const paths = [...new Set(list.flatMap((m) => m.attachments.map((a) => a.path)))];
  if (paths.length === 0) return;
  const map = new Map<string, string>();
  const legacy: string[] = [];
  for (const p of paths) {
    if (isR2Key(p)) {
      try {
        map.set(p, await presignGet(r2KeyOf(p), SIGN_TTL));
      } catch {
        /* lewati satu berkas, jangan jatuhkan seluruh percakapan */
      }
    } else legacy.push(p);
  }
  if (legacy.length > 0) {
    try {
      const { data } = await db().storage.from("system-attachments").createSignedUrls(legacy, SIGN_TTL);
      for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
    } catch {
      /* penandatanganan tidak tersedia */
    }
  }
  for (const m of list) for (const a of m.attachments) a.url = map.get(a.path);
}

/**
 * Pesan terakhir sebuah percakapan.
 *
 * Mengembalikan `null` kalau pengguna bukan pesertanya — menebak id percakapan
 * orang lain tidak boleh membocorkan apa pun.
 */
export async function readThread(threadId: string, meId: string): Promise<ChatMessage[] | null> {
  if (!dbEnabled) return null;
  if (!(await isParticipant(threadId, meId))) return null;

  const { data } = await db()
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE);

  const rows = ((data ?? []) as MessageRow[]).reverse();
  const out: ChatMessage[] = [];
  for (const r of rows) {
    out.push({
      id: r.id,
      threadId: r.thread_id,
      senderId: r.sender_id,
      senderName: getUser(r.sender_id)?.name ?? "Pengguna dihapus",
      body: r.body,
      attachments: attachmentsOf(r.attachments),
      ref: await refOf(r.ref_kind, r.ref_id),
      createdAt: r.created_at,
    });
  }
  await signAttachments(out);
  return out;
}

/* ──────────────────────────── membuat & mengirim ──────────────────────────── */

/**
 * Percakapan japri dengan satu orang — dipakai ulang kalau sudah ada.
 *
 * Tanpa pemakaian ulang, tiap kali menekan "chat" akan lahir percakapan baru
 * dan riwayatnya tercecer di beberapa tempat.
 */
export async function openDirectThread(meId: string, otherId: string): Promise<string> {
  const mine = await selectAll<ParticipantRow>("chat_participants", (a, b) =>
    db().from("chat_participants").select("*").eq("user_id", meId).order("thread_id").range(a, b),
  );
  const ids = mine.map((p) => p.thread_id);
  if (ids.length > 0) {
    const [threads, theirs] = await Promise.all([
      selectAll<ThreadRow>("chat_threads", (a, b) =>
        db().from("chat_threads").select("id,kind").in("id", ids).order("id").range(a, b),
      ),
      selectAll<ParticipantRow>("chat_participants", (a, b) =>
        db().from("chat_participants").select("thread_id,user_id").in("thread_id", ids).eq("user_id", otherId).order("thread_id").range(a, b),
      ),
    ]);
    const dmIds = new Set(threads.filter((t) => t.kind !== "group").map((t) => t.id));
    // Japri yang sudah ada = percakapan dua orang yang keduanya ikut.
    for (const p of theirs) {
      if (dmIds.has(p.thread_id)) {
        // Muncul lagi kalau sebelumnya disembunyikan.
        await db().from("chat_participants").update({ hidden_at: null }).eq("thread_id", p.thread_id).eq("user_id", meId);
        return p.thread_id;
      }
    }
  }

  const id = `cht_${randomUUID()}`;
  const now = new Date().toISOString();
  const t = await db().from("chat_threads").insert({
    id,
    kind: "dm",
    created_by: meId,
    created_at: now,
    last_message_at: now,
    last_message_text: "",
  });
  if (t.error) throw new Error(`Gagal membuat percakapan: ${t.error.message}`);
  const p = await db()
    .from("chat_participants")
    .insert([
      { thread_id: id, user_id: meId, last_read_at: now },
      { thread_id: id, user_id: otherId, last_read_at: "epoch" },
    ]);
  if (p.error) throw new Error(`Gagal menambah peserta: ${p.error.message}`);
  return id;
}

/** Percakapan grup dengan judul dan beberapa anggota. */
export async function createGroupThread(meId: string, title: string, memberIds: string[]): Promise<string> {
  const id = `cht_${randomUUID()}`;
  const now = new Date().toISOString();
  const members = [...new Set([meId, ...memberIds])];
  const t = await db().from("chat_threads").insert({
    id,
    kind: "group",
    title: title.trim(),
    created_by: meId,
    created_at: now,
    last_message_at: now,
    last_message_text: "",
  });
  if (t.error) throw new Error(`Gagal membuat grup: ${t.error.message}`);
  const p = await db()
    .from("chat_participants")
    .insert(members.map((uid) => ({ thread_id: id, user_id: uid, last_read_at: uid === meId ? now : "epoch" })));
  if (p.error) throw new Error(`Gagal menambah anggota: ${p.error.message}`);
  return id;
}

export interface SendInput {
  threadId: string;
  senderId: string;
  body: string;
  attachments?: ChatAttachment[];
  ref?: { kind: "pengajuan"; id: string } | null;
}

export async function sendMessage(input: SendInput): Promise<{ id?: string; error?: string }> {
  if (!(await isParticipant(input.threadId, input.senderId))) return { error: "Tidak punya akses ke percakapan ini." };

  const id = `msg_${randomUUID()}`;
  const now = new Date().toISOString();
  const attachments = input.attachments ?? [];
  const { error } = await db().from("chat_messages").insert({
    id,
    thread_id: input.threadId,
    sender_id: input.senderId,
    body: input.body,
    attachments: attachments.map((a) => ({ path: a.path, name: a.name })),
    ref_kind: input.ref?.kind ?? null,
    ref_id: input.ref?.id ?? null,
    created_at: now,
  });
  if (error) return { error: error.message };

  // Ringkasan percakapan ikut diperbarui supaya daftar tidak perlu menghitung
  // ulang dari seluruh pesan setiap kali dibuka.
  await db()
    .from("chat_threads")
    .update({
      last_message_at: now,
      last_message_text: previewOf({ body: input.body, attachments, ref: input.ref ?? null }).slice(0, 160),
      last_sender_id: input.senderId,
    })
    .eq("id", input.threadId);

  // Pengirim otomatis sudah membaca pesannya sendiri.
  await db()
    .from("chat_participants")
    .update({ last_read_at: now })
    .eq("thread_id", input.threadId)
    .eq("user_id", input.senderId);

  return { id };
}

export async function markRead(threadId: string, meId: string): Promise<void> {
  if (!dbEnabled) return;
  await db()
    .from("chat_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", meId);
}

/** Tandai SELURUH percakapan sudah dibaca. */
export async function markAllRead(meId: string): Promise<void> {
  if (!dbEnabled) return;
  await db().from("chat_participants").update({ last_read_at: new Date().toISOString() }).eq("user_id", meId);
}

/**
 * Sembunyikan percakapan dari daftar SAYA saja.
 *
 * Bukan penghapusan: pesan tetap milik semua pesertanya, dan menghapus beneran
 * berarti menghapus riwayat orang lain juga. Percakapan muncul lagi kalau ada
 * pesan baru.
 */
export async function hideThread(threadId: string, meId: string): Promise<{ error?: string }> {
  if (!(await isParticipant(threadId, meId))) return { error: "Tidak punya akses ke percakapan ini." };
  const { error } = await db()
    .from("chat_participants")
    .update({ hidden_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", meId);
  return error ? { error: error.message } : {};
}

/** Peserta sebuah percakapan — untuk panel detail di kanan. */
export async function threadPeople(threadId: string, meId: string): Promise<ChatPerson[] | null> {
  if (!dbEnabled) return null;
  if (!(await isParticipant(threadId, meId))) return null;
  const { data } = await db().from("chat_participants").select("user_id").eq("thread_id", threadId);
  return ((data ?? []) as { user_id: string }[])
    .filter((p) => p.user_id !== meId)
    .map((p) => getUser(p.user_id))
    .filter((u): u is UserProfile => !!u)
    .map(personOf);
}
