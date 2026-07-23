import "server-only";

import { db, dbEnabled } from "./db";
import { esbConfigured, esbFetchSales, esbListBranches } from "@/lib/integrations/esb-client";

/**
 * Seasonal (Musiman) sales — daily gross & net sales for a whole year, cached in
 * `seasonal_daily` so the overlay chart renders instantly. Data comes from ESB
 * (the sales-dashboard highlight, all outlets or one branch). Days are pulled one
 * at a time (on demand + hourly cron); a day synced after it ended is FINAL and
 * never re-pulled, so the year converges and stays fast.
 *
 * branch '' = all outlets; otherwise the ESB branchID.
 */

export interface SeasonalDayValue { gross: number; net: number }
export interface SeasonalReport {
  configured: boolean;
  year: number;
  branch: string;
  /** month 0..11 → day 1..31 → { gross, net } */
  months: Record<number, Record<number, SeasonalDayValue>>;
  /** days in the year not yet synced — the client drains these in the background */
  pendingDays: string[];
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Every YYYY-MM-DD in [from, to] (capped at 400 for a full year). */
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  while (ymd(d) <= to && out.length < 400) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const FRESH_TTL_MS = 60 * 60 * 1000;
/** A day is FINAL once synced after it ended (WIB); a still-running day is fresh
 *  for an hour. */
function fresh(syncedAt: string, day: string): boolean {
  const syncedMs = Date.parse(syncedAt);
  const endMs = Date.parse(`${day}T17:00:00Z`); // next 00:00 WIB
  if (syncedMs >= endMs) return true;
  return Date.now() - syncedMs < FRESH_TTL_MS;
}

interface Row { day: string; gross: number | string; net: number | string; synced_at: string }

/** The ESB branches for the outlet filter (id + name). Empty when ESB is off. */
export async function getSeasonalBranches(): Promise<{ id: string; name: string }[]> {
  if (!esbConfigured()) return [];
  try {
    return await esbListBranches();
  } catch {
    return [];
  }
}

/** Read the cached year for a branch and report which days still need a pull. */
export async function getSeasonal(year: number, branch = ""): Promise<SeasonalReport> {
  if (!esbConfigured()) return { configured: false, year, branch, months: {}, pendingDays: [], error: "Integrasi ESB belum dikonfigurasi." };
  if (!dbEnabled) return { configured: true, year, branch, months: {}, pendingDays: [] };
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const { data, error } = await db().from("seasonal_daily").select("day,gross,net,synced_at").eq("branch", branch).gte("day", from).lte("day", to);
  if (error) return { configured: true, year, branch, months: {}, pendingDays: [], error: error.message };

  const months: Record<number, Record<number, SeasonalDayValue>> = {};
  const have = new Map<string, string>();
  for (const r of (data ?? []) as Row[]) {
    const d = new Date(`${r.day}T00:00:00`);
    (months[d.getMonth()] ??= {})[d.getDate()] = { gross: Number(r.gross) || 0, net: Number(r.net) || 0 };
    have.set(r.day, r.synced_at);
  }
  const today = todayWib();
  const pendingDays: string[] = [];
  for (const day of eachDay(from, to)) {
    if (day > today) continue;
    const s = have.get(day);
    if (!s || !fresh(s, day)) pendingDays.push(day);
  }
  return { configured: true, year, branch, months, pendingDays };
}

/** Pull the next batch of missing/stale days of [from, to] for a branch from ESB
 *  into the cache, newest first, stopping near the budget. */
export async function syncSeasonalDays(from: string, to: string, branch = "", budgetMs = 42_000): Promise<{ synced: number; remaining: number; error?: string }> {
  if (!dbEnabled || !esbConfigured()) return { synced: 0, remaining: 0 };
  const { data } = await db().from("seasonal_daily").select("day,synced_at").eq("branch", branch).gte("day", from).lte("day", to);
  const have = new Map((data ?? []).map((r: { day: string; synced_at: string }) => [r.day, r.synced_at]));
  const today = todayWib();
  const pending = eachDay(from, to)
    .filter((d) => d <= today && (!have.get(d) || !fresh(have.get(d)!, d)))
    .sort()
    .reverse();
  if (pending.length === 0) return { synced: 0, remaining: 0 };
  const started = Date.now();
  let synced = 0;
  let error: string | undefined;
  for (const day of pending) {
    if (synced > 0 && Date.now() - started > budgetMs) break;
    try {
      const sales = await esbFetchSales(day, day, branch);
      const up = await db().from("seasonal_daily").upsert({ day, branch, gross: sales.gross, net: sales.net, synced_at: new Date().toISOString() });
      if (up.error) throw new Error(up.error.message);
      synced += 1;
    } catch (e) {
      error = e instanceof Error ? e.message : "Gagal memuat data ESB.";
      break;
    }
  }
  return { synced, remaining: pending.length - synced, error };
}
