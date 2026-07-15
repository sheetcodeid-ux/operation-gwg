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

/** Authenticated GET against the ERP; returns the `data` field. Re-logs in once on 401. */
async function authedGet(path: string): Promise<unknown> {
  const url = `${BASE}${path}`;
  const call = async (t: string) => fetch(url, { headers: { Authorization: `Bearer ${t}`, Accept: "application/json" }, cache: "no-store" });
  let res = await call(await token());
  if (res.status === 401) {
    cached = null;
    res = await call(await login());
  }
  if (!res.ok) throw new Error(`gwgmanage ${path} failed (${res.status})`);
  const json = await res.json();
  return (json as { data?: unknown })?.data ?? {};
}

const num = (v: unknown) => Number(v) || 0;

/* ---------------- /api/reports/dashboard ---------------- */
export interface ErpDashboard {
  netSales: number; // penjualanBersih
  grossSales: number; // penjualanKotor
  taxOther: number; // pajakBiayaLain
  totalTransaksi: number;
  totalPelanggan: number;
  avgBill: number; // penjualanBersihPerTransaksi
  totalVoid: number; // count of void transactions
  totalCancelled: number; // count of cancelled orders
  voidAmount: number; // Rp value of voids (0 if the POS doesn't return it)
  cancelAmount: number; // Rp value of cancels (0 if the POS doesn't return it)
  totalBebanPlatform: number;
  platform: { methodName: string; count: number; amount: number }[];
}

/** First numeric value among candidate keys (POS field naming varies). */
function pickNum(d: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (d[k] !== undefined && d[k] !== null && !Number.isNaN(Number(d[k]))) return Number(d[k]);
  }
  return 0;
}

/** Overall store dashboard for a day (period=daily) or a range (dateFrom/dateTo).
 *  Pass `branchId` to scope to one outlet (used by the fraud/void analysis; the
 *  caller verifies whether the POS actually honours it). */
export async function fetchErpDashboard(opts: { date?: string; dateFrom?: string; dateTo?: string; branchId?: number | string }): Promise<ErpDashboard> {
  const qs = new URLSearchParams();
  if (opts.date) { qs.set("period", "daily"); qs.set("date", opts.date); }
  if (opts.dateFrom) qs.set("dateFrom", opts.dateFrom);
  if (opts.dateTo) qs.set("dateTo", opts.dateTo);
  if (opts.branchId !== undefined && opts.branchId !== "") qs.set("branchId", String(opts.branchId));
  const d = (await authedGet(`/api/reports/dashboard?${qs.toString()}`)) as Record<string, unknown>;
  const platform = Array.isArray(d.bebanPlatformPerMethod)
    ? (d.bebanPlatformPerMethod as Record<string, unknown>[]).map((p) => ({ methodName: String(p.methodName ?? ""), count: num(p.count), amount: num(p.amount) }))
    : [];
  return {
    netSales: num(d.penjualanBersih),
    grossSales: num(d.penjualanKotor),
    taxOther: num(d.pajakBiayaLain),
    totalTransaksi: num(d.totalTransaksi),
    totalPelanggan: num(d.totalPelanggan),
    avgBill: num(d.penjualanBersihPerTransaksi),
    totalVoid: num(d.totalVoid),
    totalCancelled: num(d.totalCancelled),
    // Rp value of voids/cancels — POS field naming varies, so try known variants.
    voidAmount: pickNum(d, ["totalVoidAmount", "voidAmount", "totalVoidNominal", "voidNominal", "nominalVoid", "totalNominalVoid", "voidValue", "totalVoidValue"]),
    cancelAmount: pickNum(d, ["totalCancelledAmount", "cancelledAmount", "cancelAmount", "totalCancelAmount", "totalCancelledNominal", "cancelNominal", "nominalCancel", "totalNominalCancel", "cancelValue", "totalCancelledValue"]),
    totalBebanPlatform: num(d.totalBebanPlatform),
    platform,
  };
}

/* ---------------- /api/reports/sales-hourly ---------------- */
export interface ErpHourlyPoint { hour: string; netSales: number; transactionCount: number; paxTotal: number }

/** Hourly sales for a date range (use dateFrom=dateTo for a single day). */
export async function fetchSalesHourly(dateFrom: string, dateTo: string): Promise<ErpHourlyPoint[]> {
  const d = (await authedGet(`/api/reports/sales-hourly?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`)) as Record<string, unknown>;
  const rows = Array.isArray(d.hourlySales) ? (d.hourlySales as Record<string, unknown>[]) : [];
  return rows.map((r) => ({ hour: String(r.hour ?? ""), netSales: num(r.netSales), transactionCount: num(r.transactionCount), paxTotal: num(r.paxTotal) }));
}

/* ---------------- /api/branches ---------------- */
export interface ErpBranch { id: number; branchId: number; code: string; name: string }

export async function fetchBranches(): Promise<ErpBranch[]> {
  const d = await authedGet(`/api/branches`);
  const rows = Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
  return rows.map((b) => ({ id: num(b.id), branchId: num(b.branchID), code: String(b.branchCode ?? ""), name: String(b.branchName ?? "") }));
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
