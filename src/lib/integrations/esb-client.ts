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

async function login(): Promise<Session> {
  if (!USER || !PASS) throw new Error("ESB credentials not configured");
  const jar = new Map<string, string>();

  const g = await fetch(`${BASE}/site/login`, { headers: { Accept: "text/html" }, cache: "no-store" });
  const nGet = absorbCookies(jar, g);
  const loginHtml = await g.text();
  const csrf = CSRF_META.exec(loginHtml)?.[1] ?? CSRF_INPUT.exec(loginHtml)?.[1];
  if (!csrf) throw new Error(`ESB: CSRF token not found (GET ${g.status}, setCookie=${nGet}, cookies=[${[...jar.keys()].join(",")}])`);

  // Plain browser-style form POST (NOT XHR) so Yii performs the real login and
  // returns the auth cookies via a 302 — an X-Requested-With here would trigger
  // ajax validation only and set no session.
  const body = new URLSearchParams({ "_csrf-esb-fnb-backend": csrf, username: USER, password: PASS, challengeToken: "" });
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
    const snippet = pBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(
      `ESB login failed [GET ${g.status} csrf=${csrf ? "y" : "n"} setCookieGET=${nGet}; POST ${p.status} loc=${loc ?? "-"} setCookiePOST=${nPost}; jar=[${[...jar.keys()].join(",")}]; body: ${snippet}]`,
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

/** Step 2 — read ONE page (0-indexed) of a generated export via the grid proxy. */
async function readExportPage(url: string, page: number): Promise<CancelDetailReport> {
  const res = await postForm("/report_service/main/get-data-report", () => ({ url, page: String(page) }));
  if (!res.ok) throw new Error(`ESB get-data-report failed (${res.status})`);
  const json = (await res.json()) as { code?: number; data?: string };
  return parseCancelDetailReport(json.data ?? "");
}

/**
 * End-to-end: generate the Cancel/Void export for a date range and read every
 * page (50 rows/page, capped at 40 pages ≈ 2000 line-items).
 */
export async function esbFetchCancelRows(dateFromYmd: string, dateToYmd: string): Promise<CancelDetailRow[]> {
  const url = await generateExport(dateFromYmd, dateToYmd);
  const first = await readExportPage(url, 0);
  const rows = [...first.rows];
  const pages = Math.min(40, Math.ceil(first.totalItems / 50));
  for (let p = 1; p < pages; p++) {
    const r = await readExportPage(url, p);
    rows.push(...r.rows);
  }
  return rows;
}
