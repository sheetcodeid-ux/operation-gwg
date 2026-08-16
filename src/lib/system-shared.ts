import type { Tone } from "@/lib/constants";

/**
 * Shared System-Support request types + labels. Lives outside the server-only
 * data module so both the server and the client components can use them.
 */

/** The System Support team = Operation staff (department "Operational") whose
 *  job title is "System Support". Only they (and Super Admin) may process,
 *  assign and close system tickets. */
export function isSystemSupport(
  user: { role: string; department?: string | null; jabatan?: string | null } | null,
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.department === "Operational" && (user.jabatan ?? "").trim().toLowerCase() === "system support";
}

/** The exact department + job title that defines the System Support team. */
export const SYSTEM_SUPPORT_DEPT = "Operational";
export const SYSTEM_SUPPORT_JABATAN = "System Support";

export type SysRequestType =
  | "jaringan"
  | "bug"
  | "hardware"
  | "printer"
  | "akses"
  | "fitur"
  | "training"
  | "lainnya";
export type SysUrgency = "urgent" | "normal" | "low";
export type SysStatus = "waiting" | "processing" | "done";

/**
 * Kategori keluhan, diurutkan dari yang paling sering dipakai di lapangan.
 *
 * Urutannya bukan selera: kartu pertama yang paling sering ditekan, dan
 * daftar yang dimulai dari "Penambahan Fitur" memaksa orang yang wifi-nya mati
 * membaca sampai bawah dulu. `jaringan` dan `printer` ditambahkan justru karena
 * dua itu keluhan harian yang dulu tidak punya tempat dan selalu jatuh ke
 * "lainnya" — dan kategori yang isinya selalu "lainnya" tidak bisa dipakai
 * menghitung apa pun.
 *
 * `hint` adalah contoh nyata, bukan penjelasan ulang labelnya. Orang memilih
 * kategori dengan mencocokkan keadaannya, bukan dengan membaca definisi.
 */
export const SYS_REQUEST_TYPES: {
  value: SysRequestType;
  label: string;
  /** Nama ikon lucide — dipetakan di komponen, supaya berkas ini tetap bebas React. */
  icon: string;
  hint: string;
}[] = [
  { value: "jaringan", label: "Jaringan / Internet", icon: "Wifi", hint: "WiFi putus, internet lambat, CCTV tidak terhubung" },
  { value: "bug", label: "Aplikasi Error", icon: "Bug", hint: "Sistem tidak bisa dibuka, tombol error, data tidak muncul" },
  { value: "hardware", label: "Perangkat / Hardware", icon: "MonitorSmartphone", hint: "Komputer mati, tablet rusak, mesin kasir bermasalah" },
  { value: "printer", label: "Printer / Struk", icon: "Printer", hint: "Struk tidak keluar, printer dapur macet, tinta habis" },
  { value: "akses", label: "Akun / Akses", icon: "KeyRound", hint: "Lupa kata sandi, akun terkunci, minta hak akses menu" },
  { value: "fitur", label: "Permintaan Fitur", icon: "Sparkles", hint: "Minta menu baru atau perubahan pada sistem" },
  { value: "training", label: "Pelatihan", icon: "GraduationCap", hint: "Minta diajari memakai sistem atau perangkat" },
  { value: "lainnya", label: "Lainnya", icon: "CircleHelp", hint: "Kendala IT yang tidak masuk kategori di atas" },
];

export const SYS_TYPE_LABEL: Record<SysRequestType, string> = Object.fromEntries(
  SYS_REQUEST_TYPES.map((t) => [t.value, t.label]),
) as Record<SysRequestType, string>;

export const SYS_URGENCY_META: Record<SysUrgency, { label: string; tone: Tone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  normal: { label: "Normal", tone: "cyan" },
  low: { label: "Low", tone: "neutral" },
};

export const SYS_STATUS_META: Record<SysStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Menunggu", tone: "warning" },
  processing: { label: "Diproses", tone: "cyan" },
  done: { label: "Selesai", tone: "success" },
};

/** Penilaian pelapor setelah tiketnya ditutup. */
export const SYS_SATISFACTION: { value: number; label: string; tone: Tone }[] = [
  { value: 5, label: "Sangat Puas", tone: "success" },
  { value: 4, label: "Puas", tone: "success" },
  { value: 3, label: "Cukup", tone: "cyan" },
  { value: 2, label: "Kurang", tone: "warning" },
  { value: 1, label: "Tidak Puas", tone: "danger" },
];

export const SYS_SATISFACTION_META: Record<number, { label: string; tone: Tone }> = Object.fromEntries(
  SYS_SATISFACTION.map((s) => [s.value, { label: s.label, tone: s.tone }]),
);

/**
 * Selisih dua waktu dalam bentuk yang bisa dibaca sekilas.
 *
 * Dipakai untuk waktu respons dan waktu penyelesaian. Angka mentah dalam menit
 * tidak menolong: "2880 menit" tidak berarti apa pun sampai dihitung dulu, dan
 * yang membaca antrian sedang menyaring puluhan baris, bukan menghitung.
 */
export function selisihSingkat(dari: string | null, sampai: string | null): string | null {
  if (!dari || !sampai) return null;
  const ms = Date.parse(sampai) - Date.parse(dari);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const menit = Math.round(ms / 60000);
  if (menit < 1) return "< 1 mnt";
  if (menit < 60) return `${menit} mnt`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return menit % 60 === 0 ? `${jam} jam` : `${jam} jam ${menit % 60} mnt`;
  const hari = Math.floor(jam / 24);
  return jam % 24 === 0 ? `${hari} hari` : `${hari} hari ${jam % 24} jam`;
}

/** Milidetik antara dua waktu — untuk perata-rataan, bukan untuk ditampilkan. */
export function selisihMs(dari: string | null, sampai: string | null): number | null {
  if (!dari || !sampai) return null;
  const ms = Date.parse(sampai) - Date.parse(dari);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

export interface SystemRequest {
  id: string;
  /** Nomor tiket, mis. IT-202608-0007. Null hanya untuk baris lama. */
  ticketNo: string | null;
  requesterId: string;
  requesterName: string;
  position: string;
  outletId: string;
  outletName: string;
  waNumber: string | null;
  requestType: SysRequestType;
  title: string;
  description: string | null;
  impact: string | null;
  urgency: SysUrgency;
  neededDate: string | null;
  /** Supporting file/photo — a signed URL for an uploaded file OR a pasted link. */
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentIsFile: boolean;
  status: SysStatus;
  handlerId: string | null;
  handlerName: string | null;
  note: string | null;
  /** Proof-of-repair photos attached by System Support on completion (signed URLs). */
  resultUrls: string[];
  workTaskId: string | null;
  processedByName: string | null;
  completedAt: string | null;
  createdAt: string;
  /** Saat tim IT PERTAMA kali menyentuh tiket ini. */
  firstResponseAt: string | null;
  /** 1–5 dari pelapor, null selama belum dinilai. */
  satisfaction: number | null;
  satisfactionNote: string | null;
}
