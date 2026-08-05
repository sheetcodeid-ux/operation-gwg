import type { Tone } from "@/lib/constants";

/**
 * Pengajuan departemen ke Human Capital.
 *
 * Dua jenis, dua alur persetujuan:
 *  • rekrutmen — permintaan pegawai. HC ACC → direkrut. Menyuplai KPI
 *    "Jumlah Rekrutmen" (target = jumlah yang diminta, realisasi = yang direkrut).
 *  • pelatihan — permintaan program pelatihan. HC ACC → Finance ACC dana →
 *    dilaksanakan. Menyuplai KPI "Development / Pelatihan".
 */

export type HcRequestKind = "rekrutmen" | "pelatihan";

export type HcRequestStatus =
  | "menunggu_hc"
  | "ditolak_hc"
  | "disetujui_hc"
  | "menunggu_finance"
  | "ditolak_finance"
  | "disetujui_finance"
  | "terlaksana";

export const HC_REQUEST_KIND_LABEL: Record<HcRequestKind, string> = {
  rekrutmen: "Permintaan Pegawai",
  pelatihan: "Pengajuan Pelatihan",
};

export const HC_REQUEST_STATUS_META: Record<HcRequestStatus, { label: string; tone: Tone }> = {
  menunggu_hc: { label: "Menunggu ACC HC", tone: "warning" },
  ditolak_hc: { label: "Ditolak HC", tone: "danger" },
  disetujui_hc: { label: "Disetujui HC", tone: "cyan" },
  menunggu_finance: { label: "Menunggu ACC Finance", tone: "amber" },
  ditolak_finance: { label: "Ditolak Finance", tone: "danger" },
  disetujui_finance: { label: "Dana Disetujui", tone: "brand" },
  terlaksana: { label: "Terlaksana", tone: "success" },
};

/** Jenis pelatihan yang bisa dipilih (bebas ditambah lewat "Lainnya"). */
export const TRAINING_TYPES = [
  "Onboarding / Orientasi",
  "Product Knowledge",
  "Service Excellence",
  "Leadership & Supervisi",
  "Barista / Kitchen Skill",
  "Hygiene & Food Safety",
  "Administrasi & Sistem",
  "Lainnya",
];

export interface HcRequestAttachment {
  path?: string;
  name: string;
  url?: string;
}

export interface HcRequest {
  id: string;
  kind: HcRequestKind;
  department: string;
  requesterId: string;
  requesterName: string;
  title: string;
  description: string;
  /** rekrutmen */
  position: string | null;
  headcount: number;
  recruited: number;
  /** pelatihan */
  trainingType: string | null;
  participants: number;
  budget: number;
  budgetApproved: number;
  plannedDate: string | null;
  attachments: HcRequestAttachment[];
  status: HcRequestStatus;
  hcNote: string;
  financeNote: string;
  hcByName: string | null;
  financeByName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** Langkah berikutnya yang wajar untuk sebuah pengajuan (dipakai tombol aksi). */
export function nextActions(r: HcRequest): { hc: boolean; finance: boolean; complete: boolean } {
  if (r.kind === "rekrutmen") {
    return { hc: r.status === "menunggu_hc", finance: false, complete: r.status === "disetujui_hc" };
  }
  return {
    hc: r.status === "menunggu_hc",
    finance: r.status === "menunggu_finance",
    complete: r.status === "disetujui_finance",
  };
}

export const isOpen = (s: HcRequestStatus) => s !== "terlaksana" && s !== "ditolak_hc" && s !== "ditolak_finance";

export const fmtRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
