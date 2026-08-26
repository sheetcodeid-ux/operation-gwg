import type { Tone } from "@/lib/constants";

// Access checks live in `lib/actions/hc.ts` (server) and are department-aware
// via `canReachMenu` — do not gate on role alone.

/**
 * Shared Human-Capital document types + labels. Lives OUTSIDE the server-only
 * data module so both the server (`data/hc.ts`, `actions/hc.ts`) and client
 * components (`components/hc/*`) can import the enums, labels and row shape.
 */

export type HcDocType =
  | "bpjs"
  | "pkwt"
  | "perpanjang_pkwt"
  | "promosi"
  | "teguran"
  | "sp1"
  | "sp2"
  | "sp3"
  | "pengalaman"
  | "keterangan_kerja"
  | "tidak_lanjut_kontrak"
  | "phk"
  | "sppt";
export type HcStatus = "waiting" | "processing" | "pending" | "done" | "rejected";

export const HC_DOC_TYPES: { value: HcDocType; label: string }[] = [
  { value: "bpjs", label: "Pendaftaran BPJS" },
  { value: "pkwt", label: "Kontrak PKWT" },
  { value: "perpanjang_pkwt", label: "Perpanjang PKWT" },
  { value: "promosi", label: "Surat Promosi" },
  // Teguran/SP dipecah per tingkat (permintaan HC) — bukan satu dropdown lagi.
  { value: "teguran", label: "Surat Teguran" },
  { value: "sp1", label: "Surat Peringatan 1" },
  { value: "sp2", label: "Surat Peringatan 2" },
  { value: "sp3", label: "Surat Peringatan 3" },
  { value: "pengalaman", label: "Surat Pengalaman Kerja" },
  { value: "keterangan_kerja", label: "Surat Keterangan Kerja" },
  { value: "tidak_lanjut_kontrak", label: "Surat Keterangan Tidak Dilanjutkan Kontrak" },
  { value: "phk", label: "PHK" },
  { value: "sppt", label: "SPPT" },
];

export const HC_DOC_LABEL: Record<HcDocType, string> = {
  bpjs: "Pendaftaran BPJS",
  pkwt: "Kontrak PKWT",
  perpanjang_pkwt: "Perpanjang PKWT",
  promosi: "Surat Promosi",
  teguran: "Surat Teguran",
  sp1: "Surat Peringatan 1",
  sp2: "Surat Peringatan 2",
  sp3: "Surat Peringatan 3",
  pengalaman: "Surat Pengalaman Kerja",
  keterangan_kerja: "Surat Keterangan Kerja",
  tidak_lanjut_kontrak: "Surat Keterangan Tidak Dilanjutkan Kontrak",
  phk: "PHK",
  sppt: "SPPT",
};

/** Jenis yang butuh kronologi pelanggaran (Teguran & SP 1–3, PHK). */
export const HC_NEEDS_CHRONOLOGY: HcDocType[] = ["teguran", "sp1", "sp2", "sp3", "phk"];
/** Jenis berbasis kontrak — pakai isian posisi/durasi/mulai/gaji seperti PKWT. */
export const HC_CONTRACT_LIKE: HcDocType[] = ["pkwt", "perpanjang_pkwt"];

/**
 * Jenis yang mengubah JABATAN, bukan masa kontrak — Surat Promosi.
 *
 * Sengaja tidak menumpang `HC_CONTRACT_LIKE`: isiannya mirip, tapi satu kolom
 * berbeda dan bedanya menentukan. Promosi tidak punya durasi, dan surat promosi
 * TIDAK bisa ditulis tanpa jabatan lamanya — kalimat intinya persis "dari
 * jabatan A menjadi jabatan B". Memaksakannya ke formulir kontrak berarti HC
 * menerima permintaan yang selalu kurang satu keterangan, lalu menanyakannya
 * lewat chat satu per satu.
 */
export const HC_PROMOSI_LIKE: HcDocType[] = ["promosi"];

export const HC_STATUS_META: Record<HcStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Menunggu", tone: "warning" },
  processing: { label: "Diproses", tone: "cyan" },
  pending: { label: "Menunggu Berkas", tone: "amber" },
  done: { label: "Selesai", tone: "success" },
  // Ditutup tanpa dokumen terbit. Nadanya sengaja bukan "danger": pengajuan
  // yang dibatalkan cabang bukan kesalahan siapa pun, dan mewarnainya merah
  // membuat antrian tampak penuh masalah padahal isinya kabar biasa.
  rejected: { label: "Dibatalkan", tone: "neutral" },
};

export const HC_WARNING_LEVELS = ["Teguran Lisan", "SP 1", "SP 2", "SP 3"] as const;


/** Whether the signed URL points at an image (for inline preview vs a PDF). */
export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)(\?|$)/i.test(url);
}

/** Extra fields the supervisor fills, by document type. */
export interface HcDetails {
  /** BPJS — nama ibu kandung. */
  motherName?: string;
  /** PKWT — posisi/jabatan, durasi, tanggal mulai, gaji. */
  position?: string;
  /** Surat Promosi — jabatan sebelum promosi ("dari … menjadi …"). */
  previousPosition?: string;
  contractDuration?: string;
  startDate?: string;
  salary?: string;
  /** Surat Teguran / SP — jenis (Teguran / SP1 / SP2 / SP3) + kronologi. */
  warningLevel?: string;
  chronology?: string;
  /** Original KTP filename (e.g. "dfsfs.jpg") — for display & download name. */
  ktpName?: string;
}

/** A submission as returned to the client (files exposed as signed URLs). */
export interface HcSubmission {
  id: string;
  employeeName: string;
  docType: HcDocType;
  outletId: string;
  outletName: string;
  supervisorId: string;
  supervisorName: string;
  ktpUrl: string | null;
  details: HcDetails;
  status: HcStatus;
  hcNote: string | null;
  finalDocUrl: string | null;
  processedByName: string | null;
  completedByName: string | null;
  completedAt: string | null;
  createdAt: string;
}
