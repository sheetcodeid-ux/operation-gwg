import type { Tone } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Access                                                              */
/* ------------------------------------------------------------------ */

/** Supervisors (field) submit document requests; Admin can too for testing. */
export function canSubmitHc(user: UserProfile | null): boolean {
  return !!user && (user.role === "supervisor" || user.role === "super_admin");
}

/** Human Capital (legal/HRD) processes the queue; Admin oversees. */
export function canReviewHc(user: UserProfile | null): boolean {
  return !!user && (user.role === "legal" || user.role === "super_admin");
}

/**
 * Shared Human-Capital document types + labels. Lives OUTSIDE the server-only
 * data module so both the server (`data/hc.ts`, `actions/hc.ts`) and client
 * components (`components/hc/*`) can import the enums, labels and row shape.
 */

export type HcDocType = "bpjs" | "pkwt" | "teguran";
export type HcStatus = "waiting" | "processing" | "done";

export const HC_DOC_TYPES: { value: HcDocType; label: string }[] = [
  { value: "bpjs", label: "Pendaftaran BPJS" },
  { value: "pkwt", label: "Kontrak PKWT" },
  { value: "teguran", label: "Surat Teguran / SP" },
];

export const HC_DOC_LABEL: Record<HcDocType, string> = {
  bpjs: "Pendaftaran BPJS",
  pkwt: "Kontrak PKWT",
  teguran: "Surat Teguran / SP",
};

export const HC_STATUS_META: Record<HcStatus, { label: string; tone: Tone }> = {
  waiting: { label: "Menunggu", tone: "warning" },
  processing: { label: "Diproses", tone: "cyan" },
  done: { label: "Selesai", tone: "success" },
};

export const HC_WARNING_LEVELS = ["Teguran Lisan", "SP 1", "SP 2", "SP 3"] as const;

/** Turn a Supabase signed URL into one that forces a download (attachment)
 *  instead of opening in the browser — so tapping “Unduh” on a phone saves the
 *  file straight to the device. */
export function forceDownload(url: string, filename?: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download${filename ? `=${encodeURIComponent(filename)}` : ""}`;
}

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
  contractDuration?: string;
  startDate?: string;
  salary?: string;
  /** Surat Teguran / SP — jenis (Teguran / SP1 / SP2 / SP3) + kronologi. */
  warningLevel?: string;
  chronology?: string;
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
