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

type Session = { cookie: string; csrf: string; at: number };
let session: Session | null = null;
const TTL_MS = 30 * 60 * 1000;

function absorbCookies(jar: Map<string, string>, res: Response) {
  // Node/undici exposes multiple Set-Cookie via getSetCookie().
  const list = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const c of list) {
    const kv = c.split(";")[0];
    const i = kv.indexOf("=");
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
  }
}
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function login(): Promise<Session> {
  if (!USER || !PASS) throw new Error("ESB credentials not configured");
  const jar = new Map<string, string>();

  const g = await fetch(`${BASE}/site/login`, { headers: { Accept: "text/html" }, cache: "no-store" });
  absorbCookies(jar, g);
  const loginHtml = await g.text();
  const csrf = CSRF_META.exec(loginHtml)?.[1] ?? CSRF_INPUT.exec(loginHtml)?.[1];
  if (!csrf) throw new Error("ESB: CSRF token not found on login page");

  const body = new URLSearchParams({ "_csrf-esb-fnb-backend": csrf, username: USER, password: PASS, challengeToken: "" });
  const p = await fetch(`${BASE}/site/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "X-Csrf-Token": csrf,
      Cookie: cookieHeader(jar),
      Referer: `${BASE}/site/login`,
    },
    body,
    cache: "no-store",
  });
  absorbCookies(jar, p);
  if (!jar.has("_jwt-token") && !jar.has("_identity")) {
    throw new Error("ESB login failed — check ESB_USERNAME / ESB_PASSWORD");
  }

  // Fresh CSRF token for the authenticated session (used as X-Csrf-Token header).
  const rp = await fetch(`${BASE}/report/report-cancel-menu-detail`, { headers: { Accept: "text/html", Cookie: cookieHeader(jar) }, cache: "no-store" });
  absorbCookies(jar, rp);
  const csrf2 = CSRF_META.exec(await rp.text())?.[1] ?? csrf;

  return { cookie: cookieHeader(jar), csrf: csrf2, at: Date.now() };
}

async function ensureSession(): Promise<Session> {
  if (session && Date.now() - session.at < TTL_MS) return session;
  session = await login();
  return session;
}

/** Authenticated form POST that re-logs in once on session expiry. */
async function postForm(path: string, params: Record<string, string>): Promise<Response> {
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
      body: new URLSearchParams(params),
      cache: "no-store",
    });
  let res = await call(await ensureSession());
  if (res.status === 401 || res.status === 403 || res.status === 302) {
    session = null; // expired → re-login once
    res = await call(await ensureSession());
  }
  return res;
}

/**
 * Step 1 — generate the Cancel/Void export for the given filters (date range,
 * branch, type, …). Returns the internal OSS file URL that step 2 reads.
 * Filter FIELD NAMES come from the ESB report form (report-cancel-menu-detail).
 */
export async function esbGenerateCancelExport(filters: Record<string, string>): Promise<string> {
  const res = await postForm("/report/report-cancel-menu-detail", filters);
  if (!res.ok) throw new Error(`ESB report-cancel-menu-detail failed (${res.status})`);
  const json = (await res.json()) as { status?: number; data?: string };
  if (!json?.data) throw new Error("ESB: export URL missing in report response");
  return json.data;
}

/** Step 2 — read ONE page (0-indexed) of a generated export via the grid proxy. */
export async function esbReadExportPage(url: string, page: number): Promise<CancelDetailReport> {
  const res = await postForm("/report_service/main/get-data-report", { url, page: String(page) });
  if (!res.ok) throw new Error(`ESB get-data-report failed (${res.status})`);
  const json = (await res.json()) as { code?: number; data?: string };
  return parseCancelDetailReport(json.data ?? "");
}

/** Read ALL pages of an export and concatenate the rows (50/page, capped). */
export async function esbReadAllRows(url: string): Promise<CancelDetailRow[]> {
  const first = await esbReadExportPage(url, 0);
  const rows = [...first.rows];
  const pages = Math.min(40, Math.ceil(first.totalItems / 50));
  for (let p = 1; p < pages; p++) {
    const r = await esbReadExportPage(url, p);
    rows.push(...r.rows);
  }
  return rows;
}

/** End-to-end: generate the export for `filters`, then read every row. */
export async function esbFetchCancelRows(filters: Record<string, string>): Promise<CancelDetailRow[]> {
  const url = await esbGenerateCancelExport(filters);
  return esbReadAllRows(url);
}
