import { bulanSah, bulanSebelum, bulanSesudah } from "./waktu";
import { periodeBerjalan } from "./finalisasi";

/**
 * PERIODE MANA YANG HARUS DIDETEKSI, DAN APA YANG MENJAMIN TIDAK ADA YANG
 * TERLEWAT.
 *
 * ┌─ LUBANG YANG DITUTUP BERKAS INI ─────────────────────────────────────────┐
 * │                                                                          │
 * │ Sebelumnya himpunan periodenya adalah "bulan berjalan + periode yang     │
 * │ baru ditutup pada jalan ini". Asumsinya: periode lama Signal-nya sudah   │
 * │ tercatat. Asumsi itu benar untuk setiap jalan KECUALI YANG PERTAMA —     │
 * │ dan pada jalan pertama Agustus 2026 sudah lama `final`, jadi ia tidak    │
 * │ pernah masuk lewat pintu mana pun. 180 pelanggaran senyap.               │
 * │                                                                          │
 * │ Lubang yang sama terbuka lagi setiap kali aturan baru lahir untuk bulan  │
 * │ yang sudah ditutup.                                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ KENAPA PENANDANYA HARUS EKSPLISIT ──────────────────────────────────────┐
 * │                                                                          │
 * │ "Sudah pernah dideteksi" TIDAK BISA disimpulkan dari ada-tidaknya        │
 * │ Signal. Periode yang memang nol pelanggaran sah-sah saja tidak punya     │
 * │ satu baris pun — dan ia tidak bisa dibedakan dari periode yang belum     │
 * │ pernah diperiksa sama sekali. Menebaknya dari jejak yang kebetulan ada   │
 * │ adalah persis kesalahan yang melahirkan lubang Agustus.                  │
 * │                                                                          │
 * │ Karena itu: satu penanda yang menyatakan sampai bulan mana deteksi       │
 * │ pernah tuntas, dan ia hanya maju setelah deteksinya benar-benar          │
 * │ berhasil.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MURNI — tanpa basis data. Seluruh masukannya disuntikkan pemanggil.
 */

/** Kunci `app_config`. Satu aliran deteksi bulanan; tidak ada yang lain hari ini. */
export const KUNCI_WATERMARK = "signal_watermark_bulanan";

/**
 * Batas periode susulan per jalan.
 *
 * Bukan pemangkas kebenaran melainkan pemangkas waktu: rute cron punya 60
 * detik, dan bootstrap yang menemukan dua tahun tunggakan tidak boleh
 * menghabiskannya sekaligus lalu gagal seluruhnya. Sisanya menyusul pada jalan
 * berikutnya, dan watermark memastikan tidak ada yang terlewat di antaranya.
 */
export const BATAS_SUSULAN = 12;

/**
 * Periode historis yang boleh diperbaiki lewat pintu remediasi.
 *
 * DAFTAR PUTIH, bukan pemeriksaan bentuk. Sebuah parameter `periode` yang
 * menerima bulan apa pun asalkan formatnya benar berarti siapa pun yang
 * memegang token cron bisa menyuruh sistem menilai ulang bulan mana saja —
 * dan itu pintu yang tidak pernah diminta siapa pun.
 *
 * Agustus 2026 ada di sini karena satu alasan yang sudah tercatat: ia sudah
 * `final` sebelum Phase 4 pertama kali berjalan (AD-15). Begitu ia terdeteksi,
 * barisnya boleh dikosongkan lagi.
 */
export const REMEDIASI_DIIZINKAN: readonly string[] = ["2026-08"];

export interface RencanaDeteksi {
  /** Periode SELESAI yang belum pernah dideteksi, berurutan dari yang tertua. */
  susulan: string[];
  /** Bulan berjalan — selalu dideteksi, apa pun isi watermark. */
  berjalan: string;
  /** Seluruh periode yang akan dinilai pada jalan ini. */
  seluruh: string[];
  /** Tunggakannya lebih panjang dari {@link BATAS_SUSULAN} dan dipotong. */
  dipotong: boolean;
}

/**
 * Menyusun rencana deteksi satu jalan.
 *
 * ┌─ BULAN BERJALAN TIDAK PERNAH MENGGESER WATERMARK ────────────────────────┐
 * │                                                                          │
 * │ Angkanya masih berubah tiap hari, jadi ia belum "tuntas" dalam arti apa  │
 * │ pun. Kalau watermark ikut maju ke bulan berjalan, esok hari tunggakannya │
 * │ kosong dan bulan itu tidak akan pernah dinilai ulang — Signal berhenti   │
 * │ mengikuti angkanya sendiri.                                              │
 * │                                                                          │
 * │ Jadi: watermark hanya melangkahi bulan yang kalendernya sudah habis;     │
 * │ bulan berjalan ikut tiap jalan, di luar watermark.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * @param watermark   bulan terakhir yang deteksinya sudah tuntas, atau null
 *                    kalau belum pernah ada
 * @param palingAwal  periode KPI paling awal yang ada di basis data — dipakai
 *                    HANYA saat bootstrap, dan sengaja diturunkan dari data,
 *                    bukan ditulis sebagai bulan tertentu di dalam kode
 */
export function rencanaDeteksi(watermark: string | null, palingAwal: string | null, pada: number = Date.now()): RencanaDeteksi {
  const berjalan = periodeBerjalan(pada);
  const kosong: RencanaDeteksi = { susulan: [], berjalan, seluruh: [berjalan], dipotong: false };

  if (watermark !== null && !bulanSah(watermark)) throw new Error(`watermark tidak sah: ${watermark}`);
  if (palingAwal !== null && !bulanSah(palingAwal)) throw new Error(`periode paling awal tidak sah: ${palingAwal}`);

  // Belum ada KPI sama sekali: tidak ada yang bisa dinilai selain bulan berjalan.
  if (palingAwal === null) return kosong;

  const terakhirSelesai = bulanSebelum(berjalan);
  const mulai = watermark === null ? palingAwal : bulanSesudah(watermark);
  if (mulai > terakhirSelesai) return kosong;

  const susulan: string[] = [];
  let p = mulai;
  while (p <= terakhirSelesai && susulan.length < BATAS_SUSULAN) {
    susulan.push(p);
    p = bulanSesudah(p);
  }
  const dipotong = p <= terakhirSelesai;

  return { susulan, berjalan, seluruh: [...susulan, berjalan], dipotong };
}

/** Periode ini boleh diperbaiki lewat pintu remediasi? */
export function bolehDiremediasi(periode: string): boolean {
  return bulanSah(periode) && REMEDIASI_DIIZINKAN.includes(periode);
}
