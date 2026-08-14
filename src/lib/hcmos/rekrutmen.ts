/**
 * Rekrutmen & Onboarding — aturan bersama.
 *
 * Tahap kandidat sengaja dibuat berurutan dan sedikit. Pipeline dengan belasan
 * tahap terlihat teliti tapi tidak pernah dipakai konsisten: yang mengisi akan
 * melompat-lompat, dan angka "berapa kandidat di tahap wawancara" berhenti
 * berarti apa pun.
 */

export const TAHAP_KANDIDAT = ["baru", "screening", "interview", "tawaran", "diterima", "ditolak"] as const;
export type TahapKandidat = (typeof TAHAP_KANDIDAT)[number];

export const TAHAP_META: Record<
  TahapKandidat,
  { label: string; tone: "neutral" | "brand" | "warning" | "cyan" | "success" | "danger" }
> = {
  baru: { label: "Baru Masuk", tone: "neutral" },
  screening: { label: "Screening", tone: "brand" },
  interview: { label: "Interview", tone: "cyan" },
  tawaran: { label: "Penawaran", tone: "warning" },
  diterima: { label: "Diterima", tone: "success" },
  ditolak: { label: "Tidak Lolos", tone: "danger" },
};

/** Tahap yang masih berjalan — dipakai memisahkan pipeline dari yang sudah selesai. */
export const TAHAP_AKTIF: TahapKandidat[] = ["baru", "screening", "interview", "tawaran"];

/**
 * Ceklis onboarding.
 *
 * Dua daftar berbeda karena hari pertama seorang staf kantor dan seorang crew
 * outlet memang tidak sama: satu berurusan dengan akun & perangkat, satunya
 * dengan seragam, SOP penyajian, dan jadwal shift.
 */
export interface ButirOnboarding {
  key: string;
  label: string;
  /** Siapa yang mengerjakan butir ini. */
  oleh: string;
}

export const ONBOARDING_MANAJEMEN: ButirOnboarding[] = [
  { key: "kontrak", label: "Kontrak kerja ditandatangani", oleh: "Human Capital" },
  { key: "berkas", label: "Berkas pribadi lengkap (KTP, NPWP, rekening)", oleh: "Human Capital" },
  { key: "akun", label: "Akun sistem & email dibuatkan", oleh: "System Support" },
  { key: "perangkat", label: "Perangkat kerja diserahkan", oleh: "System Support" },
  { key: "orientasi", label: "Orientasi perusahaan & culture", oleh: "Human Capital" },
  { key: "atasan", label: "Perkenalan tim & atasan langsung", oleh: "Kepala Divisi" },
  { key: "target", label: "Target 3 bulan pertama disepakati", oleh: "Kepala Divisi" },
  { key: "bpjs", label: "Pendaftaran BPJS", oleh: "Compensation & Benefit" },
];

export const ONBOARDING_OUTLET: ButirOnboarding[] = [
  { key: "kontrak", label: "Kontrak kerja (PKWT) ditandatangani", oleh: "Human Capital" },
  { key: "berkas", label: "Berkas pribadi lengkap (KTP, rekening)", oleh: "Supervisor Outlet" },
  { key: "seragam", label: "Seragam & atribut diserahkan", oleh: "Supervisor Outlet" },
  { key: "sop", label: "Pengenalan SOP outlet & keselamatan kerja", oleh: "Supervisor Outlet" },
  { key: "fast_start", label: "Fast Start dijadwalkan", oleh: "Learning & Development" },
  { key: "shift", label: "Jadwal shift pertama diberikan", oleh: "Supervisor Outlet" },
  { key: "bpjs", label: "Pendaftaran BPJS", oleh: "Compensation & Benefit" },
];

export const butirOnboarding = (scope: "manajemen" | "outlet") =>
  scope === "outlet" ? ONBOARDING_OUTLET : ONBOARDING_MANAJEMEN;

/** Persentase penyelesaian ceklis — 0 bila belum ada butir yang ditandai. */
export function progresOnboarding(scope: "manajemen" | "outlet", ceklis: Record<string, boolean>): number {
  const butir = butirOnboarding(scope);
  if (butir.length === 0) return 0;
  const selesai = butir.filter((b) => ceklis[b.key]).length;
  return Math.round((selesai / butir.length) * 100);
}
