import "server-only";

import { parseCancelDetailReport, type CancelDetailReport } from "./esb";

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

/**
 * POST the report grid endpoint with the given form params and parse the result.
 * Params are the report's filter/pagination fields (report id, date range,
 * branch, type, page) — the exact field names come from the ESB report form.
 */
export async function esbGetDataReport(params: Record<string, string>): Promise<CancelDetailReport> {
  const call = (s: Session) =>
    fetch(`${BASE}/report_service/main/get-data-report`, {
      method: "POST",
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
  if (res.status === 401 || res.status === 403) {
    session = null; // session expired → re-login once
    res = await call(await ensureSession());
  }
  if (!res.ok) throw new Error(`ESB get-data-report failed (${res.status})`);
  const json = (await res.json()) as { code?: number; data?: string };
  return parseCancelDetailReport(json.data ?? "");
}
