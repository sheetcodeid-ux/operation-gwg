import "server-only";

import { db, dbEnabled } from "./db";
import { fetchErpDashboard, gwgmanageConfigured } from "@/lib/integrations/gwgmanage";

/**
 * Seasonal (Musiman) sales — daily gross & net sales for a whole year, cached in
 * `seasonal_daily` so the overlay chart renders instantly. Days are pulled one
 * at a time from the POS dashboard (on demand + hourly cron); a day synced after
 * it ended is FINAL and never re-pulled, so the year converges and stays fast.
 *
 * Branch '' = all outlets (the only scope cached for now).
 */

export interface SeasonalDayValue { gross: number; net: number }
export interface SeasonalReport {
  configured: boolean;
  year: number;
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

/** Read the cached year and report which days still need a POS pull. */
export async function getSeasonal(year: number): Promise<SeasonalReport> {
  if (!gwgmanageConfigured()) return { configured: false, year, months: {}, pendingDays: [], error: "Integrasi POS belum dikonfigurasi." };
  if (!dbEnabled) return { configured: true, year, months: {}, pendingDays: [] };
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const { data, error } = await db().from("seasonal_daily").select("day,gross,net,synced_at").eq("branch", "").gte("day", from).lte("day", to);
  if (error) return { configured: true, year, months: {}, pendingDays: [], error: error.message };

  const months: Record<number, Record<number, SeasonalDayValue>> = {};
  const have = new Map<string, string>();
  for (const r of (data ?? []) as Row[]) {
    const d = new Date(`${r.day}T00:00:00`);
    const m = d.getMonth();
    const day = d.getDate();
    (months[m] ??= {})[day] = { gross: Number(r.gross) || 0, net: Number(r.net) || 0 };
    have.set(r.day, r.synced_at);
  }
  const today = todayWib();
  const pendingDays: string[] = [];
  for (const day of eachDay(from, to)) {
    if (day > today) continue; // future
    const s = have.get(day);
    if (!s || !fresh(s, day)) pendingDays.push(day);
  }
  return { configured: true, year, months, pendingDays };
}

/** Pull the next batch of missing/stale days of [from, to] from the POS into the
 *  cache, newest first, stopping near the budget so it fits a serverless slot. */
export async function syncSeasonalDays(from: string, to: string, budgetMs = 42_000): Promise<{ synced: number; remaining: number; error?: string }> {
  if (!dbEnabled || !gwgmanageConfigured()) return { synced: 0, remaining: 0 };
  const { data } = await db().from("seasonal_daily").select("day,synced_at").eq("branch", "").gte("day", from).lte("day", to);
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
      const dash = await fetchErpDashboard({ date: day });
      const up = await db().from("seasonal_daily").upsert({ day, branch: "", gross: dash.grossSales, net: dash.netSales, synced_at: new Date().toISOString() });
      if (up.error) throw new Error(up.error.message);
      synced += 1;
    } catch (e) {
      error = e instanceof Error ? e.message : "Gagal memuat data POS.";
      break;
    }
  }
  return { synced, remaining: pending.length - synced, error };
}
