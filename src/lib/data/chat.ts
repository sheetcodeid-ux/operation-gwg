import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getUser, getUsers } from "./store";
import { getFollowups } from "./hygiene-followup";
import { notifyCollapsed } from "./notify";
import { isR2Key, presignGet, r2KeyOf } from "@/lib/storage/r2";
import { ROLE_LABEL } from "@/lib/constants";
import { HC_REQUEST_KIND_LABEL, statusMeta, type HcRequestKind, type HcRequestStatus } from "@/lib/hc-request";
import { SYS_TYPE_LABEL, SYS_STATUS_META, type SysRequestType, type SysStatus } from "@/lib/system-shared";
import { FOLLOWUP_STATUS, previewOf, type ChatAttachment, type ChatMessage, type ChatPerson, type ChatRef, type ChatThread } from "@/lib/chat-shared";
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
  favorite: boolean | null;
  archived_at: string | null;
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
    .filter((a): a is { path: string; name: string; type?: string } => !!a && typeof a === "object" && "path" in a)
    .map((a) => ({ path: String(a.path), name: String(a.name ?? "berkas"), type: a.type ? String(a.type) : undefined }));

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
      db().from("chat_participants").select("thread_id,user_id").in("thread_id", ids).order("thread_id").range(a, b),
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
      favorite: !!me?.favorite,
      archived: !!me?.archived_at,
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

export const REQUEST_HREF: Record<string, string> = {
  design: "/pengajuan/design",
  pelatihan: "/pengajuan/pelatihan",
  rekrutmen: "/pengajuan/karyawan",
};

/**
 * Ubah SEMUA rujukan pengajuan dalam satu percakapan jadi kartu, sekali baca.
 *
 * Versi sebelumnya memanggil `getHcRequest` per pesan. Percakapan dengan sepuluh
 * pengajuan berarti sepuluh kueri berurutan — itulah jeda yang terasa saat
 * berpindah percakapan.
 */
async function refMap(ids: string[]): Promise<Map<string, ChatRef>> {
  const out = new Map<string, ChatRef>();
  const unique = [...new Set(ids)];
  if (unique.length === 0 || !dbEnabled) return out;

  const { data } = await db()
    .from("hc_requests")
    .select("id,kind,title,status,requester_id")
    .in("id", unique);

  for (const r of (data ?? []) as { id: string; kind: string; title: string; status: string; requester_id: string }[]) {
    const kind = r.kind as HcRequestKind;
    out.set(r.id, {
      kind: "pengajuan",
      id: r.id,
      title: r.title,
      kindLabel: HC_REQUEST_KIND_LABEL[kind] ?? "Pengajuan",
      statusLabel: statusMeta(kind, r.status as HcRequestStatus).label,
      requesterName: getUser(r.requester_id)?.name ?? "—",
      href: REQUEST_HREF[r.kind] ?? "/pengajuan",
    });
  }

  // Pengajuan yang sudah dihapus tetap ditampilkan, tapi mati — kalau kartunya
  // hilang begitu saja, percakapannya jadi tidak masuk akal dibaca ulang.
  for (const id of unique) {
    if (!out.has(id)) {
      out.set(id, {
        kind: "pengajuan",
        id,
        title: "Pengajuan sudah dihapus",
        kindLabel: "Pengajuan",
        statusLabel: "—",
        requesterName: "—",
        href: "/pengajuan",
        missing: true,
      });
    }
  }
  return out;
}

/**
 * Request System sebagai kartu obrolan.
 *
 * Dibaca sekali untuk seluruh percakapan, sama seperti rujukan pengajuan —
 * satu kueri per pesan adalah jeda yang langsung terasa saat berpindah
 * percakapan.
 */
