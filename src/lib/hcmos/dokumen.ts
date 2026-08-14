/**
 * Pusat Dokumen HC — aturan bersama untuk seluruh dokumen tertulis.
 *
 * SOP, Kebijakan, Culture & Value, dokumen kepatuhan, dan PKS Kemitraan
 * memakai satu bentuk yang sama. Yang membedakan hanya `jenis` dan, untuk
 * SOP, pilar mana yang memilikinya.
 */

export const JENIS_DOKUMEN = ["sop", "kebijakan", "culture", "compliance", "pks"] as const;
export type JenisDokumen = (typeof JENIS_DOKUMEN)[number];

export const JENIS_DOKUMEN_META: Record<JenisDokumen, { label: string; ringkas: string }> = {
  sop: { label: "SOP", ringkas: "Prosedur standar operasional per pilar." },
  kebijakan: { label: "Kebijakan", ringkas: "Kebijakan internal perusahaan." },
  culture: { label: "Culture & Value", ringkas: "Nilai-nilai inti GWG Group." },
  compliance: { label: "Dokumen Kepatuhan", ringkas: "Dokumen legalitas & kepatuhan." },
  pks: { label: "PKS Kemitraan", ringkas: "Perjanjian kerja sama: sewa lokasi, kemitraan supplier/brand." },
};

export type StatusDokumen = "draf" | "aktif" | "arsip";

export const STATUS_DOKUMEN_META: Record<StatusDokumen, { label: string; tone: "warning" | "success" | "neutral" }> = {
  draf: { label: "Draf", tone: "warning" },
  aktif: { label: "Aktif", tone: "success" },
  arsip: { label: "Arsip", tone: "neutral" },
};

/**
 * Masa berlaku dokumen — hanya untuk yang memang punya (PKS & kepatuhan).
 *
 * Ambangnya 90 hari, lebih longgar daripada kontrak kerja: memperpanjang
 * perjanjian sewa atau kemitraan menuntut perundingan, bukan sekadar tanda
 * tangan ulang, jadi peringatannya perlu datang lebih awal.
 */
export const MASA_BERLAKU_PERINGATAN_HARI = 90;

export type StatusBerlaku = "berlaku" | "segera_habis" | "habis" | "tanpa_masa";

export const STATUS_BERLAKU_META: Record<
  StatusBerlaku,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  berlaku: { label: "Berlaku", tone: "success" },
  segera_habis: { label: "Segera Habis", tone: "warning" },
  habis: { label: "Habis", tone: "danger" },
  tanpa_masa: { label: "Tanpa Masa Berlaku", tone: "neutral" },
};

const HARI = 86_400_000;
const utc = (iso: string) => {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

export function sisaBerlaku(berlakuSampai: string | null, now = new Date()): number | null {
  if (!berlakuSampai) return null;
  const hariIni = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((utc(berlakuSampai) - hariIni) / HARI);
}

export function statusBerlaku(berlakuSampai: string | null, now = new Date()): StatusBerlaku {
  const sisa = sisaBerlaku(berlakuSampai, now);
  if (sisa === null) return "tanpa_masa";
  if (sisa < 0) return "habis";
  return sisa <= MASA_BERLAKU_PERINGATAN_HARI ? "segera_habis" : "berlaku";
}
