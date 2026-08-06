/**
 * KPI Coordinator Area (Operation).
 *
 * Empat indikator berbobot — bobot bawaan 40/30/20/10 dan bisa diubah admin:
 *   1. Gross Sales     — realisasi omzet ESB terhadap target
 *   2. Net Profit      — laba bersih (Operation → Laba Rugi) terhadap target
 *   3. Complain        — jumlah komplain, SEMAKIN KECIL SEMAKIN BAIK
 *   4. Problem Solver  — dinilai manual oleh atasan
 *
 * Warehouse & Non-Warehouse ikut dihitung dan ditampilkan sebagai kontrol biaya,
 * tetapi TIDAK berbobot dan tidak memengaruhi skor.
 *
 * Semua target diturunkan dari rata-rata omzet 3 bulan terakhir per outlet:
 *   Target Gross Sales   = AVG3 × 115%
 *   Target Net Profit    = Target Gross Sales × 30%
 *   Target Warehouse     = AVG3 × 30%
 *   Target Non-Warehouse = Target Warehouse × 5%
 */

export type OpsKpiKey = "gross_sales" | "net_profit" | "complaint" | "problem_solver";

export interface OpsKpiIndicator {
  key: OpsKpiKey;
  no: number;
  name: string;
  short: string;
  unit: string;
  /** Semakin kecil semakin baik (Complain). */
  lowerIsBetter?: boolean;
  /** Diisi tangan, bukan dari data operasional. */
  manual?: boolean;
  measure: string;
}

export const OPS_KPI_INDICATORS: OpsKpiIndicator[] = [
  {
    key: "gross_sales",
    no: 1,
    name: "Gross Sales",
    short: "Gross Sales",
    unit: "Rp",
    measure: "Omzet ESB bulan berjalan dibanding target (rata-rata 3 bulan × 115%).",
  },
  {
    key: "net_profit",
    no: 2,
    name: "Net Profit",
    short: "Net Profit",
    unit: "Rp",
    measure: "Laba bersih dari Operation → Laba Rugi dibanding target (Target Gross Sales × 30%).",
  },
  {
    key: "complaint",
    no: 3,
    name: "Complain",
    short: "Complain",
    unit: "Kasus",
    lowerIsBetter: true,
    measure: "Jumlah komplain pada bulan berjalan. Kategori Kualitas Makanan dikecualikan.",
  },
  {
    key: "problem_solver",
    no: 4,
    name: "Problem Solver",
    short: "Problem Solver",
    unit: "Nilai",
    manual: true,
    measure: "Penilaian manual atas kecepatan & ketuntasan penyelesaian masalah di area.",
  },
];

export const OPS_KPI_BY_KEY: Record<OpsKpiKey, OpsKpiIndicator> = Object.fromEntries(
  OPS_KPI_INDICATORS.map((i) => [i.key, i]),
) as Record<OpsKpiKey, OpsKpiIndicator>;

export const DEFAULT_OPS_WEIGHTS: Record<OpsKpiKey, number> = {
  gross_sales: 40,
  net_profit: 30,
  complaint: 20,
  problem_solver: 10,
};

/* ─────────────────────────── rumus target ─────────────────────────── */

/** Outlet harus sudah berjalan minimal sekian bulan untuk ikut dihitung. */
export const MIN_OUTLET_MONTHS = 3;

export const targetGrossSales = (avg3: number) => avg3 * 1.15;
export const targetNetProfit = (avg3: number) => targetGrossSales(avg3) * 0.3;
export const targetWarehouse = (avg3: number) => avg3 * 0.3;
export const targetNonWarehouse = (avg3: number) => targetWarehouse(avg3) * 0.05;

/* ─────────────────────────── perhitungan skor ─────────────────────────── */

/**
 * Persentase capaian satu indikator.
 * - Normal          : realisasi / target
 * - Semakin kecil ↑ : target / realisasi. Target 0 berarti "tanpa komplain":
 *   nol komplain = 100%, selebihnya turun bertahap per kasus.
 */
export function opsCapaian(ind: OpsKpiIndicator, target: number, realisasi: number): number {
  if (ind.lowerIsBetter) {
    if (realisasi <= target) return 100;
    if (target <= 0) return Math.max(0, 100 - realisasi * 20); // 5 komplain ⇒ 0
    return Math.round((target / realisasi) * 10000) / 100;
  }
  if (target <= 0) return 0;
  return Math.round((realisasi / target) * 10000) / 100;
}

/** Kontribusi ke skor total = bobot × capaian, dibatasi pada bobot penuh. */
export function opsAktual(weight: number, capaian: number): number {
  return Math.round(((weight * Math.min(capaian, 100)) / 100) * 100) / 100;
}

export interface OpsKpiRow {
  indicator: OpsKpiIndicator;
  weight: number;
  target: number;
  realisasi: number;
  selisih: number;
  capaian: number;
  aktual: number;
}

export function opsTotalScore(rows: OpsKpiRow[]): number {
  return Math.round(rows.reduce((s, r) => s + r.aktual, 0) * 100) / 100;
}

export type OpsKpiTone = "success" | "brand" | "warning" | "danger";

/** Interpretasi hasil — ambang sama dengan KPI Human Capital. */
export function opsKpiCategory(score: number): { label: string; tone: OpsKpiTone; action: string } {
  if (score >= 95) return { label: "SANGAT BAIK", tone: "success", action: "Pertahankan dan jadikan acuan area lain." };
  if (score >= 80) return { label: "BAIK", tone: "brand", action: "Identifikasi outlet yang masih di bawah target." };
  if (score >= 65) return { label: "CUKUP", tone: "warning", action: "Susun rencana perbaikan dengan tenggat jelas." };
  return { label: "PERLU PERBAIKAN", tone: "danger", action: "Evaluasi mendalam bersama Head Operation." };
}

export const OPS_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const opsPeriod = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
export function opsPeriodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${OPS_MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export const fmtRp = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
