/**
 * WAKTU BISNIS OPERATIONAL V.1 — selalu WIB, tidak pernah zona peramban.
 *
 * Seluruh angka operasional GWG terikat pada hari kalender Jakarta: satu hari
 * penjualan berakhir tengah malam WIB, bukan tengah malam di tempat yang
 * kebetulan membuka halamannya. Kalau tanggal bisnis diambil dari zona
 * peramban, dua orang yang membuka layar yang sama pada detik yang sama akan
 * melihat dua hari yang berbeda — dan yang salah tidak akan pernah tahu, karena
 * angkanya tetap masuk akal.
 *
 * Pergeseran +7 jam yang sama sudah dipakai belasan tempat di aplikasi ini,
 * masing-masing menulis ulang `Date.now() + 7 * 3_600_000` sendiri:
 * `src/app/(app)/operational/daily/page.tsx`, `src/lib/data/daily-outlet.ts`,
 * `src/lib/data/kelengkapan-daily.ts`, `src/app/api/cron/fraud-sync/route.ts`,
 * `src/components/operation/halaman-performa.tsx`, dan lainnya. Rumus yang
 * disalin belasan kali adalah rumus yang cepat atau lambat salah di salah satu
 * salinannya.
 *
 * BERKAS INI TIDAK MENYENTUH YANG SUDAH ADA. Ia pintu masuk untuk V.1 saja —
 * merapikan belasan salinan itu berarti menyentuh Daily dan cron yang sedang
 * melayani produksi, dan itu bukan pekerjaan fondasi. Yang dijaga di sini:
 * kode V.1 yang ditulis kemudian tidak menambah salinan ke-dua-belas.
 *
 * MURNI — tanpa basis data, tanpa `server-only`. Bisa diuji, dan bisa dipakai
 * komponen mana pun.
 */

/** Selisih WIB terhadap UTC dalam milidetik. WIB tidak mengenal DST. */
export const OFFSET_WIB_MS = 7 * 3_600_000;

/**
 * Sekarang, digeser ke WIB.
 *
 * Yang dikembalikan `Date` yang bagian UTC-nya sudah berisi jam Jakarta — jadi
 * `getUTCDate()` memberi tanggal WIB. Bukan cara yang paling elegan, tapi cara
 * yang sudah dipakai seluruh aplikasi ini, dan menyeragamkannya lebih berharga
 * daripada memperkenalkan cara kedua yang lebih rapi.
 *
 * `pada` bisa diisi untuk pengujian; tanpa itu memakai jam mesin.
 */
export function kiniWib(pada: number = Date.now()): Date {
  return new Date(pada + OFFSET_WIB_MS);
}

/** Tanggal bisnis hari ini, "YYYY-MM-DD" menurut WIB. */
export function hariIniWib(pada: number = Date.now()): string {
  return kiniWib(pada).toISOString().slice(0, 10);
}

/** Bulan bisnis berjalan, "YYYY-MM" menurut WIB. */
export function bulanIniWib(pada: number = Date.now()): string {
  return kiniWib(pada).toISOString().slice(0, 7);
}

/** Tahun bisnis berjalan, "YYYY" menurut WIB. */
export function tahunIniWib(pada: number = Date.now()): string {
  return String(kiniWib(pada).getUTCFullYear());
}

/* ────────────────────────────── bentuk ────────────────────────────── */

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_BULAN = /^\d{4}-\d{2}$/;
const POLA_TAHUN = /^\d{4}$/;

export const tanggalSah = (s: string): boolean => POLA_TANGGAL.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const bulanSah = (s: string): boolean => POLA_BULAN.test(s) && Number(s.slice(5, 7)) >= 1 && Number(s.slice(5, 7)) <= 12;
export const tahunSah = (s: string): boolean => POLA_TAHUN.test(s);

/* ───────────────────────────── periode ───────────────────────────── */

/**
 * Jumlah hari sebuah bulan.
 *
 * Sengaja MEMANGGIL `jumlahHari` dari `./harian`, bukan menghitung ulang.
 * Rumus jumlah hari yang ditulis dua kali adalah rumus yang berbeda di bulan
 * Februari tahun kabisat, dan itu satu-satunya bulan yang tidak pernah
 * diperiksa siapa pun.
 */
export { jumlahHari } from "./harian";

/** Tanggal pertama sebuah bulan, "YYYY-MM-01". */
export const awalBulan = (periode: string): string => `${periode}-01`;

/** Tanggal terakhir sebuah bulan. */
export function akhirBulan(periode: string): string {
  const [th, bl] = periode.split("-").map(Number);
  const hari = new Date(Date.UTC(th, bl, 0)).getUTCDate();
  return `${periode}-${String(hari).padStart(2, "0")}`;
}

/**
 * Berapa hari dari `periode` yang SUDAH LEWAT menurut WIB.
 *
 * Bulan yang sudah selesai: seluruh harinya. Bulan yang belum datang: nol.
 * Bulan berjalan: sampai tanggal hari ini.
 *
 * Perlu dibedakan dari "berapa hari yang datanya sudah ada" — yang pertama soal
 * kalender, yang kedua soal kelengkapan (`./kelengkapan`). Menyamakan keduanya
 * membuat hari yang belum ditarik terhitung sebagai hari tanpa jualan.
 */
export function hariBerjalan(periode: string, pada: number = Date.now()): number {
  const kini = kiniWib(pada);
  const sekarang = kini.toISOString().slice(0, 7);
  if (periode < sekarang) return akhirBulanHari(periode);
  if (periode > sekarang) return 0;
  return kini.getUTCDate();
}

function akhirBulanHari(periode: string): number {
  const [th, bl] = periode.split("-").map(Number);
  return new Date(Date.UTC(th, bl, 0)).getUTCDate();
}

/** Bulan sebelum `periode` ("2026-01" → "2025-12"). */
export function bulanSebelum(periode: string): string {
  const [th, bl] = periode.split("-").map(Number);
  return bl === 1 ? `${th - 1}-12` : `${th}-${String(bl - 1).padStart(2, "0")}`;
}

/** Bulan sesudah `periode` ("2025-12" → "2026-01"). */
export function bulanSesudah(periode: string): string {
  const [th, bl] = periode.split("-").map(Number);
  return bl === 12 ? `${th + 1}-01` : `${th}-${String(bl + 1).padStart(2, "0")}`;
}

/** Geser tanggal sekian hari. Aman terhadap pergantian bulan dan tahun. */
export function geserHari(tanggal: string, hari: number): string {
  return new Date(Date.parse(`${tanggal}T00:00:00Z`) + hari * 86_400_000).toISOString().slice(0, 10);
}

/** Selisih hari antara dua tanggal (b − a). */
export function selisihHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Bulan sebuah tanggal ("2026-09-16" → "2026-09"). */
export const bulanDari = (tanggal: string): string => tanggal.slice(0, 7);

/**
 * Apakah tanggal ini sudah lewat menurut WIB.
 *
 * Hari ini BELUM lewat — jualannya masih berjalan. Dipakai memutuskan hari mana
 * yang angkanya boleh dianggap final.
 */
export const sudahLewat = (tanggal: string, pada: number = Date.now()): boolean => tanggal < hariIniWib(pada);
