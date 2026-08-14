/**
 * Aturan hitung Kontrak Tracker (PKWT/PKWTT).
 *
 * Semua yang bisa dihitung sistem DIHITUNG sistem: durasi kontrak, sisa hari,
 * status, masa kerja, dan bulan keluar. Supervisor hanya mengisi fakta —
 * tanggal, nomor kontrak, jabatan — dan tidak pernah mengetik status.
 *
 * Alasannya bukan kerapian: status yang diketik manual akan basi diam-diam.
 * Kontrak yang ditandai "Aktif" bulan lalu tetap tertulis "Aktif" tiga bulan
 * setelah berakhir, dan tidak ada yang tahu sampai ada masalah. Dihitung dari
 * tanggal, statusnya selalu benar tanpa ada yang perlu memutakhirkannya.
 *
 * Berkas ini murni perhitungan — tanpa akses basis data — supaya bisa dipakai
 * di server maupun di peramban, dan bisa diuji tanpa menyiapkan apa pun.
 */

export type JenisKontrak = "PKWT" | "PKWTT";

export type StatusKontrak = "aktif" | "segera_berakhir" | "berakhir" | "belum_ada";

/** Ambang "segera berakhir" — 60 hari, cukup untuk menyiapkan perpanjangan. */
export const SEGERA_BERAKHIR_HARI = 60;

export const STATUS_KONTRAK_META: Record<
  StatusKontrak,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  aktif: { label: "Aktif", tone: "success" },
  segera_berakhir: { label: "Segera Berakhir", tone: "warning" },
  berakhir: { label: "Berakhir", tone: "danger" },
  belum_ada: { label: "Belum Ada Kontrak", tone: "neutral" },
};

export type PrioritasRenewal = "normal" | "penting" | "mendesak";

export const PRIORITAS_META: Record<PrioritasRenewal, { label: string; tone: "neutral" | "warning" | "danger" }> = {
  normal: { label: "Normal", tone: "neutral" },
  penting: { label: "Penting", tone: "warning" },
  mendesak: { label: "Mendesak", tone: "danger" },
};

/** Kategori turnover — dipakai analitik keluar-masuk karyawan. */
export const KATEGORI_TURNOVER = [
  "Voluntary (Resign)",
  "Involuntary (PHK)",
  "Kontrak Selesai Tidak Diperpanjang",
  "Mangkir / Tanpa Kabar",
] as const;
export type KategoriTurnover = (typeof KATEGORI_TURNOVER)[number];

export interface KontrakInput {
  jenis: JenisKontrak | null;
  tglMulai: string | null;
  tglBerakhir: string | null;
  tglResign: string | null;
}

const HARI = 86_400_000;

/** Tengah hari UTC — menghindari tanggal bergeser satu hari karena zona waktu. */
function hari(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const hariIni = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/**
 * Sisa hari sampai kontrak berakhir. Negatif berarti sudah lewat.
 * `null` bila tanggal berakhirnya belum diisi (PKWTT tidak punya).
 */
export function sisaHari(k: KontrakInput, now = new Date()): number | null {
  if (!k.tglBerakhir) return null;
  return Math.round((hari(k.tglBerakhir) - hariIni(now)) / HARI);
}

/** Durasi kontrak dalam bulan (dibulatkan ke bulan terdekat). */
export function durasiBulan(k: KontrakInput): number | null {
  if (!k.tglMulai || !k.tglBerakhir) return null;
  const hariTotal = (hari(k.tglBerakhir) - hari(k.tglMulai)) / HARI;
  if (hariTotal <= 0) return null;
  return Math.round(hariTotal / 30.44);
}

/**
 * Status kontrak — dihitung, tidak pernah diketik.
 *
 * Karyawan yang sudah keluar TIDAK dihitung sebagai kontrak berakhir: ia keluar
 * dari daftar aktif seluruhnya. Mencampur keduanya membuat angka "kontrak
 * berakhir" tampak jauh lebih besar dari yang benar-benar perlu ditindaklanjuti.
 */
export function statusKontrak(k: KontrakInput, now = new Date()): StatusKontrak {
  if (!k.jenis || !k.tglMulai) return "belum_ada";
  // PKWTT tidak punya tanggal berakhir — selamanya aktif sampai ada tanggal keluar.
  if (k.jenis === "PKWTT") return "aktif";
  const sisa = sisaHari(k, now);
  if (sisa === null) return "belum_ada";
  if (sisa < 0) return "berakhir";
  if (sisa <= SEGERA_BERAKHIR_HARI) return "segera_berakhir";
  return "aktif";
}

/** Masa kerja sejak tanggal masuk pertama, sebagai "2 tahun 3 bulan". */
export function masaKerja(tglMasukPertama: string | null, sampai: string | null, now = new Date()): string {
  if (!tglMasukPertama) return "—";
  const akhir = sampai ? hari(sampai) : hariIni(now);
  const total = Math.round((akhir - hari(tglMasukPertama)) / HARI);
  if (total < 0) return "—";
  const bulan = Math.floor(total / 30.44);
  const tahun = Math.floor(bulan / 12);
  const sisaBulan = bulan % 12;
  if (tahun === 0 && sisaBulan === 0) return `${total} hari`;
  if (tahun === 0) return `${sisaBulan} bulan`;
  return sisaBulan === 0 ? `${tahun} tahun` : `${tahun} tahun ${sisaBulan} bulan`;
}

export const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "Agustus 2026" dari tanggal keluar — dipakai mengelompokkan turnover. */
export function bulanKeluar(tglResign: string | null): string | null {
  if (!tglResign) return null;
  const d = new Date(tglResign);
  if (Number.isNaN(d.getTime())) return null;
  return `${BULAN_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Periode "2026-08" — kunci Update Bulanan. */
export const periodeKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function periodeLabel(periode: string): string {
  const [y, m] = periode.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return periode;
  return `${BULAN_ID[m - 1]} ${y}`;
}

/** Brand GWG menurut nama outlet — dipakai saringan brand di Kontrak Tracker. */
export const BRANDS = ["Nordu", "Cattu", "Busari", "Lesung Pipi"] as const;
export type Brand = (typeof BRANDS)[number];

/**
 * Brand sebuah outlet, ditebak dari namanya.
 *
 * Outlet tidak menyimpan kolom brand tersendiri, dan menambahkannya berarti 60
 * baris harus diisi ulang tangan. Nama outlet sudah selalu diawali brandnya
 * ("Nordu Sampit", "Cattu Sintang"), jadi itu yang dipakai. Yang tidak cocok
 * dikembalikan `null` — bukan dipaksa ke Nordu, supaya outlet yang salah nama
 * kelihatan alih-alih tersembunyi di brand terbesar.
 */
export function brandOutlet(nama: string): Brand | null {
  const n = nama.toLowerCase();
  if (n.includes("nordu") || n.includes("bakes")) return "Nordu";
  if (n.includes("cattu")) return "Cattu";
  if (n.includes("busari")) return "Busari";
  if (n.includes("lesung")) return "Lesung Pipi";
  return null;
}
