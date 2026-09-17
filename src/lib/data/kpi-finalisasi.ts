import "server-only";

import { db, dbEnabled } from "./db";
import { periodeBerjalan } from "@/lib/ops/finalisasi";

/**
 * MENUTUP PERIODE YANG BULANNYA SUDAH HABIS.
 *
 * Satu kalimat yang menentukan seluruh isi berkas ini:
 *
 *   FINALISASI ADALAH PERPINDAHAN KEADAAN, BUKAN PERHITUNGAN ULANG.
 *
 * Karena itu di sini TIDAK ADA `hitungSales()`, `hitungKeuangan()`, maupun
 * `hitungTargetSales()`. Tidak ada `seasonal_daily` yang dibaca, tidak ada
 * `op_expenses` yang dijumlah, tidak ada satu pun panggilan ESB. Angkanya sudah
 * ada di `kpi_values` sejak generator menuliskannya; yang belum ada cuma
 * pernyataan bahwa bulannya sudah ditutup.
 *
 * Menghitung ulang pada saat menutup terdengar lebih aman, dan justru
 * sebaliknya: angka yang sudah dibaca orang sepanjang bulan bisa berubah di
 * detik terakhir karena sebuah baris sumber datang terlambat — dan perubahan
 * itu tidak akan pernah kelihatan, sebab ia terjadi bersamaan dengan perubahan
 * status yang memang diharapkan.
 *
 * Seluruh penulisannya ada di `gwg_finalisasi_kpi_bulanan` (migrasi 0108): satu
 * transaksi, kunci per periode yang sama dengan milik generator, dan hanya
 * `status` yang berubah.
 */

export interface RingkasFinalisasi {
  /** Bulan berjalan menurut WIB — dihitung di sini, bukan di basis data. */
  bulanBerjalan: string;
  /** Periode yang punya baris `sementara` terkini, apa pun umurnya. */
  periodeDiperiksa: string[];
  /** Yang bulannya memang sudah habis, dan karenanya ditutup. */
  periodeDifinalisasi: string[];
  barisDiubah: number;
  ms: number;
}

interface BalasanRpc {
  bulan_berjalan: string;
  periode_diperiksa: string[] | null;
  periode_difinalisasi: string[] | null;
  baris_diubah: number;
}

/**
 * Tutup seluruh periode yang sudah berakhir dan masih menyisakan `sementara`.
 *
 * Bulan berjalan disuntikkan dari sini, bukan dihitung basis data: Postgres
 * berjalan di UTC, dan pada 1 Oktober pukul 00.30 WIB ia masih menyebut
 * bulannya September. Tujuh jam salah, sebulan sekali, tanpa satu pun pesan.
 */
export async function finalisasiPeriodeSelesai(pada: number = Date.now()): Promise<RingkasFinalisasi> {
  if (!dbEnabled) throw new Error("basis data tidak aktif");
  const mulai = Date.now();
  const bulan = periodeBerjalan(pada);

  const { data, error } = await db().rpc("gwg_finalisasi_kpi_bulanan", { p_bulan_berjalan: bulan });
  if (error) throw new Error(`gwg_finalisasi_kpi_bulanan: ${error.message}`);

  const r = data as BalasanRpc;
  return {
    bulanBerjalan: r.bulan_berjalan,
    periodeDiperiksa: r.periode_diperiksa ?? [],
    periodeDifinalisasi: r.periode_difinalisasi ?? [],
    barisDiubah: r.baris_diubah,
    ms: Date.now() - mulai,
  };
}
