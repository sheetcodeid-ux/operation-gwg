import "server-only";

import { db, dbEnabled } from "./db";

/**
 * WORK Z-02 — BACA SECUKUPNYA UNTUK MEMUTUSKAN OTORISASI.
 *
 * ┌─ KENAPA PEMBACAAN INI ADA, PADAHAL BASIS DATA SUDAH MENJAGA ─────────────┐
 * │                                                                          │
 * │ Yang dijaga basis data INVARIANT — owner bukan pelaksana, transisi yang  │
 * │ sah, terminal yang berhenti. Yang TIDAK dijaganya OTORISASI: siapa yang  │
 * │ boleh menekan tombolnya. Fungsi `gwg_*` berjalan sebagai service role    │
 * │ tanpa konteks autentikasi dan tidak akan pernah bisa menjawabnya         │
 * │ (AD-20 · C, AD-20 · J.1).                                                │
 * │                                                                          │
 * │ Kontrak O-06 menyebut dua hal yang hanya bisa dijawab dari baris Work    │
 * │ itu sendiri: "Owner saat itu" dan "pelaksana aktif". Berkas ini          │
 * │ menjawab keduanya, dan tidak lebih dari itu.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * BUKAN read model daftar kerja. Layar Command Center punya pembacanya
 * sendiri; yang di sini sengaja sempit supaya tidak berubah menjadi pintu
 * belakang untuk membaca Work tanpa melewati batas akses layarnya.
 */

/** Keadaan satu Work sejauh yang dibutuhkan untuk memutuskan otorisasi. */
export interface WorkUntukAksi {
  id: number;
  ownerId: string;
  status: string;
  /** Apakah aktor yang ditanyakan sedang menjadi pelaksana aktif Work ini. */
  pelaksanaAktif: boolean;
}

export type HasilBacaWork = { ok: true; work: WorkUntukAksi } | { ok: false; alasan: "db_mati" | "tidak_ditemukan" | "gagal" };

/**
 * Ambil owner, status, dan keanggotaan pelaksana aktif untuk satu Work.
 *
 * `userId` ikut masuk supaya "apakah SAYA pelaksana aktifnya" dijawab basis
 * data, bukan dengan menarik seluruh daftar pelaksana ke memori lalu
 * mencarinya di sini — daftar yang ditarik utuh cepat atau lambat dipakai
 * untuk hal lain.
 */
export async function ambilWorkUntukAksi(id: number, userId: string): Promise<HasilBacaWork> {
  if (!dbEnabled) return { ok: false, alasan: "db_mati" };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "tidak_ditemukan" };
  try {
    const { data, error } = await db().from("works").select("id,owner_id,status").eq("id", id).maybeSingle();
    if (error) return { ok: false, alasan: "gagal" };
    if (!data) return { ok: false, alasan: "tidak_ditemukan" };

    const { data: pelaksana, error: galatPelaksana } = await db()
      .from("work_executors")
      .select("user_id")
      .eq("work_id", id)
      .eq("user_id", userId)
      .is("dilepas_pada", null)
      .limit(1);
    if (galatPelaksana) return { ok: false, alasan: "gagal" };

    return {
      ok: true,
      work: {
        id: data.id as number,
        ownerId: data.owner_id as string,
        status: data.status as string,
        pelaksanaAktif: (pelaksana ?? []).length > 0,
      },
    };
  } catch {
    return { ok: false, alasan: "gagal" };
  }
}
