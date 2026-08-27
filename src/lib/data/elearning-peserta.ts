import "server-only";

import { db, dbEnabled } from "@/lib/data/db";
import { listLearners } from "@/lib/data/elearning-admin";

// Aturannya sendiri hidup di modul bebas `server-only` supaya layar memakai
// aturan yang sama persis, bukan salinannya.
export { bolehIkut, pesertaEfektif, subjectTerbuka } from "@/lib/elearning-peserta";

/**
 * Pembacaan dan penyimpanan peserta subject E-Learning.
 *
 * Aturannya ada di `@/lib/elearning-peserta`. Yang di sini hanya kueri.
 *
 * ATURAN KOSONG YANG DISENGAJA — dan ini bagian yang paling mudah salah dibaca
 * nanti, jadi ditulis di sini sekali untuk seluruh modul:
 *
 *   Subject TANPA satu pun baris peserta berarti TERBUKA untuk semua peserta.
 *
 * Bukan "belum ada pesertanya", melainkan "berlaku untuk semua". Itulah yang
 * membuat perubahan ini bisa dipasang tanpa backfill: seluruh course yang sudah
 * ada hari ini tidak punya baris peserta, jadi mereka tetap terbuka persis
 * seperti sebelumnya, dan tidak ada satu pun karyawan yang mendadak kehilangan
 * materinya. HC memindahkannya satu per satu kapan pun mereka siap.
 *
 * Konsekuensinya yang harus diingat: "hapus semua peserta" TIDAK berarti
 * menutup subject untuk semua orang — ia justru membukanya kembali untuk semua.
 * Menutup subject dilakukan dengan menonaktifkannya, bukan dengan mengosongkan
 * pesertanya.
 */

export interface BarisPeserta {
  courseId: string;
  userId: string;
  assignedAt: string;
}

/** Peserta yang ditugaskan pada satu subject. Kosong berarti subject terbuka. */
export async function pesertaCourse(courseId: string): Promise<string[]> {
  if (!dbEnabled) return [];
  const { data } = await db().from("elearning_participants").select("user_id").eq("course_id", courseId);
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/** Peserta seluruh subject sekaligus — untuk daftar dan rekap. */
export async function pesertaSemuaCourse(): Promise<Map<string, string[]>> {
  const peta = new Map<string, string[]>();
  if (!dbEnabled) return peta;
  const { data } = await db().from("elearning_participants").select("course_id,user_id");
  for (const r of (data ?? []) as { course_id: string; user_id: string }[]) {
    peta.set(r.course_id, [...(peta.get(r.course_id) ?? []), r.user_id]);
  }
  return peta;
}

/**
 * Menetapkan daftar peserta satu subject — mengganti seluruh isinya, bukan
 * menambah.
 *
 * Sengaja "ganti seluruhnya": layar penyuntingannya menampilkan daftar utuh,
 * jadi yang dikirimnya juga daftar utuh. Menambah-saja akan membuat nama yang
 * dihapus di layar tetap tertinggal di basis data tanpa ada yang menyadarinya.
 */
export async function simpanPesertaCourse(
  courseId: string,
  userIds: string[],
  olehUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbEnabled) return { ok: false, error: "Penyimpanan belum aktif." };
  const unik = [...new Set(userIds.map((s) => s.trim()).filter(Boolean))];

  const hapus = await db().from("elearning_participants").delete().eq("course_id", courseId);
  if (hapus.error) return { ok: false, error: hapus.error.message };
  if (unik.length === 0) return { ok: true };

  const now = new Date().toISOString();
  const isi = await db()
    .from("elearning_participants")
    .insert(unik.map((user_id) => ({ course_id: courseId, user_id, assigned_at: now, assigned_by: olehUserId })));
  if (isi.error) return { ok: false, error: isi.error.message };
  return { ok: true };
}

/**
 * Subject apa saja yang jadi tugas seorang peserta.
 *
 * Yang dikembalikan id subject yang DITUGASKAN padanya saja; subject terbuka
 * tidak ikut, karena pemanggilnya sudah tahu subject terbuka berlaku untuk
 * semua. Menggabungkan keduanya di sini membuat pemanggilnya kehilangan
 * kemampuan membedakan "ditugaskan ke saya" dari "terbuka untuk semua" — dan
 * dua hal itu berbeda di layar peserta.
 */
export async function courseUntukUser(userId: string): Promise<Set<string>> {
  if (!dbEnabled) return new Set();
  const { data } = await db().from("elearning_participants").select("course_id").eq("user_id", userId);
  return new Set(((data ?? []) as { course_id: string }[]).map((r) => r.course_id));
}

/** Jumlah peserta efektif tiap subject — untuk kolom Participants di daftar. */
export async function rekapJumlahPeserta(): Promise<{ perCourse: Map<string, number>; semua: number }> {
  const semua = listLearners().length;
  const peta = await pesertaSemuaCourse();
  const perCourse = new Map<string, number>();
  for (const [courseId, ids] of peta) perCourse.set(courseId, ids.length);
  return { perCourse, semua };
}
