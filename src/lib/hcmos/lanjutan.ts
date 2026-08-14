/**
 * Aturan hitung & daftar pilihan untuk pilar HC-MOS selain Kontrak Tracker.
 *
 * Semuanya murni perhitungan — tanpa akses basis data — supaya bisa dipakai di
 * server maupun peramban dan diuji tanpa menyiapkan apa pun.
 */

/* ─────────────────────── Fast Start & Fast Track ─────────────────────── */

/** Ambang kelulusan Pre/Post Test sesuai Juknis Bab 4.3. */
export const NILAI_LULUS = 65;

export const PROGRAM_FAST = { fast_start: "Fast Start", fast_track: "Fast Track" } as const;
export type ProgramFast = keyof typeof PROGRAM_FAST;

/**
 * Kelulusan dihitung dari Post Test, bukan disimpan.
 *
 * Nilainya yang fakta; lulus/tidak adalah tafsiran atas ambang yang berlaku.
 * Menyimpan tafsirannya berarti mengubah ambang menuntut menulis ulang seluruh
 * baris lama — dan yang tidak ikut ditulis ulang jadi salah diam-diam.
 */
export function lulus(postTest: number | null): boolean | null {
  if (postTest === null) return null;
  return postTest >= NILAI_LULUS;
}

/** Selisih Post Test terhadap Pre Test — ukuran sebenarnya dari pelatihan. */
export function peningkatan(pre: number | null, post: number | null): number | null {
  if (pre === null || post === null) return null;
  return Math.round((post - pre) * 10) / 10;
}

/* ────────────────────────── Competency Matrix ────────────────────────── */

export const LEVEL_KOMPETENSI = [1, 2, 3, 4, 5] as const;
export const LEVEL_LABEL: Record<number, string> = {
  1: "1 — Belum menguasai",
  2: "2 — Dasar",
  3: "3 — Mampu mandiri",
  4: "4 — Mahir",
  5: "5 — Bisa mengajarkan",
};

/** Selisih terhadap standar jabatan: negatif berarti masih di bawah standar. */
export const senjangKompetensi = (standar: number, aktual: number) => aktual - standar;

/* ───────────────────────── Penilaian Kinerja ───────────────────────── */

/**
 * Aspek penilaian kinerja.
 *
 * Bobotnya berjumlah 100 dan itu diuji — bobot yang tidak genap 100 membuat
 * skor akhir tidak sebanding antar periode tanpa ada yang menyadarinya.
 */
export const ASPEK_KINERJA = [
  { key: "hasil", label: "Hasil Kerja", bobot: 35 },
  { key: "kualitas", label: "Kualitas & Ketelitian", bobot: 20 },
  { key: "inisiatif", label: "Inisiatif", bobot: 15 },
  { key: "kerjasama", label: "Kerja Sama", bobot: 15 },
  { key: "disiplin", label: "Disiplin", bobot: 15 },
] as const;

export type AspekKinerja = (typeof ASPEK_KINERJA)[number]["key"];

/** Skor akhir 0–100 dari nilai tiap aspek (skala 1–5). */
export function skorKinerja(nilai: Record<string, number>): number {
  const total = ASPEK_KINERJA.reduce((a, x) => {
    const n = Number(nilai[x.key]) || 0;
    // Skala 1–5 dijadikan persen capaian sebelum dibobot.
    return a + (n / 5) * x.bobot;
  }, 0);
  return Math.round(total);
}

export const PREDIKAT: { batas: number; label: string; tone: "success" | "brand" | "warning" | "danger" }[] = [
  { batas: 85, label: "Sangat Baik", tone: "success" },
  { batas: 70, label: "Baik", tone: "brand" },
  { batas: 55, label: "Cukup", tone: "warning" },
  { batas: 0, label: "Perlu Perbaikan", tone: "danger" },
];

export const predikatKinerja = (skor: number) => PREDIKAT.find((p) => skor >= p.batas) ?? PREDIKAT[PREDIKAT.length - 1];

/* ──────────────────────────── Talent & Karier ──────────────────────────── */

export const KESIAPAN = {
  siap_sekarang: { label: "Siap Sekarang", tone: "success" as const },
  siap_1_tahun: { label: "Siap 1 Tahun", tone: "warning" as const },
  perlu_dikembangkan: { label: "Perlu Dikembangkan", tone: "neutral" as const },
};
export type Kesiapan = keyof typeof KESIAPAN;

/* ───────────────────────── Compensation & Benefit ───────────────────────── */

export const JENIS_CUTI = {
  cuti: { label: "Cuti", tone: "brand" as const },
  izin: { label: "Izin", tone: "cyan" as const },
  sakit: { label: "Sakit", tone: "warning" as const },
  alpa: { label: "Alpa", tone: "danger" as const },
};
export type JenisCuti = keyof typeof JENIS_CUTI;

export const STATUS_CUTI = {
  diajukan: { label: "Diajukan", tone: "warning" as const },
  disetujui: { label: "Disetujui", tone: "success" as const },
  ditolak: { label: "Ditolak", tone: "danger" as const },
};
export type StatusCuti = keyof typeof STATUS_CUTI;

/** Lama cuti dalam hari, termasuk hari pertama dan terakhir. */
export function lamaCuti(mulai: string | null, selesai: string | null): number {
  if (!mulai || !selesai) return 0;
  const a = new Date(mulai).getTime();
  const b = new Date(selesai).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Take-home pay — dihitung dari komponennya, tidak pernah disimpan. */
export const takeHomePay = (p: { gajiPokok: number; tunjangan: number; lembur: number; potongan: number }) =>
  p.gajiPokok + p.tunjangan + p.lembur - p.potongan;

export const STATUS_BPJS = {
  terdaftar: { label: "Terdaftar", tone: "success" as const },
  proses: { label: "Proses", tone: "warning" as const },
  belum: { label: "Belum", tone: "danger" as const },
};
export type StatusBpjs = keyof typeof STATUS_BPJS;

/* ───────────────────── Employee & Industrial Relations ───────────────────── */

export const STATUS_PERKARA = {
  terbuka: { label: "Terbuka", tone: "danger" as const },
  proses: { label: "Sedang Ditangani", tone: "warning" as const },
  selesai: { label: "Selesai", tone: "success" as const },
};
export type StatusPerkara = keyof typeof STATUS_PERKARA;

export const KATEGORI_KASUS = [
  "Pelanggaran Disiplin",
  "Konflik Antar Karyawan",
  "Keluhan Karyawan",
  "Pelanggaran SOP",
  "Kehilangan / Kerugian",
  "Lainnya",
];

export const KATEGORI_KELUAR = [
  "Resign",
  "PHK",
  "Kontrak Selesai",
  "Pensiun",
  "Mangkir",
];

export const fmtRupiah = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
