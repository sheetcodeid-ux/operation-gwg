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
  const re = /<td\b[^>]*\bdata-col-seq=["'](\d+)["'][^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml))) out[Number(m[1])] = m[2];
  return out;
}

/** Decode one level of JSON-string escaping (\\ \" \/ \n \r \t) manually —
 *  used when the payload is not valid JSON so JSON.parse can't do it. */
function unescapeJsonString(s: string): string {
  return s
    .replace(/\\\\/g, "\u0000") // protect escaped backslashes first
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\u0000/g, "\\");
}

/**
 * Extract the `data` HTML from a get-data-report response. ESB is inconsistent:
 *  - sometimes valid JSON  {code,data};
 *  - sometimes INVALID JSON (literal newlines inside the data string);
 *  - sometimes DOUBLE-ENCODED — the whole body is a JSON *string* containing
 *    the {code,data} JSON ("{\"code\":200,\"data\":\"…\"}").
 * Handles all three (recursively unwrapping up to 3 layers). Returns "" when
 * there's no data field (e.g. the {code:404,"try again later"} response).
 */
export function extractReportData(text: string, depth = 0): string {
  if (depth > 3) return "";
  try {
    const j = JSON.parse(text) as unknown;
    if (typeof j === "string") return extractReportData(j, depth + 1); // double-encoded
    const d = (j as { data?: unknown } | null)?.data;
    if (typeof d === "string") return d;
    if (j && typeof j === "object") return ""; // parsed fine, no data (e.g. code:404)
  } catch {
    /* malformed JSON — fall through to manual extraction */
  }
  // Malformed single-encoded: {"data":"…"} with raw newlines inside the string.
  const km = /"data"\s*:\s*"/.exec(text);
  if (km) {
    const from = km.index + km[0].length;
    const end = text.lastIndexOf('"'); // closing quote of the data value (trailing is just "})
    if (end > from) return unescapeJsonString(text.slice(from, end));
    return "";
  }
  // Malformed double-encoded: quoted body whose inner JSON is itself broken —
  // visible as \"data\":\" . Strip the outer quotes, unescape once, recurse.
  if (/\\"data\\"\s*:\s*\\"/.test(text)) {
    const t = text.trim();
    const body = t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
    return extractReportData(unescapeJsonString(body), depth + 1);
  }
  return "";
}

export function parseCancelDetailReport(dataHtml: string): CancelDetailReport {
  const rows: CancelDetailRow[] = [];

  // Column layout DIFFERS between the Cancel/Void export and the Delete export,
  // so resolve each field from the grid's <th> HEADER LABELS when present. The
  // fixed data-col-seq positions (documented above) are only a fallback for
  // grids whose headers can't be read. When headers ARE readable, a field whose
  // label isn't found is treated as absent (-1) — never guessed by position.
  const headers: Record<number, string> = {};
  const thRe = /<th\b[^>]*\bdata-col-seq=["'](\d+)["'][^>]*>([\s\S]*?)<\/th>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = thRe.exec(dataHtml))) headers[Number(hm[1])] = text(hm[2]);
  const hasHeaders = Object.keys(headers).length > 0;
  const idx = (re: RegExp, fallback: number) => {
    const hit = Object.entries(headers).find(([, label]) => re.test(label));
    return hit ? Number(hit[0]) : hasHeaders ? -1 : fallback;
  };
  const I = {
    salesNumber: idx(/sales/i, 1),
    branch: idx(/branch|outlet/i, 2),
    menu: idx(/^menu(\s*name)?$/i, 3),
    menuCode: idx(/^menu\s*code$/i, 4),
    menuCategory: idx(/^menu\s*category$/i, 5),
    menuCategoryDetail: idx(/category\s*detail/i, 6),
    orderBy: idx(/^order\s*by$/i, 7),
    orderTime: idx(/^order\s*(time|date)$/i, 8),
    voidBy: idx(/(cancel|void|delete|remove)[^]*?by/i, 9),
    voidTime: idx(/(cancel|void|delete|remove)[^]*?(time|date)/i, 10),
    type: idx(/^(cancel\s*\/\s*void|cancel\/void|type|status)$/i, 11),
    notes: idx(/note|reason/i, 12),
    qty: idx(/^qty$/i, 13),
    subtotal: idx(/^(sub\s*total|price|amount)$/i, 14),
    serviceCharge: idx(/service/i, 15),
    tax: idx(/^tax$/i, 16),
    total: idx(/^total$/i, 17),
  };

  // Tolerant of extra attributes / quote style on the <tr> (live grid differs
  // slightly from a minimal capture).
  const rowRe = /<tr\b[^>]*\bdata-key=["'][^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  // Krajee grids GROUP bill-level columns with rowspan: from the 2nd item of a
  // bill onward those <td>s are simply absent from the row. An absent string
  // cell therefore inherits the previous row's value (rowspan semantics) —
  // skipping such rows lost ~58% of items in production. Numeric cells never
  // inherit (that would double-count money); absent means 0.
  let prev: CancelDetailRow | null = null;
  while ((rm = rowRe.exec(dataHtml))) {
    const c = cells(rm[1]);
    if (Object.keys(c).length === 0) continue; // no data cells at all — not an item row
    const str = (idx: number, inherited: string) => (c[idx] === undefined ? inherited : text(c[idx]));
    const qty = parseIdrNumber(c[I.qty] ?? "0");
    const subtotal = parseIdrNumber(c[I.subtotal] ?? "0");
    const serviceCharge = parseIdrNumber(c[I.serviceCharge] ?? "0");
    const tax = parseIdrNumber(c[I.tax] ?? "0");
    // Delete grids have no Total column — derive it so nominal never shows 0.
    const total = parseIdrNumber(c[I.total] ?? "0") || subtotal + serviceCharge + tax;
    const row: CancelDetailRow = {
      salesNumber: str(I.salesNumber, prev?.salesNumber ?? ""),
      branch: str(I.branch, prev?.branch ?? ""),
      menu: str(I.menu, ""),
      menuCode: str(I.menuCode, ""),
      menuCategory: str(I.menuCategory, ""),
      menuCategoryDetail: str(I.menuCategoryDetail, ""),
      orderBy: str(I.orderBy, prev?.orderBy ?? ""),
      orderTime: str(I.orderTime, prev?.orderTime ?? ""),
      voidBy: str(I.voidBy, prev?.voidBy ?? ""),
      voidTime: str(I.voidTime, prev?.voidTime ?? ""),
      type: str(I.type, prev?.type ?? ""),
      notes: str(I.notes, prev?.notes ?? ""),
      qty,
      subtotal,
      serviceCharge,
      tax,
      total,
    };
    rows.push(row);
    prev = row;
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
