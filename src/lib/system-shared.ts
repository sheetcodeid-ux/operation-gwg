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

export type SysRequestType = "fitur" | "bug" | "akses" | "hardware" | "training" | "lainnya";
export type SysUrgency = "urgent" | "normal" | "low";
export type SysStatus = "waiting" | "processing" | "done";

export const SYS_REQUEST_TYPES: { value: SysRequestType; label: string }[] = [
  { value: "fitur", label: "Penambahan Fitur / Menu di sistem" },
  { value: "bug", label: "Perbaikan Bug / Error" },
  { value: "akses", label: "Akses / Permission User" },
  { value: "hardware", label: "Hardware / Perangkat" },
  { value: "training", label: "Pelatihan / Training" },
  { value: "lainnya", label: "Lainnya" },
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

export interface SystemRequest {
  id: string;
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
}
