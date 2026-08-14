/** Client-safe shared constants & row types for Operation Finance (Beban & Pembelian). */

export const EXPENSE_COLS = ["utilitas", "sewa", "tenaga_kerja", "potongan", "manajemen_fee", "pemasaran", "ongkos_kirim", "lainnya"] as const;
export type ExpenseCol = (typeof EXPENSE_COLS)[number];
export const EXPENSE_LABELS: Record<ExpenseCol, string> = {
  utilitas: "Utilitas",
  sewa: "Sewa",
  tenaga_kerja: "Tenaga Kerja",
  potongan: "Potongan",
  manajemen_fee: "Manajemen Fee",
  pemasaran: "Pemasaran",
  ongkos_kirim: "Ongkos Kirim",
  lainnya: "Lainnya",
};

export type ExpenseRow = { outletCode: string; outletName: string } & Record<ExpenseCol, number>;

/** Laba Rugi per outlet per bulan (Operation → Laba Rugi). */
export const PNL_COLS = ["pendapatan", "hpp", "beban", "laba_bersih"] as const;
export type PnlCol = (typeof PNL_COLS)[number];
export const PNL_LABELS: Record<PnlCol, string> = {
  pendapatan: "Pendapatan",
  hpp: "HPP",
  beban: "Beban",
  laba_bersih: "Laba Bersih",
};
export type PnlRow = { outletCode: string; outletName: string } & Record<PnlCol, number>;
/** Laba bersih versi hitung — pembanding untuk memeriksa angka yang diunggah. */
export const pnlComputed = (r: PnlRow) => (r.pendapatan || 0) - (r.hpp || 0) - (r.beban || 0);
export type PurchaseRow = { outletCode: string; outletName: string; warehouse: number; nonWarehouse: number };

export const expenseTotal = (r: ExpenseRow) => EXPENSE_COLS.reduce((a, c) => a + (r[c] || 0), 0);
