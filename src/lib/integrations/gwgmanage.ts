import "server-only";

/**
 * Integration client for GWG Manage (gwgmanage.com).
 *
 * Auth: POST /auth/login { email, password } → { data: { accessToken, refreshToken } }.
 * Data: GET /api/reports/menu-performance?month=YYYY-MM (Bearer accessToken).
 *
 * Credentials come from env (never hardcoded) — set on Vercel:
 *   GWGMANAGE_EMAIL, GWGMANAGE_PASSWORD, [GWGMANAGE_BASE_URL]
 * Use a DEDICATED limited service account, not a personal/admin login.
 */

const BASE = (process.env.GWGMANAGE_BASE_URL || "https://gwgmanage.com").replace(/\/$/, "");
const EMAIL = process.env.GWGMANAGE_EMAIL;
const PASSWORD = process.env.GWGMANAGE_PASSWORD;

export const gwgmanageConfigured = () => !!(EMAIL && PASSWORD);

export interface MenuPerformanceRow {
  menuName: string;
  categoryName: string | null;
  category: string | null;
  qty: number;
  amount: number;
  volume: string | null;
  omzet: string | null;
  keterangan: string | null;
}
export interface MenuPerformance {
  month: string;
  totalMenus: number;
  avgQty: number;
  avgAmount: number;
  menus: MenuPerformanceRow[];
}

// Cache the access token in module memory (per serverless instance) with a TTL
// safely under a typical JWT lifetime; re-login on 401 regardless.
let cached: { token: string; at: number } | null = null;
const TOKEN_TTL_MS = 40 * 60 * 1000;

async function login(): Promise<string> {
  if (!EMAIL || !PASSWORD) throw new Error("gwgmanage credentials not configured");
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`gwgmanage login failed (${res.status})`);
  const json = await res.json();
  const token = json?.data?.accessToken;
  if (!token) throw new Error("gwgmanage login: no accessToken in response");
  cached = { token, at: Date.now() };
  return token;
}

async function token(): Promise<string> {
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token;
  return login();
}

/** Fetch monthly menu performance, re-logging in once on 401. */
export async function fetchMenuPerformance(month: string): Promise<MenuPerformance> {
  const url = `${BASE}/api/reports/menu-performance?month=${encodeURIComponent(month)}`;
  const call = async (t: string) => fetch(url, { headers: { Authorization: `Bearer ${t}`, Accept: "application/json" }, cache: "no-store" });

  let res = await call(await token());
  if (res.status === 401) {
    cached = null;
    res = await call(await login());
  }
  if (!res.ok) throw new Error(`gwgmanage menu-performance failed (${res.status})`);
  const json = await res.json();
  const d = json?.data ?? {};
  const menus: MenuPerformanceRow[] = Array.isArray(d.menus)
    ? d.menus.map((m: Record<string, unknown>) => ({
        menuName: String(m.menuName ?? ""),
        categoryName: (m.categoryName as string) ?? null,
        category: (m.category as string) ?? null,
        qty: Number(m.qty) || 0,
        amount: Number(m.amount) || 0,
        volume: (m.volume as string) ?? null,
        omzet: (m.omzet as string) ?? null,
        keterangan: (m.keterangan as string) ?? null,
      }))
    : [];
  return { month: String(d.month ?? month), totalMenus: Number(d.totalMenus) || menus.length, avgQty: Number(d.avgQty) || 0, avgAmount: Number(d.avgAmount) || 0, menus };
}
