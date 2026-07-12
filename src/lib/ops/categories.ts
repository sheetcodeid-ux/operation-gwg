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
export type PurchaseRow = { outletCode: string; outletName: string; warehouse: number; nonWarehouse: number };

export const expenseTotal = (r: ExpenseRow) => EXPENSE_COLS.reduce((a, c) => a + (r[c] || 0), 0);