async function systemRefMap(ids: string[]): Promise<Map<string, ChatRef>> {
  const out = new Map<string, ChatRef>();
  const unique = [...new Set(ids)];
  if (unique.length === 0 || !dbEnabled) return out;

  const { data } = await db()
    .from("system_requests")
    .select("id,title,status,requester_id,request_type")
    .in("id", unique);

  for (const r of (data ?? []) as { id: string; title: string; status: SysStatus; requester_id: string; request_type: string }[]) {
    out.set(r.id, {
      kind: "system",
      id: r.id,
      title: r.title,
      kindLabel: SYS_TYPE_LABEL[r.request_type as SysRequestType] ?? "Request System",
      statusLabel: SYS_STATUS_META[r.status]?.label ?? "—",
      requesterName: getUser(r.requester_id)?.name ?? "—",
      href: "/system/pengajuan",
    });
  }

  // Yang sudah dihapus tetap tampil, tapi mati — kartunya hilang begitu saja
  // membuat percakapannya tidak masuk akal dibaca ulang.
  for (const id of unique) {
    if (!out.has(id)) {
      out.set(id, {
        kind: "system",
        id,
        title: "Request system sudah dihapus",
        kindLabel: "Request System",
        statusLabel: "—",
        requesterName: "—",
        href: "/system/pengajuan",
        missing: true,
      });
    }
  }
  return out;
}

/** Temuan hygiene sebagai kartu obrolan — merah selama belum ditindaklanjuti. */
async function hygieneRefMap(ids: string[]): Promise<Map<string, ChatRef>> {
  const out = new Map<string, ChatRef>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  const found = await getFollowups(unique);
  for (const id of unique) {
    const f = found.get(id);
    if (!f) {
      out.set(id, {
        kind: "hygiene",
        id,
        title: "Temuan sudah dihapus",
        kindLabel: "Temuan Hygiene",
        statusLabel: "—",
        requesterName: "—",
        href: "/hygiene",
        missing: true,
      });
      continue;
    }
    const meta = FOLLOWUP_STATUS[f.status];
    out.set(id, {
      kind: "hygiene",
      id,
      title: `${f.area || "Area"} — ${f.outletName}`,
      kindLabel: "Temuan Hygiene",
      statusLabel: meta.label,
      requesterName: f.raisedByName,
      href: "/hygiene",
      photoUrl: f.photoUrl,
      tone: meta.tone,
    });
  }
  return out;
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
  // Tiga jenis rujukan, masing-masing SEKALI baca untuk seluruh percakapan.
  const [refs, hyg, sys] = await Promise.all([
    refMap(rows.filter((r) => r.ref_kind === "pengajuan" && r.ref_id).map((r) => r.ref_id!)),
    hygieneRefMap(rows.filter((r) => r.ref_kind === "hygiene" && r.ref_id).map((r) => r.ref_id!)),
    systemRefMap(rows.filter((r) => r.ref_kind === "system" && r.ref_id).map((r) => r.ref_id!)),
  ]);

  const out: ChatMessage[] = rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    senderId: r.sender_id,
    senderName: getUser(r.sender_id)?.name ?? "Pengguna dihapus",
    body: r.body,
    attachments: attachmentsOf(r.attachments),
    ref: r.ref_id
      ? ((r.ref_kind === "hygiene" ? hyg : r.ref_kind === "system" ? sys : refs).get(r.ref_id) ?? null)
      : null,
    createdAt: r.created_at,
  }));
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
  ref?: { kind: "pengajuan" | "hygiene" | "system"; id: string } | null;
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
    attachments: attachments.map((a) => ({ path: a.path, name: a.name, type: a.type ?? null })),
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

  await beritahuPesanMasuk(input, attachments);

  return { id };
}

/**
 * Kabari peserta lain bahwa ada pesan masuk.
 *
 * Ditujukan PERORANGAN, tidak pernah ke departemen: isi percakapan hanya milik
 * pesertanya. Mengirimkannya ke satu departemen berarti membocorkan cuplikan
 * pesan ke orang yang tidak ada di percakapan itu.
 *
 * Digabungkan per percakapan (`notifyCollapsed`), jadi obrolan bolak-balik tetap
 * satu baris di lonceng sampai dibaca — bukan satu baris per pesan.
 */
