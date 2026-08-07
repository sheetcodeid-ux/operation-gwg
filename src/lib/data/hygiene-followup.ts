import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getUser, getOutlets } from "./store";
import { isR2Key, presignGet, r2KeyOf } from "@/lib/storage/r2";
import type { ChatAttachment, FollowupAttempt, HygieneFollowup } from "@/lib/chat-shared";

/**
 * Tindak lanjut temuan hygiene.
 *
 * Temuan MENGGANTUNG sampai supervisornya menutupnya dengan bukti foto. Aturan
 * "tidak boleh ditutup tanpa bukti" ditegakkan DI SINI, bukan di tombolnya:
 * tombol yang dinonaktifkan hanya membuat jalur normal tertutup, sedangkan
 * pemanggilan langsung ke server tetap harus ditolak.
 */

const SIGN_TTL = 60 * 60;

interface Row {
  id: string;
  hygiene_id: string;
  outlet_id: string;
  photo: unknown;
  area: string;
  note: string;
  raised_by: string;
  assigned_to: string;
  thread_id: string | null;
  status: string;
  proof: unknown;
  attempts: unknown;
  resolution: string;
  resolved_at: string | null;
  created_at: string;
}

const attachmentsOf = (v: unknown): ChatAttachment[] =>
  (Array.isArray(v) ? v : [])
    .filter((a): a is { path: string; name: string; type?: string } => !!a && typeof a === "object" && "path" in a)
    .map((a) => ({ path: String(a.path), name: String(a.name ?? "berkas"), type: a.type }));

const attemptsOf = (v: unknown): FollowupAttempt[] =>
  (Array.isArray(v) ? v : [])
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
    .map((a) => ({
      at: String(a.at ?? ""),
      byName: String(a.byName ?? "—"),
      note: String(a.note ?? ""),
      proof: attachmentsOf(a.proof),
      verdict: a.verdict === "acc" ? "acc" : a.verdict === "tolak" ? "tolak" : "menunggu",
      reviewedAt: a.reviewedAt ? String(a.reviewedAt) : undefined,
      reviewedByName: a.reviewedByName ? String(a.reviewedByName) : undefined,
      reviewNote: a.reviewNote ? String(a.reviewNote) : undefined,
    }));

const photoOf = (v: unknown): ChatAttachment | null => {
  if (!v || typeof v !== "object" || !("path" in v)) return null;
  const o = v as { path: string; name?: string; type?: string };
  return { path: String(o.path), name: String(o.name ?? "foto"), type: o.type };
};

/** Tanda tangani beberapa path sekaligus (satu putaran, bukan satu per baris). */
async function signMany(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;
  const legacy: string[] = [];
  for (const p of unique) {
    if (isR2Key(p)) {
      try {
        map.set(p, await presignGet(r2KeyOf(p), SIGN_TTL));
      } catch {
        /* lewati satu berkas, jangan jatuhkan seluruh daftar */
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
  return map;
}

const outletName = (id: string) => getOutlets().find((o) => o.id === id)?.name ?? "Outlet";

async function toDomain(rows: Row[]): Promise<HygieneFollowup[]> {
  const paths: string[] = [];
  for (const r of rows) {
    const p = photoOf(r.photo);
    if (p) paths.push(p.path);
    for (const a of attachmentsOf(r.proof)) paths.push(a.path);
    for (const at of attemptsOf(r.attempts)) for (const a of at.proof) paths.push(a.path);
  }
  const urls = await signMany(paths);

  return rows.map((r) => {
    const photo = photoOf(r.photo);
    return {
      id: r.id,
      hygieneId: r.hygiene_id,
      outletName: outletName(r.outlet_id),
      area: r.area,
      note: r.note,
      photoUrl: photo ? urls.get(photo.path) : undefined,
      raisedByName: getUser(r.raised_by)?.name ?? "—",
      assignedToName: getUser(r.assigned_to)?.name ?? "—",
      assignedTo: r.assigned_to,
      raisedBy: r.raised_by,
      status: r.status === "selesai" ? "selesai" : r.status === "verifikasi" ? "verifikasi" : "menunggu",
      resolution: r.resolution,
      proof: attachmentsOf(r.proof).map((a) => ({ ...a, url: urls.get(a.path) })),
      attempts: attemptsOf(r.attempts).map((at) => ({
        ...at,
        proof: at.proof.map((a) => ({ ...a, url: urls.get(a.path) })),
      })),
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
      threadId: r.thread_id,
    };
  });
}

export interface RaiseInput {
  hygieneId: string;
  outletId: string;
  photo: ChatAttachment;
  area: string;
  note: string;
  raisedBy: string;
  assignedTo: string;
  threadId: string;
}

export async function raiseFollowup(input: RaiseInput): Promise<{ id?: string; error?: string }> {
  if (!dbEnabled) return { error: "Basis data belum aktif." };
  const id = `hfu_${randomUUID()}`;
  const { error } = await db().from("hygiene_followups").insert({
    id,
    hygiene_id: input.hygieneId,
    outlet_id: input.outletId,
    photo: { path: input.photo.path, name: input.photo.name, type: input.photo.type ?? null },
    area: input.area,
    note: input.note,
    raised_by: input.raisedBy,
    assigned_to: input.assignedTo,
    thread_id: input.threadId,
    status: "menunggu",
  });
  return error ? { error: error.message } : { id };
}

export async function getFollowup(id: string): Promise<HygieneFollowup | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("hygiene_followups").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return (await toDomain([data as Row]))[0] ?? null;
}

/** Beberapa temuan sekaligus — dipakai saat menggambar kartu di percakapan. */
export async function getFollowups(ids: string[]): Promise<Map<string, HygieneFollowup>> {
  const out = new Map<string, HygieneFollowup>();
  const unique = [...new Set(ids)];
  if (!dbEnabled || unique.length === 0) return out;
  const { data } = await db().from("hygiene_followups").select("*").in("id", unique);
  for (const f of await toDomain((data ?? []) as Row[])) out.set(f.id, f);
  return out;
}

/** Temuan yang menggantung untuk satu orang — dasar lencana peringatan. */
export async function pendingFollowupsFor(userId: string): Promise<HygieneFollowup[]> {
  if (!dbEnabled) return [];
  const rows = await selectAll<Row>("hygiene_followups", (a, b) =>
    db()
      .from("hygiene_followups")
      .select("*")
      .eq("assigned_to", userId)
      .eq("status", "menunggu")
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b),
  );
  return toDomain(rows);
}

/**
 * Temuan yang menunggu PENILAIAN saya (sebagai pelapor).
 *
 * Sisi lain dari `pendingFollowupsFor`: supervisor sudah mengirim bukti dan
 * bola ada di tangan pelapornya. Tanpa daftar ini, perbaikan yang sudah selesai
 * bisa menggantung berhari-hari hanya karena tidak ada yang tahu harus menilai.
 */
export async function awaitingReviewFor(userId: string): Promise<HygieneFollowup[]> {
  if (!dbEnabled) return [];
  const rows = await selectAll<Row>("hygiene_followups", (a, b) =>
    db()
      .from("hygiene_followups")
      .select("*")
      .eq("raised_by", userId)
      .eq("status", "verifikasi")
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b),
  );
  return toDomain(rows);
}

