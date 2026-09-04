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
  /** Rows per page, from "Showing 1-N of …" — VARIES per grid (Cancel/Void
   *  pages 50 rows, the Delete grid only 20). Never assume. */
  pageSize: number;
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
/**
 * Baca balasan ESB sebagai JSON, dengan pesan yang bisa dimengerti orang.
 *
 * `res.json()` polos melempar "Unexpected token '<', \"<body styl\"... is not
 * valid JSON". Pesan itu benar secara teknis dan tidak berguna sama sekali:
 * pernah tampil apa adanya sebagai notifikasi di layar Coordinator Area yang
 * membuka Fraud Analysis — tidak menjelaskan apa yang terjadi, tidak
 * menyarankan apa pun. Yang lebih buruk, ia MEMBUANG badan aslinya, padahal
 * itulah satu-satunya bukti kenapa ESB membalas begitu.
 *
 * Di sini badannya disimpan: kalimat pertama untuk pengguna, cuplikan mentah di
 * belakang kurung siku untuk penelusuran. `pesanRingkas()` yang memotong
 * ekornya saat ditampilkan, jadi jejak galat tetap menerima semuanya.
 *
 * Tinggal di modul ini, bukan di esb-client, karena ini murni soal membaca teks
 * — tanpa jaringan dan tanpa kredensial, sehingga bisa diuji langsung.
 */
export function bacaJsonEsb<T>(teks: string, konteks: string): T {
  try {
    return JSON.parse(teks) as T;
  } catch {
    const bersih = teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    const halaman = /^\s*<|<body|<html|<!doctype/i.test(teks);
    throw new Error(
      halaman
        ? `ESB membalas halaman web, bukan data — biasanya karena ESB sedang bermasalah atau dalam pemeliharaan. Coba lagi beberapa menit lagi. [${konteks}] isi: ${bersih || "(kosong)"}`
        : `ESB membalas format yang tidak dikenali. [${konteks}] isi: ${bersih || "(kosong)"}`,
    );
  }
}

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
  // "Showing 1-20 of 716 items" → 20 rows/page. Fall back to the parsed row
  // count (a full first page equals the page size on multi-page grids).
  const showingTo = Number(/Showing\s+[\d.]+\s*-\s*([\d.]+)\s+of/i.exec(dataHtml)?.[1]?.replace(/\./g, "") ?? 0);
  const pageSize = showingTo > 0 ? showingTo : Math.max(rows.length, 1);

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

  return { rows, totalItems, pageSize, pageTotal };
}

/* -------------------- Sales Menu Recapitulation report -------------------- */

export interface MenuRecapRow {
  category: string; // Menu Category
  categoryDetail: string; // Menu Category Detail
  menu: string; // Menu name
  menuCode: string;
  qty: number;
  unitPrice: number; // pre-tax unit price — comparable to HPP harga jual (tanpa pajak)
  grandTotal: number; // incl tax
}

export interface MenuRecapReport {
  rows: MenuRecapRow[];
  totalItems: number;
  pageSize: number;
}

/** Parse the Sales Menu Recapitulation grid (header-aware, rowspan-tolerant).
 *  Columns (verified from HAR): 2 Category, 3 Category Detail, 4 Menu,
 *  7 Menu Code, 11 Qty, 12 Unit Price, 20 Grand Total. */
