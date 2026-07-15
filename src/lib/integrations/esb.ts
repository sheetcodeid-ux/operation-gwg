/**
 * ESB (erp.esb.co.id) — Cancel/Void Menu Detail report.
 *
 * The report endpoint (POST /report_service/main/get-data-report) returns a
 * Krajee GridView HTML table inside `{ code, data }`. This module parses that
 * HTML into typed rows. The authenticated fetch lives in `esb-client.ts`
 * (server-only) because it needs session credentials; parsing is pure so it can
 * be unit-tested against captured responses.
 *
 * Column order (data-col-seq):
 *  0 #  1 Sales Number  2 Branch  3 Menu  4 Menu Code  5 Menu Category
 *  6 Menu Category Detail  7 Order By  8 Order Time  9 Cancel/Void By
 *  10 Cancel/Void Time  11 Cancel/Void (type)  12 Cancel Notes  13 Qty
 *  14 Subtotal  15 Service Charge  16 Tax  17 Total
 */

export interface CancelDetailRow {
  salesNumber: string;
  branch: string;
  menu: string;
  menuCode: string;
  menuCategory: string;
  menuCategoryDetail: string;
  orderBy: string;
  orderTime: string;
  voidBy: string; // "Cancel / Void By" — the cashier/supervisor who voided
  voidTime: string;
  type: "Void" | "Cancel" | string;
  notes: string;
  qty: number;
  subtotal: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

export interface CancelDetailReport {
  rows: CancelDetailRow[];
  totalItems: number; // from "Showing 1-50 of N items"
  pageTotal: { qty: number; subtotal: number; tax: number; total: number } | null;
}

/** Strip tags + decode the few HTML entities the grid emits; collapse whitespace. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Indonesian number: "31.818,18" → 31818.18 ; "30.000,00" → 30000. */
export function parseIdrNumber(s: string): number {
  const clean = text(s).replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

/** Extract the cells of one <tr> keyed by their data-col-seq. */
function cells(rowHtml: string): Record<number, string> {
  const out: Record<number, string> = {};
  const re = /<td[^>]*data-col-seq="(\d+)"[^>]*>([\s\S]*?)<\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml))) out[Number(m[1])] = m[2];
  return out;
}

export function parseCancelDetailReport(dataHtml: string): CancelDetailReport {
  const rows: CancelDetailRow[] = [];
  const rowRe = /<tr data-key="\d+">([\s\S]*?)<\/tr>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(dataHtml))) {
    const c = cells(rm[1]);
    if (c[1] === undefined && c[2] === undefined) continue;
    rows.push({
      salesNumber: text(c[1] ?? ""),
      branch: text(c[2] ?? ""),
      menu: text(c[3] ?? ""),
      menuCode: text(c[4] ?? ""),
      menuCategory: text(c[5] ?? ""),
      menuCategoryDetail: text(c[6] ?? ""),
      orderBy: text(c[7] ?? ""),
      orderTime: text(c[8] ?? ""),
      voidBy: text(c[9] ?? ""),
      voidTime: text(c[10] ?? ""),
      type: text(c[11] ?? ""),
      notes: text(c[12] ?? ""),
      qty: parseIdrNumber(c[13] ?? "0"),
      subtotal: parseIdrNumber(c[14] ?? "0"),
      serviceCharge: parseIdrNumber(c[15] ?? "0"),
      tax: parseIdrNumber(c[16] ?? "0"),
      total: parseIdrNumber(c[17] ?? "0"),
    });
  }

  const totalItems = Number(/of\s+([\d.]+)\s+items/i.exec(dataHtml)?.[1]?.replace(/\./g, "") ?? rows.length);

  // Page summary row (kv-page-summary): last 5 right-aligned cells = qty..total.
  let pageTotal: CancelDetailReport["pageTotal"] = null;
  const sum = /kv-page-summary[^>]*>([\s\S]*?)<\/tr>/i.exec(dataHtml)?.[1];
  if (sum) {
    const nums = [...sum.matchAll(/<td[^>]*>([\d.,]+)<\/td>/g)].map((x) => parseIdrNumber(x[1]));
    if (nums.length >= 4) {
      const [qty, subtotal, , tax, total] = nums.slice(-5).length === 5 ? nums.slice(-5) : [nums[0], nums[1], 0, nums[2], nums[3]];
      pageTotal = { qty, subtotal, tax, total };
    }
  }

  return { rows, totalItems, pageTotal };
}