/** Audit mana saja yang temuannya sudah pernah dikirim (menandai tombolnya). */
export async function followupCountsByAudit(hygieneIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(hygieneIds)];
  if (!dbEnabled || unique.length === 0) return out;
  const { data } = await db()
    .from("hygiene_followups")
    .select("hygiene_id")
    .in("hygiene_id", unique.slice(0, 500));
  for (const r of (data ?? []) as { hygiene_id: string }[]) {
    out.set(r.hygiene_id, (out.get(r.hygiene_id) ?? 0) + 1);
  }
  return out;
}

/**
 * Supervisor mengirim bukti perbaikan — masuk VERIFIKASI, belum selesai.
 *
 * Dulu ini langsung menutup temuan, yang berarti penilaian akhir ada di tangan
 * orang yang diperiksa. Sekarang pelapor yang memutuskan.
 *
 * Bukti WAJIB foto, dan penolakannya ada di sini — bukan sekadar tombol yang
 * dinonaktifkan. Kalau hanya tombolnya, temuan bisa ditutup dengan memanggil
 * server langsung dan seluruh gunanya hilang.
 */
export async function submitFollowup(input: {
  id: string;
  userId: string;
  userName: string;
  note: string;
  proof: ChatAttachment[];
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Basis data belum aktif." };

  const { data } = await db().from("hygiene_followups").select("*").eq("id", input.id).maybeSingle();
  const row = data as Row | null;
  if (!row) return { error: "Temuan tidak ditemukan." };
  if (row.assigned_to !== input.userId) return { error: "Hanya supervisor yang ditugaskan yang bisa menindaklanjuti." };
  if (row.status === "selesai") return { error: "Temuan ini sudah ditutup." };
  if (row.status === "verifikasi") return { error: "Bukti sebelumnya masih menunggu verifikasi." };

  const photos = input.proof.filter((a) => (a.type ? a.type.startsWith("image/") : true));
  if (photos.length === 0) return { error: "Wajib melampirkan foto bukti perbaikan." };

  const attempts = attemptsOf(row.attempts);
  attempts.push({
    at: new Date().toISOString(),
    byName: input.userName,
    note: input.note.trim(),
    proof: photos.map((a) => ({ path: a.path, name: a.name, type: a.type })),
    verdict: "menunggu",
  });

  const { error } = await db()
    .from("hygiene_followups")
    .update({
      status: "verifikasi",
      resolution: input.note.trim(),
      proof: photos.map((a) => ({ path: a.path, name: a.name, type: a.type ?? null })),
      attempts,
    })
    .eq("id", input.id);
  return error ? { error: error.message } : {};
}

/**
 * Pelapor menilai hasil perbaikan: ACC, atau kembalikan untuk dibersihkan ulang.
 *
 * Ditolak berarti temuan kembali MENGGANTUNG — bukan ditutup dengan catatan —
 * supaya yang belum beres tetap terlihat merah sampai benar-benar beres.
 */
export async function reviewFollowup(input: {
  id: string;
  userId: string;
  userName: string;
  accept: boolean;
  note: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Basis data belum aktif." };

  const { data } = await db().from("hygiene_followups").select("*").eq("id", input.id).maybeSingle();
  const row = data as Row | null;
  if (!row) return { error: "Temuan tidak ditemukan." };
  if (row.raised_by !== input.userId) return { error: "Hanya pelapor temuan yang bisa menilai hasilnya." };
  if (row.status !== "verifikasi") return { error: "Belum ada bukti perbaikan yang menunggu penilaian." };
  if (!input.accept && !input.note.trim()) return { error: "Tulis alasan pengembaliannya." };

  const attempts = attemptsOf(row.attempts);
  const last = attempts[attempts.length - 1];
  if (last) {
    last.verdict = input.accept ? "acc" : "tolak";
    last.reviewedAt = new Date().toISOString();
    last.reviewedByName = input.userName;
    last.reviewNote = input.note.trim();
  }

  const { error } = await db()
    .from("hygiene_followups")
    .update({
      status: input.accept ? "selesai" : "menunggu",
      resolved_at: input.accept ? new Date().toISOString() : null,
      attempts,
    })
    .eq("id", input.id);
  return error ? { error: error.message } : {};
}
