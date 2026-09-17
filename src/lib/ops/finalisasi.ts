import { bulanIniWib, bulanSebelum, kiniWib } from "./waktu";

/**
 * PERIODE MANA YANG DIGENERATE, DAN KAPAN SEBUAH PERIODE BOLEH DISEBUT FINAL.
 *
 * Dua pertanyaan yang sebelumnya tidak dijawab di mana pun. `hitungSales()` dan
 * `hitungKeuangan()` sama-sama menerima `periodeSelesai` sebagai MASUKAN —
 * keduanya tidak pernah memutuskannya sendiri, dan sampai TASK #85 tidak ada
 * satu pun pemanggil di aplikasi yang mengisinya. Satu-satunya tempat ia pernah
 * dihitung adalah skrip rekonsiliasi, dengan aturan "bulannya sudah berakhir" —
 * yang BUKAN aturan tutup buku perusahaan ini.
 *
 * ┌─ TANGGAL TUTUPNYA SUDAH ADA, JANGAN BIKIN YANG KEDUA ────────────────────┐
 * │                                                                          │
 * │ `TANGGAL_TUTUP_KPI = 15` sudah berlaku di produksi lewat                 │
 * │ `periodeSekarang()` (`src/lib/data/kpi.ts`), dan sudah dijaga uji        │
 * │ `revisi-satuan.test.ts` baris per baris. Penilaian satu bulan baru       │
 * │ ditutup tanggal 15 bulan berikutnya.                                     │
 * │                                                                          │
 * │ Angkanya ditulis ulang di sini karena berkas ini MURNI — tanpa Supabase, │
 * │ tanpa `server-only` — sementara `data/kpi.ts` menempel pada keduanya.    │
 * │ Alasan yang sama dengan `TANGGAL_BATAS_BUKA` di `target-sales.ts`, dan   │
 * │ penjaganya sama: `finalisasi.test.ts` membaca kedua berkas dan gagal     │
 * │ begitu angkanya tidak lagi sepakat.                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ JANGAN DISATUKAN DENGAN `TANGGAL_BATAS_BUKA` ───────────────────────────┐
 * │                                                                          │
 * │ `TANGGAL_BATAS_BUKA` di `target-sales.ts` juga bernilai 15, dan itu      │
 * │ KEBETULAN. Yang itu soal TANGGAL BUKA OUTLET: outlet yang buka tanggal   │
 * │ 31 tidak boleh dihitung sudah berjalan sebulan penuh. Yang di sini soal  │
 * │ TUTUP BUKU: sampai tanggal berapa sebuah bulan masih boleh berubah       │
 * │ angkanya. Menyatukan keduanya berarti mengubah cara outlet baru dinilai  │
 * │ hanya karena jadwal tutup buku digeser — dan sebaliknya.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Tanggal penutupan penilaian tiap bulan.
 *
 * Kembar dengan `TANGGAL_TUTUP_KPI` di `src/lib/data/kpi.ts`, dijaga uji.
 */
export const TANGGAL_TUTUP = 15;

/** Bulan kalender yang sedang berjalan menurut WIB, "YYYY-MM". */
export function periodeBerjalan(pada: number = Date.now()): string {
  return bulanIniWib(pada);
}

/**
 * Bulan itu sudah boleh disebut final?
 *
 * Aturannya:
 *
 *   bulan berjalan              → BELUM final, apa pun tanggalnya
 *   bulan lalu, tanggal ≤ 15    → BELUM final; angkanya masih dilengkapi
 *   bulan lalu, tanggal > 15    → final
 *   bulan yang lebih lama       → final
 *
 * Bulan berjalan tidak pernah final sekalipun tanggalnya sudah lewat 15:
 * harinya sendiri belum habis. Angka yang disebut final lalu berubah besok
 * adalah cara tercepat membuat laporan yang sudah dicetak jadi salah.
 */
export function periodeSelesai(periode: string, pada: number = Date.now()): boolean {
  const berjalan = periodeBerjalan(pada);
  if (periode >= berjalan) return false;
  if (periode < bulanSebelum(berjalan)) return true;
  return kiniWib(pada).getUTCDate() > TANGGAL_TUTUP;
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
