import { RINCI_UTILITAS, type RinciUtilitas } from "./categories";

/**
 * UTILITAS: SATU ANGKA, DUA ASAL — dan yang menentukan selalu rinciannya.
 *
 * Sampai Phase 2B, `op_expenses.utilitas` adalah satu angka gabungan yang
 * diketik tangan: listrik, air, internet, dan kebersihan menyatu tanpa bisa
 * dipisahkan lagi. 128 baris historis berisi Rp 1.390.752.683 dalam bentuk itu,
 * dan tidak ada satu pun sumber yang bisa memecahnya kembali.
 *
 * Mulai V.1, keempatnya diisi terpisah dan `utilitas` menjadi JUMLAHNYA.
 *
 * ┌─ KENAPA DITURUNKAN, BUKAN DIKETIK KEDUA KALINYA ─────────────────────────┐
 * │                                                                          │
 * │ Aturan yang sama sudah berlaku untuk `op_pnl.beban`: tidak diminta di    │
 * │ template, dijumlahkan dari rinciannya. Alasannya ditulis di              │
 * │ `template-unggah.ts` dan berlaku persis sama di sini — satu angka yang   │
 * │ bisa diketik berbeda dari rinciannya adalah satu angka yang cepat atau   │
 * │ lambat akan berbeda, dan yang membacanya tidak punya cara tahu mana yang │
 * │ benar.                                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG PALING BERBAHAYA DI SELURUH BERKAS INI ────────────────────────────┐
 * │                                                                          │
 * │ Kolom "Utilitas" TETAP ADA di template, demi berkas lama yang sudah      │
 * │ beredar. Jadi ada dua kolom yang sama-sama bisa terisi.                  │
 * │                                                                          │
 * │ Kalau keduanya dijumlahkan, biaya listrik dihitung dua kali. Kalau       │
 * │ keduanya kosong lalu ditulis nol, Rp 1,39 miliar biaya utilitas hilang   │
 * │ dari laba rugi tanpa satu pun pesan. Keduanya menghasilkan angka yang    │
 * │ tetap terlihat wajar di layar.                                           │
 * │                                                                          │
 * │ Maka aturannya ditulis SEKALI, di sini, dan dijaga uji.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MURNI — tanpa basis data, tanpa Excel, tanpa `server-only`.
 */

/** Dari mana angka `utilitas` sebuah baris berasal — ikut dilaporkan, tidak ditebak. */
export type AsalUtilitas =
  /** Dijumlahkan dari empat kolom rincian. Inilah jalur V.1. */
  | "rincian"
  /** Kolom "Utilitas" yang diketik — berkas lama yang belum punya rincian. */
  | "agregat"
  /** Tidak ada satu pun yang terisi: angka yang SUDAH tersimpan dipertahankan. */
  | "dipertahankan";

export interface HasilUtilitas {
  /** Yang ditulis ke `op_expenses.utilitas`. Tidak pernah null — kolomnya NOT NULL. */
  utilitas: number;
  asal: AsalUtilitas;
  /** Rincian yang ditulis ke empat kolom baru. Null tetap null. */
  rincian: Record<RinciUtilitas, number | null>;
}

export interface MasukanUtilitas {
  /** Empat kolom rincian dari berkas. Null = tidak diisi. */
  rincian: Partial<Record<RinciUtilitas, number | null>>;
  /** Kolom "Utilitas" dari berkas, kalau memang ada isinya. */
  agregat?: number | null;
  /**
   * Angka yang SUDAH tersimpan untuk outlet-bulan ini.
   *
   * Dipakai hanya bila berkasnya tidak menyebut utilitas sama sekali. Tanpa
   * ini, mengunggah berkas yang kolom utilitasnya kebetulan tidak ikut terbawa
   * akan menghapus angka yang sudah benar — persis masalah yang sama sudah
   * ditangani untuk `pendapatan` di `unggah-data.ts`.
   */
  tersimpan?: number | null;
}

/**
 * Tentukan `utilitas` sebuah baris unggahan.
 *
 * URUTANNYA MENGIKAT, dan urutan itulah aturannya:
 *
 *   1. ada rincian  → jumlah rinciannya. Kolom "Utilitas" yang diketik
 *      DIABAIKAN — rincian adalah sumbernya, agregat cuma turunan.
 *   2. tidak ada rincian, ada agregat → agregatnya. Berkas lama tetap bisa
 *      diunggah tanpa harus dirinci lebih dulu.
 *   3. tidak ada dua-duanya → angka yang sudah tersimpan, apa adanya.
 *
 * NOL BUKAN KOSONG. Outlet yang benar-benar menulis 0 pada listrik dianggap
 * sudah merinci; yang mengosongkannya belum. `0` lolos aturan 1, `null` tidak.
 */
export function utilitasBaris(m: MasukanUtilitas): HasilUtilitas {
  const rincian = Object.fromEntries(RINCI_UTILITAS.map((k) => [k, m.rincian[k] ?? null])) as Record<
    RinciUtilitas,
    number | null
  >;
  const terisi = RINCI_UTILITAS.map((k) => rincian[k]).filter((v): v is number => v !== null);

  if (terisi.length > 0) {
    return { utilitas: terisi.reduce((a, b) => a + b, 0), asal: "rincian", rincian };
  }
  if (m.agregat !== null && m.agregat !== undefined) {
    return { utilitas: m.agregat, asal: "agregat", rincian };
  }
  // TIDAK PERNAH nol di sini. Nol berarti "outlet ini tidak memakai listrik
  // bulan itu", dan tidak ada satu berkas pun yang pernah menyatakan itu.
  return { utilitas: m.tersimpan ?? 0, asal: "dipertahankan", rincian };
}

/**
 * Baris ini sudah dirinci?
 *
 * Dipakai melaporkan berapa outlet yang sudah memakai jalur V.1 dan berapa yang
 * masih mengirim angka gabungan — supaya perpindahannya bisa dilihat, bukan
 * ditunggu tanpa kabar.
 */
export const sudahDirinci = (r: Partial<Record<RinciUtilitas, number | null>>): boolean =>
  RINCI_UTILITAS.some((k) => r[k] !== null && r[k] !== undefined);
