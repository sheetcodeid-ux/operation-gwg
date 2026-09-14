import "server-only";

import { lubangSeasonal, tarikPasangan, KONKUREN_AWAL, type TugasTarik } from "./seasonal";
import { kelengkapanDaily, cabangDaily } from "./kelengkapan-daily";
import { ensureHydrated, hidrasiPernahBerhasil } from "./hydrate";
import { getAppConfig } from "./app-config";
import { jumlahHari } from "@/lib/ops/harian";

/**
 * SATU JENDELA PENGEJARAN LUBANG DAILY — dipakai tombol di layar MAUPUN cron.
 *
 * Dulu keduanya punya perulangannya sendiri: cron memutari daftar cabang ESB
 * dengan kursor tersimpan, tombol memutari hal yang sama dengan salinan kode
 * yang mirip tapi tidak sama. Dua salinan berarti dua perilaku — dan yang satu
 * ikut menarik tiga cabang yang tidak dipakai Daily sama sekali.
 *
 * Yang dikerjakan di sini satu kalimat: cari pasangan cabang×tanggal yang masih
 * kurang, mulai dari BULAN YANG PALING BERLUBANG, lalu tarik sebanyak yang muat
 * dalam anggaran waktu.
 *
 * Kenapa bulan terparah dulu, bukan kursor cabang seperti dulu: bulan berjalan
 * hampir selalu paling penuh karena tiap jalan cron menyentuhnya, sedangkan
 * Januari–Juni tidak pernah kebagian. Mengurut dari yang paling berlubang
 * membuat layar Daily membaik paling cepat justru di tempat yang angkanya
 * paling salah. Dan tidak ada kursor yang perlu disimpan: lubangnya sendiri
 * yang jadi penunjuk tempat, jadi dua jalan yang tumpang tindih tidak bisa
 * saling melewatkan bagian.
 */

export interface HasilKejarLubang {
  /** Baris yang benar-benar masuk basis data. */
  terisi: number;
  /** Panggilan ESB yang gagal — harinya tetap kosong dan akan dicoba lagi. */
  gagal: number;
  /** Berapa cabang yang tersentuh. */
  cabang: number;
  /** Panggilan berbarengan yang bertahan di akhir; turun kalau ESB mengerem. */
  konkuren: number;
  /** Yang dipakai saat mulai — pembandingnya. */
  konkurenAwal: number;
  /** Berapa kali ESB dipanggil, berhasil maupun tidak. */
  panggilan: number;
  /** Berapa kali harus menunggu rem ESB lepas. */
  jeda: number;
  error?: string;
}

/**
 * Berapa panggilan berbarengan yang dipakai — BISA DIUBAH TANPA DEPLOY lewat
 * `app_config.seasonal_konkuren`.
 *
 * Bukan kemalasan. Rem ESB tidak didokumentasikan di mana pun dan bentuknya
 * cuma bisa dibaca dari catatan penarikan sungguhan: setiap percobaan angka
 * baru butuh satu jendela penuh untuk dinilai. Kalau angkanya terkunci di kode,
 * tiap percobaan berarti satu deploy.
 */
async function konkurenTersetel(bawaan: number): Promise<number> {
  const v = Number(await getAppConfig("seasonal_konkuren"));
  return Number.isFinite(v) && v >= 1 ? v : bawaan;
}

/** Sebanyak apa daftar kerja disiapkan satu jalan. Lebih dari yang muat dipakai
 *  sia-sia dibaca, jadi angkanya dipatok di atas kemampuan satu jendela. */
const MAKS_TUGAS = 900;

const ymdWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

export async function kejarLubangDaily(budgetMs: number, konkuren = KONKUREN_AWAL): Promise<HasilKejarLubang> {
  // DAFTAR OUTLET HARUS DIMUAT DULU, dan di sini tempatnya.
  //
  // Lewat layar, hidrasi sudah terjadi sebelum halamannya dirender — sesi yang
  // masuk memicunya. Lewat cron TIDAK ADA yang memicunya: rutenya tidak membaca
  // sesi siapa pun. Tanpa baris ini `getOutlets()` memulangkan data contoh,
  // yang satu pun tidak punya ID cabang ESB, dan penarikannya pulang dengan
  // "tidak ada outlet ber-ID cabang ESB" tiap sepuluh menit — persis yang
  // terjadi pada dua jalan pertama sesudah ini tayang.
  //
  // Penarik yang lama kebal karena daftar cabangnya diminta ke ESB, bukan dari
  // outlet sendiri. Begitu sumbernya pindah ke outlet, ketergantungan ini ikut
  // pindah — dan diam-diam, karena di layar semuanya tetap benar.
  await ensureHydrated();
  if (!hidrasiPernahBerhasil()) {
    // Data contoh punya outlet juga. Menariknya berarti mengisi Daily dengan
    // cabang yang tidak ada — lebih buruk daripada tidak menarik sama sekali.
    return { terisi: 0, gagal: 0, cabang: 0, konkuren: 0, konkurenAwal: 0, panggilan: 0, jeda: 0, error: "Data outlet belum termuat dari basis data." };
  }
  const cabang = cabangDaily();
  if (cabang.length === 0) return { terisi: 0, gagal: 0, cabang: 0, konkuren: 0, konkurenAwal: 0, panggilan: 0, jeda: 0, error: "Tidak ada outlet ber-ID cabang ESB." };

  const mulai = Date.now();
  const awal = await kelengkapanDaily();
  const hariIni = ymdWib();
  const tugas: TugasTarik[] = [];
  for (const b of awal.bulan) {
    if (tugas.length >= MAKS_TUGAS) break;
    const akhirBulan = `${b.periode}-${String(jumlahHari(b.periode)).padStart(2, "0")}`;
    tugas.push(...(await lubangSeasonal(`${b.periode}-01`, akhirBulan < hariIni ? akhirBulan : hariIni, cabang)));
  }
  if (tugas.length === 0) return { terisi: 0, gagal: 0, cabang: 0, konkuren: 0, konkurenAwal: 0, panggilan: 0, jeda: 0 };

  const potong = tugas.slice(0, MAKS_TUGAS);
  const sisaWaktu = budgetMs - (Date.now() - mulai);
  const r = await tarikPasangan(potong, { budgetMs: Math.max(4_000, sisaWaktu), konkuren: await konkurenTersetel(konkuren) });
  return {
    terisi: r.terisi,
    gagal: r.gagal,
    cabang: new Set(potong.map((t) => t.branch)).size,
    konkuren: r.konkuren,
    konkurenAwal: r.konkurenAwal,
    panggilan: r.panggilan,
    jeda: r.jeda,
    error: r.error,
  };
}