export function parseMenuRecapReport(dataHtml: string): MenuRecapReport {
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
    category: idx(/^menu\s*category$/i, 2),
    categoryDetail: idx(/category\s*detail/i, 3),
    menu: idx(/^menu$/i, 4),
    menuCode: idx(/^menu\s*code$/i, 7),
    qty: idx(/^qty$/i, 11),
    unitPrice: idx(/unit\s*price/i, 12),
    grandTotal: idx(/grand\s*total/i, 20),
  };

  const rows: MenuRecapRow[] = [];
  const rowRe = /<tr\b[^>]*\bdata-key=["'][^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  let prev: MenuRecapRow | null = null;
  while ((rm = rowRe.exec(dataHtml))) {
    const c = cells(rm[1]);
    if (Object.keys(c).length === 0) continue;
    const str = (i: number, inherited: string) => (c[i] === undefined ? inherited : text(c[i]));
    const row: MenuRecapRow = {
      category: str(I.category, prev?.category ?? ""),
      categoryDetail: str(I.categoryDetail, prev?.categoryDetail ?? ""),
      menu: str(I.menu, prev?.menu ?? ""),
      menuCode: str(I.menuCode, prev?.menuCode ?? ""),
      qty: parseIdrNumber(c[I.qty] ?? "0"),
      unitPrice: parseIdrNumber(c[I.unitPrice] ?? "0"),
      grandTotal: parseIdrNumber(c[I.grandTotal] ?? "0"),
    };
    if (!row.menu) continue; // skip summary/blank rows
    rows.push(row);
    prev = row;
  }

  const totalItems = Number(/of\s+([\d.]+)\s+items/i.exec(dataHtml)?.[1]?.replace(/\./g, "") ?? rows.length);
  const showingTo = Number(/Showing\s+[\d.]+\s*-\s*([\d.]+)\s+of/i.exec(dataHtml)?.[1]?.replace(/\./g, "") ?? 0);
  const pageSize = showingTo > 0 ? showingTo : Math.max(rows.length, 1);
  return { rows, totalItems, pageSize };
}

/** Classify an ESB menu category as food or beverage (heuristic on category
 *  text — beverage keywords win, else food). */
export function classifyMenuCategory(category: string, detail = ""): "makanan" | "minuman" {
  const s = `${category} ${detail}`.toLowerCase();
  if (/(beverage|drink|minuman|coffee|kopi|\btea\b|\bteh\b|juice|jus|milk|susu|frappe|latte|espresso|non[- ]?coffee|mocktail|smoothie|boba)/.test(s)) return "minuman";
  return "makanan";
}


/* -------------------- Sales Dashboard highlight -------------------- */

/**
 * Satu kotak angka di Sales Dashboard ESB (`get-today-highlight`).
 *
 * Nama fieldnya dipastikan dari respons sungguhan, bukan ditebak:
 * `{"currentSales":"148.530.679","currentDailyGrossSales":"161.776.400",
 *   "paxTotal":"2.941","averageNetSalesPerPax":"50.504",
 *   "numberOfBill":"2.777","averageNetSalesPerBill":"53.487"}`
 */
export interface EsbHighlight {
  /** Net sales — angka di kotak NET SALES. */
  net: number;
  /** Gross sales harian. */
  gross: number;
  /** Jumlah tamu (PAX TOTAL). */
  pax: number;
  /** Jumlah struk (NUMBER OF BILL). */
  bills: number;
  /** Rata-rata net sales per struk — inilah Average Transaction. */
  perBill: number;
  /** Rata-rata net sales per tamu. */
  perPax: number;
}

/**
 * Membaca respons highlight menjadi angka.
 *
 * Seluruh nilainya datang sebagai TEKS berformat Indonesia ("148.530.679");
 * `Number()` atas teks itu menghasilkan NaN, dan NaN yang lolos akan tampil
 * sebagai capaian kosong tanpa satu pun pesan salah. Karena itu semuanya lewat
 * `parseIdrNumber`.
 *
 * Field yang tidak ada dibaca nol — cabang yang tidak beraktivitas pada rentang
 * itu memang datang tanpa fieldnya, dan itu nol yang sah, bukan kegagalan.
 */
export function bacaHighlight(j: Record<string, unknown>): EsbHighlight {
  const num = (v: unknown) => (v === undefined || v === null || v === "" ? 0 : typeof v === "number" ? v : parseIdrNumber(String(v)));
  const net = num(j.currentSales);
  const gross = num(j.currentDailyGrossSales);
  const bills = num(j.numberOfBill);
  const pax = num(j.paxTotal);
  return {
    net,
    // Gross yang tidak terbaca dijatuhkan ke net, bukan ke nol: nol akan
    // terbaca sebagai "tidak ada penjualan sama sekali" di grafik musiman.
    gross: gross > 0 ? gross : net,
    pax,
    bills,
    // Angka rata-ratanya dipakai apa adanya bila ada; kalau tidak, dihitung
    // sendiri dari net dan jumlah struk — hasilnya sama.
    perBill: num(j.averageNetSalesPerBill) || (bills > 0 ? net / bills : 0),
    perPax: num(j.averageNetSalesPerPax) || (pax > 0 ? net / pax : 0),
  };
}
