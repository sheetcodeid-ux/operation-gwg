/** Client-safe Operation threshold settings (Juknis bab 6). */
import { EXPENSE_COLS, type ExpenseCol } from "./categories";

export interface OpsSettings {
  /** % of omset per expense category (bar over threshold → red). Juknis 6.1. */
  expenseThresholds: Record<ExpenseCol, number>;
  /** Margin health bands (%). Juknis 6.2. */
  marginBands: { sehat: number; cukup: number; kritis: number };
  /** Pembelian vs omset limits (%). Juknis 2.11 / 6.3. */
  purchaseLimits: { warehouse: number; nonWarehouse: number; total: number };
}

export const DEFAULT_SETTINGS: OpsSettings = {
  expenseThresholds: { utilitas: 3, sewa: 3, tenaga_kerja: 13, potongan: 3, manajemen_fee: 3, pemasaran: 3, ongkos_kirim: 3, lainnya: 3 },
  marginBands: { sehat: 30, cukup: 29, kritis: 15 },
  purchaseLimits: { warehouse: 30, nonWarehouse: 5, total: 35 },
};

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Merge a stored (possibly partial) config over defaults, coercing numbers. */
export function mergeSettings(raw: unknown): OpsSettings {
  const r = (raw ?? {}) as Partial<OpsSettings>;
  const et = { ...DEFAULT_SETTINGS.expenseThresholds };
  for (const c of EXPENSE_COLS) et[c] = num(r.expenseThresholds?.[c], DEFAULT_SETTINGS.expenseThresholds[c]);
  return {
    expenseThresholds: et,
    marginBands: {
      sehat: num(r.marginBands?.sehat, DEFAULT_SETTINGS.marginBands.sehat),
      cukup: num(r.marginBands?.cukup, DEFAULT_SETTINGS.marginBands.cukup),
      kritis: num(r.marginBands?.kritis, DEFAULT_SETTINGS.marginBands.kritis),
    },
    purchaseLimits: {
      warehouse: num(r.purchaseLimits?.warehouse, DEFAULT_SETTINGS.purchaseLimits.warehouse),
      nonWarehouse: num(r.purchaseLimits?.nonWarehouse, DEFAULT_SETTINGS.purchaseLimits.nonWarehouse),
      total: num(r.purchaseLimits?.total, DEFAULT_SETTINGS.purchaseLimits.total),
    },
  };
}
