import "server-only";

import { db, dbEnabled } from "./db";

/**
 * SIGNAL — DUA TINDAKAN MANUSIA, DAN HANYA DUA.
 *
 * Berkas ini satu-satunya yang menulis blok KEADAAN KERJA `signals`. Mesin
 * deteksi menulis blok pengamatan lewat `gwg_deteksi_signal`; keduanya tidak
 * pernah bertemu di kolom yang sama.
 *
 * ┌─ YANG TIDAK BOLEH ADA DI SINI, SELAMANYA ────────────────────────────────┐
 * │                                                                          │
 * │   membuka kembali yang sudah diabaikan   keputusan orang, bukan hasil    │
 * │                                          deteksi (trigger menolaknya)    │
 * │   menghapus Signal                       ia bukti bahwa sesuatu pernah   │
 * │                                          terdeteksi (trigger menolaknya) │
 * │   mengubah snapshot                      keadaan saat pertama terdeteksi │
 * │   mencabut pengakuan                     jejak orang yang sudah membaca  │
 * │                                                                          │
 * │ Keempatnya dijaga trigger basis data, bukan oleh berkas ini. Yang di     │
 * │ sini menjaga agar permintaannya tidak pernah sampai ke sana.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * OTORISASI TIDAK ADA DI SINI. Ia milik `src/lib/actions/signals.ts`, yang
 * memeriksanya sebelum memanggil apa pun di berkas ini — satu tempat, supaya
 * bisa dibaca sekali dan diuji sekali.
 */

export type HasilTulis =
  | { ok: true; berubah: boolean }
  | { ok: false; alasan: "db_mati" | "tidak_ditemukan" | "sudah_diabaikan" | "gagal" };

/**
 * Tandai Signal sebagai sudah dilihat.
 *
 * IDEMPOTEN, dan idempotensinya ada di `is("diakui_oleh", null)`: pengakuan
 * kedua tidak menemukan baris, jadi tidak menimpa apa pun. Yang tercatat orang
 * PERTAMA yang melihatnya — bukan yang terakhir menekan tombolnya.
 *
 * `status` TIDAK disentuh. Signal yang sudah diakui tetap `terbuka` dan tetap
 * muncul di daftar kerja (Z-01 · D1 = B).
 */
export async function akuiSignal(id: number, olehUserId: string): Promise<HasilTulis> {
  if (!dbEnabled) return { ok: false, alasan: "db_mati" };
  try {
    const { data, error } = await db()
      .from("signals")
      .update({ diakui_oleh: olehUserId, diakui_pada: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "terbuka")
      .is("diakui_oleh", null)
      .select("id");
    if (error) return { ok: false, alasan: "gagal" };
    // Nol baris BUKAN kegagalan: ia berarti sudah pernah diakui, atau sudah
    // diabaikan. Keduanya keadaan sah, dan keduanya tidak menuntut apa pun.
    return { ok: true, berubah: (data ?? []).length > 0 };
  } catch {
    return { ok: false, alasan: "gagal" };
  }
}

/**
 * Nyatakan sebuah Signal tidak perlu ditindaklanjuti.
 *
 * TIDAK DAPAT DIBATALKAN. Trigger `signals_tak_tersunting_trg` menolak
 * `diabaikan → terbuka`, jadi tidak ada jalan kembali dari mana pun — termasuk
 * dari berkas ini.
 *
 * Alasannya WAJIB dan sudah dipangkas pemanggilnya; constraint
 * `signals_diabaikan_utuh` menolak yang kosong sebagai jaring kedua.
 */
export async function abaikanSignal(id: number, olehUserId: string, alasan: string): Promise<HasilTulis> {
  if (!dbEnabled) return { ok: false, alasan: "db_mati" };
  const bersih = alasan.trim();
  if (bersih.length === 0) return { ok: false, alasan: "gagal" };
  try {
    const { data, error } = await db()
      .from("signals")
      .update({
        status: "diabaikan",
        diabaikan_oleh: olehUserId,
        diabaikan_pada: new Date().toISOString(),
        diabaikan_alasan: bersih,
      })
      .eq("id", id)
      .eq("status", "terbuka")
      .select("id");
    if (error) return { ok: false, alasan: "gagal" };
    const baris = (data ?? []).length;
    // Nol baris berarti Signal-nya sudah diabaikan lebih dulu oleh orang lain.
    // Itu bukan galat, tapi juga bukan keberhasilan yang boleh diklaim: yang
    // tercatat tetap keputusan orang pertama.
    return baris > 0 ? { ok: true, berubah: true } : { ok: false, alasan: "sudah_diabaikan" };
  } catch {
    return { ok: false, alasan: "gagal" };
  }
}
