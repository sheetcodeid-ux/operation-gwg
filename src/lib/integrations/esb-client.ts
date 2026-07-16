import "server-only";

import { parseCancelDetailReport, type CancelDetailReport, type CancelDetailRow } from "./esb";

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

type Session = { cookie: string; csrf: string; postUserSession: string; at: number };
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

  return { cookie: cookieHeader(jar), csrf: csrf2, postUserSession, at: Date.now() };
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
 * Branch, Cancel+Void). Returns the internal OSS file URL that step 2 reads.
 * Field names/values captured from the ESB report form.
 */
async function generateExport(dateFromYmd: string, dateToYmd: string): Promise<string> {
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
    [`${P}[typeVoid]`]: "Cancel / Void (Default)",
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

/** Extract the `data` HTML from a get-data-report response. ESB sometimes emits
 *  INVALID JSON (literal newlines inside the string), so fall back to a regex +
 *  manual unescape when JSON.parse fails. Returns "" when there's no data field
 *  (e.g. the {code:404,"try again later"} "still generating" response). */
function extractReportData(text: string): string {
  try {
    const j = JSON.parse(text) as { data?: unknown };
    if (typeof j.data === "string") return j.data;
  } catch {
    /* malformed JSON — handled below */
  }
  const m = /"data"\s*:\s*"([\s\S]*?)"\s*\}\s*$/.exec(text.trim());
  if (!m) return "";
  return m[1]
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** Poke the report queue (what the browser polls after generating) so ESB's
 *  worker advances the async export. Best-effort; errors are ignored. */
async function pokeQueue(): Promise<void> {
  try {
    const s = await ensureSession();
    const qs = new URLSearchParams({ draw: "1", start: "0", length: "10", _: String(Date.now()) });
    await fetch(`${BASE}/report_service/main/get-data-report-queue?${qs.toString()}`, {
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
    // with status 200, so inspect the body too before deciding it's ready.
    const text = await res.text().catch(() => "");
    if (res.ok && !/"code"\s*:\s*(404|425|202)/.test(text)) {
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
}

/**
 * End-to-end: generate the Cancel/Void export for a date range and read every
 * page (50 rows/page, capped at 40 pages ≈ 2000 line-items). Returns diagnostic
 * counts alongside the rows so a silent 0 can be explained.
 */
export async function esbFetchCancelRows(dateFromYmd: string, dateToYmd: string): Promise<EsbCancelResult> {
  const url = await generateExport(dateFromYmd, dateToYmd);
  await pokeQueue(); // kick the queue worker before the first read
  const first = await readExportPage(url, 0, 16, true); // page 0 waits for the async export
  const rows = [...first.report.rows];
  const pages = Math.min(40, Math.ceil(first.report.totalItems / 50));
  for (let p = 1; p < pages; p++) {
    const r = await readExportPage(url, p, 4); // file is ready now — short retry
    rows.push(...r.report.rows);
  }
  return { rows, totalItems: first.report.totalItems, rawLen: first.rawLen };
}
