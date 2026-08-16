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

/**
 * DUA meja yang berbeda, memakai alur dan tabel yang sama.
 *
 *  • `system`   — perangkat & POS di cabang: mesin kasir, printer struk,
 *                 jaringan outlet. Ditangani tim System Support.
 *  • `helpdesk` — aplikasi web ini sendiri: error, permintaan fitur, hak akses
 *                 menu, data yang perlu dikoreksi. Ditangani pemilik Help Desk.
 *
 * Pemisahannya bukan soal rapi-rapian. Keduanya ditangani ORANG YANG BERBEDA,
 * dan digabung berarti keluhan printer kasir menumpuk di antrean yang sama
 * dengan permintaan fitur web — dua-duanya jadi lebih lambat ditemukan.
 *
 * Yang TIDAK dipisah: tabel, alur status, penomoran tiket, dan komponennya.
 * Membangun dua sistem tiket berdampingan justru mengembalikan persoalan yang
 * mau diselesaikan — data IT tercecer di dua tempat.
 */
export type SysDesk = "system" | "helpdesk";

/** Jabatan yang memegang antrean IT Help Desk (aplikasi web). */
export const HELPDESK_JABATAN = "IT Help Desk";

/**
 * Siapa yang boleh menangani tiket Help Desk.
 *
 * Sengaja TIDAK memakai jabatan "System Support": mereka mengurus perangkat di
 * cabang, bukan aplikasi ini. Memberi mereka antrean web berarti tiket web
 * mendarat di meja orang yang tidak mengerjakannya, lalu diam di situ.
 */
export function isHelpdeskOwner(
  user: { role: string; department?: string | null; jabatan?: string | null } | null,
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return (user.jabatan ?? "").trim().toLowerCase() === HELPDESK_JABATAN.toLowerCase();
}

export type SysRequestType =
  | "jaringan"
  | "bug"
  | "hardware"
  | "printer"
  | "salah_data"
  | "akses"
  | "fitur"
  | "training"
  | "lainnya";
export type SysUrgency = "urgent" | "normal" | "low";
export type SysStatus = "waiting" | "processing" | "done";

/**
 * Satu pilihan kategori.
 *
 * Daftarnya diurutkan dari yang paling sering dipakai, dan itu bukan selera:
 * kartu pertama yang paling sering ditekan, jadi daftar yang dimulai dari
 * "Permintaan Fitur" memaksa orang yang aplikasinya error membaca sampai bawah
 * dulu.
 *
 * `hint` adalah contoh nyata, bukan penjelasan ulang labelnya. Orang memilih
 * kategori dengan mencocokkan keadaannya, bukan dengan membaca definisi.
 */
export interface SysTypeOption {
  value: SysRequestType;
  label: string;
  /** Nama ikon lucide — dipetakan di komponen, supaya berkas ini tetap bebas React. */
  icon: string;
  hint: string;
}

/** Meja System Support — perangkat & POS di cabang. */
export const SYSTEM_TYPES: SysTypeOption[] = [
  { value: "jaringan", label: "Jaringan / Internet", icon: "Wifi", hint: "WiFi outlet putus, internet lambat, CCTV tidak terhubung" },
  { value: "printer", label: "Printer / Struk", icon: "Printer", hint: "Struk tidak keluar, printer dapur macet, tinta habis" },
  { value: "hardware", label: "Perangkat / Mesin Kasir", icon: "MonitorSmartphone", hint: "Mesin kasir mati, tablet rusak, layar tidak menyala" },
  { value: "lainnya", label: "Lainnya", icon: "CircleHelp", hint: "Kendala perangkat lain di cabang" },
];

/**
 * Meja IT Help Desk — aplikasi web ini sendiri.
 *
 * Isinya sengaja tidak memuat printer atau mesin kasir: itu perangkat di
 * cabang, dan yang menanganinya orang lain. Kategori yang salah meja membuat
 * tiket mendarat di antrean yang tidak akan mengerjakannya.
 */
export const HELPDESK_TYPES: SysTypeOption[] = [
  { value: "bug", label: "Aplikasi Error", icon: "Bug", hint: "Halaman gagal dibuka, tombol tidak jalan, muncul pesan error" },
  { value: "salah_data", label: "Data Salah / Tidak Muncul", icon: "DatabaseZap", hint: "Angka rekap keliru, data sudah diisi tapi tidak tampil" },
  { value: "akses", label: "Akun / Hak Akses", icon: "KeyRound", hint: "Lupa kata sandi, akun terkunci, menu yang seharusnya ada tidak muncul" },
  { value: "fitur", label: "Permintaan Fitur", icon: "Sparkles", hint: "Minta menu baru, kolom tambahan, atau perubahan tampilan" },
  { value: "training", label: "Cara Pakai", icon: "GraduationCap", hint: "Minta diajari memakai sebuah menu di aplikasi" },
  { value: "lainnya", label: "Lainnya", icon: "CircleHelp", hint: "Kendala aplikasi yang tidak masuk kategori di atas" },
];

/** Kategori yang berlaku untuk sebuah meja. */
export const typesForDesk = (desk: SysDesk): SysTypeOption[] =>
  desk === "helpdesk" ? HELPDESK_TYPES : SYSTEM_TYPES;

/** Gabungan keduanya — dipakai untuk memvalidasi dan memberi label baris lama. */
export const SYS_REQUEST_TYPES: SysTypeOption[] = [
  ...SYSTEM_TYPES,
  ...HELPDESK_TYPES.filter((h) => !SYSTEM_TYPES.some((s) => s.value === h.value)),
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
  /** Meja mana yang menangani tiket ini. */
  desk: SysDesk;
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
