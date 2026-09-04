import { WORK_BRANDS } from "@/lib/constants";

/**
 * Membaca permintaan design menjadi angka Jumlah Konten.
 *
 * Diminta: permintaan design berkategori Instagram Post / Story / Reels ikut
 * terhitung sendiri sebagai capaian Content Creator dan Sosial Media, dan
 * brand-nya ditentukan dari cabang yang meminta.
 *
 * DUA HAL YANG MEMBUAT INI TIDAK SESEDERHANA MENCOCOKKAN TEKS.
 *
 * 1. Kolom jenis design DIKETIK BEBAS. Dari 192 permintaan yang ada, sebagian
 *    besar memang "Instagram Post" dan "Instagram Story", tapi ada puluhan
 *    variasi: "Feeds & IGS", "igs", "FEED DAN IGS", "Instagram Post dan
 *    Story". Mencocokkan persis akan membuang lebih dari seperempat datanya.
 *    Maka yang dicari KATA KUNCINYA, bukan seluruh kalimatnya.
 *
 * 2. Satu permintaan bisa berisi lebih dari satu jenis. "Instagram Post dan
 *    Story" memang menghasilkan dua materi, dan menghitungnya satu berarti
 *    separuh pekerjaannya hilang. Jadi satu permintaan boleh menambah angka di
 *    lebih dari satu indikator — sesuai apa yang benar-benar dikerjakan.
 */

export type JenisKonten = "post" | "reels" | "story";

/**
 * Kata kunci per jenis, diperiksa pada teks yang sudah dikecilkan hurufnya.
 *
 * "feed" masuk ke post karena di lapangan keduanya sama: satu unggahan di
 * lini masa. "igs" masuk ke story karena itu singkatan yang dipakai sehari-hari
 * (Instagram Story).
 */
const KATA: Record<JenisKonten, string[]> = {
  post: ["instagram post", "ig post", "feed", "feeds"],
  reels: ["reels", "reel"],
  story: ["story", "stories", "igs"],
};

/** Jenis konten yang terkandung dalam satu teks jenis design. */
export function jenisKonten(teks: string): JenisKonten[] {
  const t = (teks || "").toLowerCase();
  return (Object.keys(KATA) as JenisKonten[]).filter((j) => KATA[j].some((k) => t.includes(k)));
}

/**
 * Brand dari nama cabang.
 *
 * Cabangnya bernama "Nordu Coffee Siantan", "Cattu A. Yani", "Ayam Goreng
 * Busari Serdam", "Lesung Pipi Bogor" — nama brand-nya selalu ada di depan.
 * Dicocokkan dengan daftar brand yang sudah dipakai Work Tracker supaya
 * keduanya tidak pernah berbeda.
 */
export function brandOutlet(namaOutlet: string | null | undefined): string | null {
  const n = (namaOutlet || "").toLowerCase();
  if (!n) return null;
  // "Busari" harus diperiksa sebelum "Ayam Goreng Busari" tercocokkan sebagian;
  // daftar brand-nya sendiri sudah memakai kata yang membedakan.
  return WORK_BRANDS.find((b) => n.includes(b.toLowerCase())) ?? null;
}

export interface PermintaanKonten {
  designType: string | null;
  outletNama: string | null;
  status: string;
  periode: string;
}

/**
 * Menghitung konten selesai per jenis dan per brand pada satu bulan.
 *
 * HANYA YANG SUDAH SELESAI. Diminta tegas: "data ini diambil hanya dari antrian
 * design yang memang sudah diselesaikan". Permintaan yang masih dikerjakan
 * belum menghasilkan konten apa pun, dan menghitungnya berarti capaian bulan
 * ini meminjam pekerjaan bulan depan.
 */
export function hitungKonten(
  rows: PermintaanKonten[],
  periode: string,
): Record<JenisKonten, Record<string, number>> {
  const kosong = () => Object.fromEntries(WORK_BRANDS.map((b) => [b, 0])) as Record<string, number>;
  const hasil: Record<JenisKonten, Record<string, number>> = { post: kosong(), reels: kosong(), story: kosong() };

  for (const r of rows) {
    if (r.status !== "terlaksana" || r.periode !== periode) continue;
    const brand = brandOutlet(r.outletNama);
    if (!brand) continue; // permintaan kantor tanpa cabang tidak punya brand
    for (const j of jenisKonten(r.designType ?? "")) hasil[j][brand] += 1;
  }
  return hasil;
}

/** Kunci indikator jumlah konten → jenis kontennya. */
export const INDIKATOR_KONTEN: Record<string, JenisKonten> = {
  konten_post: "post",
  konten_reels: "reels",
  konten_story: "story",
};
