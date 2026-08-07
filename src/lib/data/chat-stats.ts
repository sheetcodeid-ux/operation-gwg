import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getUser } from "./store";

/**
 * Kecepatan balas per orang.
 *
 * "Balas" didefinisikan sempit supaya angkanya jujur: pesan pertama seseorang
 * SETELAH pesan orang lain, di percakapan yang sama. Pesan kedua dan
 * seterusnya dalam satu giliran tidak dihitung — kalau dihitung, orang yang
 * suka mengetik beruntun akan terlihat paling cepat tanpa alasan.
 *
 * Jeda yang lebih panjang dari sehari dibuang. Balasan keesokan paginya
 * terhadap pesan tengah malam bukan "lambat 9 jam"; memasukkannya membuat
 * rata-rata menceritakan jam kerja, bukan kecepatan orangnya.
 */

/** Batas atas satu jeda balasan yang masih masuk hitungan. */
const MAX_GAP_MS = 12 * 60 * 60 * 1000;

/** Sejauh mana ke belakang dihitung — statistik lama tidak menggambarkan sekarang. */
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface ReplyStat {
  userId: string;
  name: string;
  /** Rata-rata jeda balas, dalam menit. */
  avgMinutes: number;
  /** Jeda paling lambat yang tercatat, dalam menit. */
  slowestMinutes: number;
  replies: number;
  /** Berapa persen balasannya di bawah satu jam. */
  fastPct: number;
}

interface Row {
  thread_id: string;
  sender_id: string;
  created_at: string;
}

/**
 * Hitung kecepatan balas untuk percakapan yang diikuti `meId`.
 *
 * Dibatasi ke percakapan si pengguna: statistik seluruh perusahaan bukan
 * urusannya, dan membacanya berarti menyisir seluruh tabel pesan.
 */
export async function replyStats(meId: string): Promise<ReplyStat[]> {
  if (!dbEnabled) return [];

  const mine = await selectAll<{ thread_id: string }>("chat_participants", (a, b) =>
    db().from("chat_participants").select("thread_id").eq("user_id", meId).order("thread_id").range(a, b),
  );
  const ids = mine.map((p) => p.thread_id);
  if (ids.length === 0) return [];

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const rows = await selectAll<Row>("chat_messages", (a, b) =>
    db()
      .from("chat_messages")
      .select("thread_id,sender_id,created_at")
      .in("thread_id", ids)
      .gt("created_at", since)
      .order("thread_id")
      .order("created_at")
      .range(a, b),
  );

  // Kelompokkan per percakapan, lalu telusuri urut waktu.
  const byThread = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byThread.get(r.thread_id);
    if (list) list.push(r);
    else byThread.set(r.thread_id, [r]);
  }

  const acc = new Map<string, { total: number; slowest: number; n: number; fast: number }>();
  for (const list of byThread.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.sender_id === cur.sender_id) continue; // masih giliran yang sama
      const gap = Date.parse(cur.created_at) - Date.parse(prev.created_at);
      if (!Number.isFinite(gap) || gap < 0 || gap > MAX_GAP_MS) continue;

      const a = acc.get(cur.sender_id) ?? { total: 0, slowest: 0, n: 0, fast: 0 };
      a.total += gap;
      a.slowest = Math.max(a.slowest, gap);
      a.n += 1;
      if (gap <= 60 * 60 * 1000) a.fast += 1;
      acc.set(cur.sender_id, a);
    }
  }

  const out: ReplyStat[] = [];
  for (const [userId, a] of acc) {
    if (a.n === 0) continue;
    out.push({
      userId,
      name: getUser(userId)?.name ?? "Pengguna dihapus",
      avgMinutes: Math.round(a.total / a.n / 60_000),
      slowestMinutes: Math.round(a.slowest / 60_000),
      replies: a.n,
      fastPct: Math.round((a.fast / a.n) * 100),
    });
  }
  // Paling lambat di atas — itu yang perlu dilihat lebih dulu.
  return out.sort((x, y) => y.avgMinutes - x.avgMinutes);
}
