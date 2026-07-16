import "server-only";

import { extractReportData, parseCancelDetailReport, parseIdrNumber, type CancelDetailReport, type CancelDetailRow } from "./esb";

/**
 * Authenticated ESB (erp.esb.co.id) client — runs SERVER-SIDE only, logging in
 * with a service account from env (never from a developer machine, never with
 * hardcoded cookies).
 *
 * Auth flow (Yii2 + CSRF), confirmed from the login page:
 *  1. GET  /site/login            → session cookie + CSRF token (<meta name="csrf-token">).
 *  2. POST /site/login            → _csrf-esb-fnb-backend + username + password + challengeToken;
 *                                   success sets _jwt-token / _identity cookies.
 *  3. GET  /report/report-cancel-menu-detail → fresh CSRF meta for data calls.
 * Data:
 *     POST /report_service/main/get-data-report (form-urlencoded, X-Csrf-Token +
 *     X-Requested-With) → { code, data: "<grid html>" } → parseCancelDetailReport.
 *
 * Env: ESB_BASE_URL (default https://erp.esb.co.id), ESB_USERNAME, ESB_PASSWORD.
 * Prefer a DEDICATED limited report account, not MASTER ADMIN.
 */

const BASE = (process.env.ESB_BASE_URL || "https://erp.esb.co.id").replace(/\/$/, "");
const USER = process.env.ESB_USERNAME;
const PASS = process.env.ESB_PASSWORD;

export const esbConfigured = () => !!(USER && PASS);

const CSRF_META = /name="csrf-token"\s+content="([^"]+)"/;
const CSRF_INPUT = /"_csrf-esb-fnb-backend"\s+value="([^"]+)"/;
// POST_USER_SESSION is a per-session anti-replay token embedded in the report
// page (hidden input or a JS assignment) — echoed back in the report POST body.
const POST_SESSION = /POST_USER_SESSION["']?\s*(?:value=|[:=])\s*["']([a-zA-Z0-9]+)["']/;

type TypeVoidOption = { value: string; label: string };
type Session = { cookie: string; csrf: string; postUserSession: string; typeVoidOptions: TypeVoidOption[]; at: number };
let session: Session | null = null;
const TTL_MS = 30 * 60 * 1000;

function absorbCookies(jar: Map<string, string>, res: Response): number {
  // Node/undici exposes multiple Set-Cookie via getSetCookie(); fall back to the
  // (possibly comma-joined) single header on runtimes that lack it.
  let list = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (list.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) list = single.split(/,(?=\s*[A-Za-z0-9_.-]+=)/);
  }
  for (const c of list) {
    const kv = c.split(";")[0];
    const i = kv.indexOf("=");
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
  return list.length;
}
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** All <input name=value> pairs on a page (skips submit/button) — used to submit
 *  the login form with EXACTLY the fields it expects (hidden csrf/challenge/…). */
function parseInputs(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const name = /\bname="([^"]*)"/.exec(tag)?.[1];
    if (!name) continue;
    const type = /\btype="([^"]*)"/.exec(tag)?.[1]?.toLowerCase();
    if (type === "submit" || type === "button") continue;
    out[name] = decodeEntities(/\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
  }
  return out;
}

