import { bulanIniWib } from "./waktu";

/**
 * PERIODE MANA YANG DIGENERATE, DAN KAPAN SEBUAH PERIODE SELESAI.
 *
 * Dua pertanyaan yang sebelumnya tidak dijawab di mana pun. `hitungSales()` dan
 * `hitungKeuangan()` sama-sama menerima `periodeSelesai` sebagai MASUKAN —
 * keduanya tidak pernah memutuskannya sendiri, dan sampai TASK #85 tidak ada
 * satu pun pemanggil di aplikasi yang mengisinya.
 *
 * Aturannya, sependek mungkin:
 *
 *   digenerate   →  bulan berjalan saja
 *   selesai      →  begitu bulan kalendernya habis
 *
 * Keduanya MURNI dan memakai WIB. Tidak ada yang menyentuh basis data di sini;
 * daftar periode yang benar-benar punya baris untuk difinalisasi datang dari
 * `src/lib/data/kpi-finalisasi.ts`.
 */

/** Bulan kalender yang sedang berjalan menurut WIB, "YYYY-MM". */
export function periodeBerjalan(pada: number = Date.now()): string {
  return bulanIniWib(pada);
}

/**
 * Bulan itu sudah berakhir?
 *
 * Aturannya satu kalimat: **sebuah bulan selesai begitu bulan kalendernya
 * habis.** Tidak ada masa tenggang.
 *
 *   2026-09 pada 2026-09-30 WIB  →  belum selesai
 *   2026-09 pada 2026-10-01 WIB  →  SELESAI
 *
 * ┌─ INI MENGGANTI ATURAN TANGGAL 15 DI AD-10 ──────────────────────────────┐
 * │                                                                          │
 * │ TASK #85 sempat memakai "bulan lalu, tanggal > 15" — meminjam            │
 * │ `TANGGAL_TUTUP_KPI` yang dipakai KPI Coordinator Area untuk memilih      │
 * │ bulan mana yang DIBUKA di layar. Keputusan pemiliknya di TASK #85A:      │
 * │ finalitas periode KPI memakai berakhirnya bulan kalender, bukan tanggal  │
 * │ tutup penilaian.                                                         │
 * │                                                                          │
 * │ Keduanya memang menjawab pertanyaan yang berbeda. Tanggal 15 menjawab    │
 * │ "bulan mana yang sedang dikerjakan orang"; yang di sini menjawab "bulan  │
 * │ mana yang angkanya tidak akan berubah lagi". `periodeSekarang()` di      │
 * │ `src/lib/data/kpi.ts` tetap memakai tanggal 15 dan TIDAK disentuh.       │
 * │                                                                          │
 * │ Perubahannya aman diperiksa: satu-satunya pemakai `periodeSelesai()`     │
 * │ adalah generator, dan generator hanya menyentuh bulan berjalan — yang    │
 * │ selalu mengembalikan `false` pada kedua aturan. Jadi angka yang sudah    │
 * │ tertulis tidak berubah artinya.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ JANGAN DISATUKAN DENGAN `TANGGAL_BATAS_BUKA` ───────────────────────────┐
 * │ `TANGGAL_BATAS_BUKA` di `target-sales.ts` soal TANGGAL BUKA OUTLET:      │
 * │ outlet yang buka tanggal 31 tidak dihitung berjalan sebulan penuh. Ia    │
 * │ bukan tanggal tutup buku, tidak pernah, dan tidak boleh dipinjam jadi    │
 * │ aturan finalisasi.                                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * WIB, bukan UTC. 1 Oktober pukul 00.30 WIB masih 30 September menurut UTC,
 * dan finalisasi yang memakai UTC akan terlambat tujuh jam — atau, di ujung
 * yang lain, menutup bulan yang belum habis.
 */
export function periodeSelesai(periode: string, pada: number = Date.now()): boolean {
  return periode < periodeBerjalan(pada);
}

/**
 * Periode yang ditulis ulang tiap kali penjadwal berjalan.
 *
 * HANYA BULAN BERJALAN, dan itu keputusan sadar pemiliknya untuk TASK #85.
 *
 * Bulan lalu sengaja TIDAK ikut. Agustus 2026 sudah punya 826 baris hasil
 * TASK #86 yang berstatus final, dan menariknya kembali ke dalam jalur tulis
 * berulang berarti membandingkan — lalu mungkin memversikan ulang — data yang
 * sudah ditutup. Kalau suatu hari bulan lalu memang perlu ikut, aturannya
 * sudah ada di `periodeSelesai()` di atas; yang perlu diubah cuma daftar ini,
 * dan itu keputusan tersendiri, bukan efek samping.
 *
 * Periode historis tidak pernah masuk daftar ini. Backfill adalah pekerjaan
 * sekali jalan yang punya gerbang sendiri (lihat TASK #86), bukan sesuatu yang
 * boleh terjadi diam-diam karena sebuah cron kebetulan berangkat.
 */
export function periodeGenerasi(pada: number = Date.now()): string[] {
  return [periodeBerjalan(pada)];
}