async function beritahuPesanMasuk(input: SendInput, attachments: ChatAttachment[]): Promise<void> {
  try {
    const { data } = await db()
      .from("chat_participants")
      .select("user_id")
      .eq("thread_id", input.threadId);
    const penerima = ((data ?? []) as { user_id: string }[])
      .map((p) => p.user_id)
      .filter((uid) => uid !== input.senderId);
    if (penerima.length === 0) return;

    const pengirim = getUser(input.senderId)?.name ?? "Seseorang";
    const { data: t } = await db()
      .from("chat_threads")
      .select("kind, title")
      .eq("id", input.threadId)
      .maybeSingle();
    const thread = t as { kind: string; title: string | null } | null;
    const judul =
      thread?.kind === "group" && thread.title
        ? `Pesan baru di ${thread.title}`
        : `Pesan baru dari ${pengirim}`;

    const cuplikan = previewOf({ body: input.body, attachments, ref: input.ref ?? null });
    await notifyCollapsed({
      kind: "chat_message",
      title: judul,
      message: thread?.kind === "group" ? `${pengirim}: ${cuplikan}` : cuplikan,
      href: `/pesan?t=${input.threadId}`,
      targetUsers: penerima,
      actorName: pengirim,
    });
  } catch {
    // Notifikasi adalah efek samping — pesannya sendiri sudah tersimpan.
  }
}

export async function markRead(threadId: string, meId: string): Promise<void> {
  if (!dbEnabled) return;
  await db()
    .from("chat_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", meId);
  await bersihkanNotifPesan(meId, `/pesan?t=${threadId}`);
}

/** Tandai SELURUH percakapan sudah dibaca. */
export async function markAllRead(meId: string): Promise<void> {
  if (!dbEnabled) return;
  await db().from("chat_participants").update({ last_read_at: new Date().toISOString() }).eq("user_id", meId);
  await bersihkanNotifPesan(meId);
}

/**
 * Percakapan sudah dibuka → notifikasinya tidak perlu ada lagi.
 *
 * Tanpa ini lonceng terus memberitahu "ada pesan baru" untuk percakapan yang
 * barusan dibaca, dan angkanya jadi bohong.
 */
async function bersihkanNotifPesan(meId: string, href?: string): Promise<void> {
  try {
    let q = db()
      .from("notifications")
      .update({ read: true, dismissed: true })
      .eq("kind", "chat_message")
      .eq("target_user", meId)
      .eq("dismissed", false);
    if (href) q = q.eq("href", href);
    await q;
  } catch {
    // Efek samping; membaca percakapan tetap berhasil.
  }
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

/** Tandai favorit — keputusan pribadi, tidak mengubah tampilan lawan bicara. */
export async function setFavorite(threadId: string, meId: string, on: boolean): Promise<{ error?: string }> {
  if (!(await isParticipant(threadId, meId))) return { error: "Tidak punya akses ke percakapan ini." };
  const { error } = await db()
    .from("chat_participants")
    .update({ favorite: on })
    .eq("thread_id", threadId)
    .eq("user_id", meId);
  return error ? { error: error.message } : {};
}

/**
 * Arsipkan / kembalikan percakapan.
 *
 * Berbeda dari menyembunyikan: yang diarsipkan tetap ada dan bisa dibuka lewat
 * baris "Diarsipkan", hanya tidak ikut memenuhi daftar utama.
 */
export async function setArchived(threadId: string, meId: string, on: boolean): Promise<{ error?: string }> {
  if (!(await isParticipant(threadId, meId))) return { error: "Tidak punya akses ke percakapan ini." };
  const { error } = await db()
    .from("chat_participants")
    .update({ archived_at: on ? new Date().toISOString() : null })
    .eq("thread_id", threadId)
    .eq("user_id", meId);
  return error ? { error: error.message } : {};
}