async function login(): Promise<Session> {
  if (!USER || !PASS) throw new Error("ESB credentials not configured");
  const jar = new Map<string, string>();

  const g = await fetch(`${BASE}/site/login`, { headers: { Accept: "text/html" }, cache: "no-store" });
  const nGet = absorbCookies(jar, g);
  const loginHtml = await g.text();
  const csrf = CSRF_META.exec(loginHtml)?.[1] ?? CSRF_INPUT.exec(loginHtml)?.[1];
  if (!csrf) throw new Error(`ESB: CSRF token not found (GET ${g.status}, setCookie=${nGet}, cookies=[${[...jar.keys()].join(",")}])`);

  // Submit EXACTLY the login form's fields (every hidden input: csrf, challenge
  // token, feature flags, …), overriding only the credentials — so nothing the
  // server validates is missing. Plain browser-style POST (not XHR).
  const fields = parseInputs(loginHtml);
  const userKey = Object.keys(fields).find((k) => /username/i.test(k)) ?? "username";
  const passKey = Object.keys(fields).find((k) => /password/i.test(k)) ?? "password";
  fields[userKey] = USER;
  fields[passKey] = PASS;
  if (!fields["_csrf-esb-fnb-backend"]) fields["_csrf-esb-fnb-backend"] = csrf;
  const body = new URLSearchParams(fields);
  const p = await fetch(`${BASE}/site/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "text/html",
      Cookie: cookieHeader(jar),
      Referer: `${BASE}/site/login`,
    },
    body,
    cache: "no-store",
  });
  const nPost = absorbCookies(jar, p);
  const pBody = await p.text().catch(() => "");
  // On success Yii 302-redirects; follow it once (with cookies) in case the auth
  // cookies are only set on the redirected response.
  const loc = p.headers.get("location");
  if (!jar.has("_jwt-token") && !jar.has("_identity") && loc && (p.status === 301 || p.status === 302)) {
    const f = await fetch(new URL(loc, BASE).toString(), { headers: { Cookie: cookieHeader(jar), Accept: "text/html" }, redirect: "manual", cache: "no-store" });
    absorbCookies(jar, f);
  }
  if (!jar.has("_jwt-token") && !jar.has("_identity")) {
    const err = /class="[^"]*help-block[^"]*"[^>]*>([^<]+)</i.exec(pBody)?.[1]?.trim();
    const snippet = pBody.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(
      `ESB login failed [POST ${p.status} loc=${loc ?? "-"} setCookiePOST=${nPost}; sent=[${Object.keys(fields).join(",")}]; err=${err ?? "-"}; body: ${snippet}]`,
    );
  }

  // Fresh CSRF + POST_USER_SESSION from the authenticated report page.
  const rp = await fetch(`${BASE}/report/report-cancel-menu-detail`, { headers: { Accept: "text/html", Cookie: cookieHeader(jar) }, cache: "no-store" });
  absorbCookies(jar, rp);
  const rpHtml = await rp.text();
  const csrf2 = CSRF_META.exec(rpHtml)?.[1] ?? csrf;
  const postUserSession = POST_SESSION.exec(rpHtml)?.[1] ?? "";

  // The report form's "Type Void" <select> options (e.g. "Cancel / Void
  // (Default)", "Deleted Item") — read value AND label from the live page so
  // the exact values ESB expects are used instead of hardcoded guesses.
  const typeVoidSel = /<select[^>]*name=["']CancelMenuDetailReport\[typeVoid\]["'][\s\S]*?<\/select>/i.exec(rpHtml)?.[0] ?? "";
  const typeVoidOptions = [...typeVoidSel.matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)]
    .map((m) => ({ value: decodeEntities(m[1]), label: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim() }))
    .filter((o) => o.value);

  return { cookie: cookieHeader(jar), csrf: csrf2, postUserSession, typeVoidOptions, at: Date.now() };
}

async function ensureSession(): Promise<Session> {
  if (session && Date.now() - session.at < TTL_MS) return session;
  session = await login();
  return session;
}

/** Authenticated form POST; body is built from the session so CSRF/POST_USER_
 *  SESSION always match the session actually used (incl. after a re-login). */
async function postForm(path: string, build: (s: Session) => Record<string, string>): Promise<Response> {
  const call = (s: Session) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "X-Csrf-Token": s.csrf,
        Cookie: s.cookie,
        Referer: `${BASE}/report/report-cancel-menu-detail`,
      },
      body: new URLSearchParams(build(s)),
      cache: "no-store",
    });
  let res = await call(await ensureSession());
  if (res.status === 401 || res.status === 403 || res.status === 302) {
    session = null; // expired → re-login once
    res = await call(await ensureSession());
  }
  return res;
}

/** YYYY-MM-DD → DD-MM-YYYY (the format the ESB report form expects). */
const toEsbDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-");
  return `${d}-${m}-${y}`;
};

/**
 * Step 1 — generate the Cancel/Void export for a date range (YYYY-MM-DD, All
 * Branch) with the given Type Void filter value. Returns the internal OSS file
 * URL that step 2 reads. Field names/values captured from the ESB report form.
 */
async function generateExport(dateFromYmd: string, dateToYmd: string, typeVoid: string): Promise<string> {
  const from = toEsbDate(dateFromYmd);
  const to = toEsbDate(dateToYmd);
  const P = "CancelMenuDetailReport";
  const res = await postForm("/report/report-cancel-menu-detail", (s) => ({
    "_csrf-esb-fnb-backend": s.csrf,
    [`${P}[reportDate]`]: `${from} - ${to}`,
    [`${P}[dateFrom]`]: from,
    [`${P}[dateTo]`]: to,
    [`${P}[salesNum]`]: "",
    [`${P}[selectedBranchText]`]: "All Branch",
    [`${P}[branchID]`]: "",
    [`${P}[menuName]`]: "",
    [`${P}[visitPurposeID]`]: "",
    [`${P}[statusCancelFilter]`]: "all",
    [`${P}[menuCategory]`]: "",
    [`${P}[menuCategoryDetail]`]: "",
    [`${P}[menuCode]`]: "",
    [`${P}[typeVoid]`]: typeVoid,
    [`${P}[cancelNotes]`]: "",
    [`${P}[isPreviewBill]`]: "1",
    POST_USER_SESSION: s.postUserSession,
  }));
  if (!res.ok) throw new Error(`ESB report-cancel-menu-detail failed (${res.status})`);
  const json = (await res.json()) as { status?: number; data?: string };
  if (!json?.data) throw new Error("ESB: export URL missing in report response");
  return json.data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poke the report queue (what the browser polls after generating) so ESB's
 *  worker advances the async export. Path verified from a HAR capture:
 *  GET /site/get-data-report-queue (DataTables-style). Best-effort. */
async function pokeQueue(): Promise<void> {
  try {
    const s = await ensureSession();
    const qs = new URLSearchParams({ draw: "1", start: "0", length: "10", _: String(Date.now()) });
    await fetch(`${BASE}/site/get-data-report-queue?${qs.toString()}`, {
      headers: { "X-Requested-With": "XMLHttpRequest", "X-Csrf-Token": s.csrf, Cookie: s.cookie, Referer: `${BASE}/report/report-cancel-menu-detail`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    /* best effort */
  }
}

/** Step 2 — read ONE page (0-indexed) of a generated export via the grid proxy.
 *  The export is produced asynchronously, so a just-generated file can 404 for a
 *  moment — retry a few times with a short delay before giving up. */
async function readExportPage(url: string, page: number, maxAttempts = 22, poke = false): Promise<{ report: CancelDetailReport; rawLen: number }> {
  let last = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await postForm("/report_service/main/get-data-report", () => ({ url, page: String(page) }));
    // ESB signals "still generating" as HTTP 404 AND as a JSON body {code:404}
    // with status 200, so inspect the body too before deciding it's ready. The
    // body can be double-encoded (\"code\":404), hence the optional backslash.
    const text = await res.text().catch(() => "");
    if (res.ok && !/\\?"code\\?"\s*:\s*(404|425|202)/.test(text)) {
      const data = extractReportData(text);
      if (data) return { report: parseCancelDetailReport(data), rawLen: data.length };
    }
    last = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
    if (attempt < maxAttempts - 1) {
      if (poke) await pokeQueue(); // advance the async worker like the browser does
      await sleep(2000); // export still generating — "try again later"
      continue;
    }
    throw new Error(`ESB get-data-report failed (${res.status}) url=…${decodeURIComponent(url).slice(-60)} body:${last}`);
  }
  throw new Error("ESB get-data-report: export not ready after retries");
}

export interface EsbCancelResult {
  rows: CancelDetailRow[];
  totalItems: number; // from the grid's "Showing 1-N of X"
  rawLen: number; // length of the first page's HTML (0 ⇒ empty/blocked response)
  /** Every page of the export was read (rows cover ESB's full item count). */
  readAll: boolean;
  /** The grid's summary row = GRAND totals of the WHOLE requested range
   *  (verified: its subtotal equals ESB's dashboard tile) — self-validation. */
  pageTotal: { qty: number; subtotal: number; tax: number; total: number } | null;
  /** false ⇒ the requested Type Void filter wasn't offered by the ESB form and
   *  the DEFAULT export was fetched instead — caller must filter rows by type. */
  typeVoidFound: boolean;
  /** Type Void options detected on the ESB report form (for diagnostics). */
  typeVoidOptions: string[];
}

/** Which ESB "Type Void" export to generate: the default Cancel+Void report,
 *  or the deleted-order report (orders removed before settle — shows who). */
export type EsbExportKind = "default" | "delete";

/**
 * ESB serves ONE export per session at a time: concurrent generate/read calls
 * make it hand back the WRONG file (verified in production — paired days got
 * each other's exports and page reads returned ~40% foreign rows). Every
 * export fetch therefore runs through this strict serial queue.
 */
let esbQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = esbQueue.then(fn, fn);
  esbQueue = run.catch(() => {});
  return run;
}

/**
 * End-to-end: generate the Cancel/Void (or deleted-order) export for a date
 * range and read every page (50 rows/page, capped at 16.000 line-items).
 * Returns diagnostic counts alongside the rows so a silent 0 can be explained.
 *
 * For kind "delete": the Type Void option is matched from the LIVE form
 * (anything named delete/remove). If the form has no such option, the DEFAULT
 * export is fetched instead with `typeVoidFound: false` so the caller can
 * filter rows by type — deleted items may ride along in the default report.
 */
export function esbFetchCancelRows(dateFromYmd: string, dateToYmd: string, kind: EsbExportKind = "default"): Promise<EsbCancelResult> {
  return serialized(async () => {
    const opts = (await ensureSession()).typeVoidOptions;
    const pick = (re: RegExp) => opts.find((o) => re.test(o.label) || re.test(o.value));
    const fallback = pick(/default/i)?.value ?? opts[0]?.value ?? "Cancel / Void (Default)";
    // Deleted items are "Removed Before Save" in ESB (verified from a live form
    // capture) — prefer that exact option, then any delete/remove-ish label. An
    // unknown value here made ESB drop the WHOLE filter set (dates included), so
    // when the select couldn't be parsed we still send the VERIFIED literal, but
    // report typeVoidFound=false so the caller keeps its type-column filter on.
    const delOpt = kind === "delete" ? pick(/removed?\s*before\s*save/i) ?? pick(/delete|remove|hapus/i) : undefined;
    const typeVoidFound = kind !== "delete" || !!delOpt;
    const typeVoid = kind === "delete" ? delOpt?.value ?? "Removed Before Save" : fallback;
    const url = await generateExport(dateFromYmd, dateToYmd, typeVoid);
    await pokeQueue(); // kick the queue worker before the first read
    const first = await readExportPage(url, 0, 16, true); // page 0 waits for the async export
    const rows = [...first.report.rows];
    // Pages are read STRICTLY one at a time — parallel reads made ESB shuffle
    // pages between files (~60% loss in production). A failed page is skipped,
    // never fatal: the caller compares rows.length to totalItems and warns.
    // Page size comes from the grid itself ("Showing 1-N of …"): the Delete
    // grid pages 20 rows while Cancel/Void pages 50 — assuming 50 silently
    // dropped ~58% of delete items (verified via fraud_sync bookkeeping).
    const pageSize = Math.max(1, first.report.pageSize);
    const pages = Math.min(Math.ceil(16_000 / pageSize), Math.ceil(first.report.totalItems / pageSize));
    for (let p = 1; p < pages; p++) {
      try {
        const r = await readExportPage(url, p, 6);
        rows.push(...r.report.rows);
      } catch {
        /* skipped page → readAll=false → caller retries the day later */
      }
    }
    return {
      rows,
      totalItems: first.report.totalItems,
      rawLen: first.rawLen,
      readAll: rows.length >= first.report.totalItems,
      pageTotal: first.report.pageTotal,
      typeVoidFound,
      typeVoidOptions: opts.map((o) => o.label || o.value),
    };
  });
}

/* ------------------------- Sales (omset) highlight ------------------------- */


/** Decode ESB's ajax JSON, which is usually a JSON-encoded STRING of JSON. */
function decodeAjax<T>(text: string): T | null {
  try {
    const once = JSON.parse(text) as unknown;
    if (typeof once === "string") return JSON.parse(once) as T;
    return once as T;
  } catch {
    return null;
  }
}

let companyIds: string[] | null = null;
/** company IDs the dashboard posts with every highlight call — parsed once
 *  from the sales-dashboard page (e.g. companyID[]=12370). */
async function getCompanyIds(): Promise<string[]> {
  if (companyIds) return companyIds;
  try {
    const s = await ensureSession();
    const res = await fetch(`${BASE}/sales-dashboard`, { headers: { Accept: "text/html", Cookie: s.cookie }, cache: "no-store" });
    const html = await res.text();
    const ids = new Set<string>();
    for (const m of html.matchAll(/companyID(?:\[\]|%5B%5D)?["']?\s*(?:value=|[:=,]\s*)["']?(\d{3,10})/g)) ids.add(m[1]);
    companyIds = [...ids].slice(0, 5);
  } catch {
    companyIds = [];
  }
  return companyIds;
}

export interface EsbBranch { id: string; name: string }

/** Branch list as the dashboard sees it (branchID ↔ branchName). */
export async function esbListBranches(): Promise<EsbBranch[]> {
  const s = await ensureSession();
  const body = new URLSearchParams();
  for (const c of await getCompanyIds()) body.append("companyID[]", c);
  body.append("brandID", "");
  const res = await fetch(`${BASE}/branch/get-multi-company-branch`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", "X-Csrf-Token": s.csrf, Cookie: s.cookie, Referer: `${BASE}/sales-dashboard` },
    body,
    cache: "no-store",
  });
  const list = decodeAjax<{ branchID: string; branchName: string }[]>(await res.text()) ?? [];
  return list.map((b) => ({ id: b.branchID, name: b.branchName }));
}

/** Net sales (omset) for a date range, optionally for ONE branch — the number
 *  behind the dashboard's NET SALES tile (get-today-highlight). */
export async function esbFetchNetSales(dateFromYmd: string, dateToYmd: string, branchId = ""): Promise<number> {
  const s = await ensureSession();
  const body = new URLSearchParams();
  body.append("branchID", branchId);
  body.append("brandID", "");
  body.append("reportDateStart", toEsbDate(dateFromYmd));
  body.append("reportDateEnd", toEsbDate(dateToYmd));
  for (const c of await getCompanyIds()) body.append("companyID[]", c);
  const res = await fetch(`${BASE}/sales-dashboard/get-today-highlight`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", "X-Csrf-Token": s.csrf, Cookie: s.cookie, Referer: `${BASE}/sales-dashboard` },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESB highlight failed (${res.status})`);
  const j = decodeAjax<{ currentSales?: string | number }>(await res.text());
  if (!j || j.currentSales === undefined) throw new Error("ESB highlight: currentSales missing");
  return typeof j.currentSales === "number" ? j.currentSales : parseIdrNumber(String(j.currentSales));
}
