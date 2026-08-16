import { NextResponse } from "next/server";
import { syncFraudRange, syncSalesDaily, syncSalesPeriod } from "@/lib/data/fraud";
import { esbSetDeadline } from "@/lib/integrations/esb-client";
import { syncSeasonalDays } from "@/lib/data/seasonal";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Server-side fraud sync — runs UNATTENDED so the data is always ready before
 * anyone opens the page:
 *
 *  1. Refreshes yesterday + today for both exports (Cancel/Void and Delete) —
 *     this is what makes the live day keep growing and finalizes each day
 *     right after midnight (WIB).
 *  2. Spends the remaining time budget backfilling the last HORIZON days that
 *     aren't final yet, newest first.
 *
 * Triggers: a Supabase pg_cron job calls this EVERY HOUR with ?token= (token
 * lives in app_config — zero manual setup), and the Vercel daily cron backs it
 * up (Authorization: Bearer CRON_SECRET / vercel-cron user agent).
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Sales (omset) context stays on a rolling recent window — historical omset
 *  fills on demand when a month is opened. Fraud rows backfill the WHOLE year. */
const SALES_HORIZON_DAYS = 60;
/** ESB export budget per single ESB call window; the sync engine caps a range
 *  at 62 days internally, so windows stay ≤ 58. */
const WINDOW_DAYS = 58;

const ymdWib = (offsetDays: number) => new Date(Date.now() + 7 * 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
/** Shift a YYYY-MM-DD by whole days (UTC math — dates are date-only). */
const addDays = (day: string, delta: number) => new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
/** The earliest fraud day we keep synced: 1 January of the current WIB year. */
const backfillStart = () => `${new Date(Date.now() + 7 * 3_600_000).getUTCFullYear()}-01-01`;

/**
 * Backfill fraud rows across [start, endStr] newest-first in ≤WINDOW_DAYS
 * windows, skipping days already final, until the time budget runs out. Because
 * a day synced after it ended is FINAL and never re-pulled, the whole year
 * converges over a few runs and then every period opens instantly from the DB.
 */
async function backfillHistory(
  kind: "all" | "delete",
  start: string,
  endStr: string,
  left: () => number,
): Promise<{ synced: number; windows: number; error?: string }> {
  let to = endStr;
  let synced = 0;
  let windows = 0;
  let error: string | undefined;
  while (left() > 8_000 && to >= start) {
    const from = addDays(to, -(WINDOW_DAYS - 1));
    const winFrom = from < start ? start : from;
    const res = await syncFraudRange(winFrom, to, kind, Math.min(left() - 4_000, 24_000));
    windows += 1;
    synced += res.synced;
    if (res.error) { error = res.error; break; }
    if (res.remaining > 0) break; // budget spent mid-window — next run resumes here
    to = addDays(winFrom, -1); // window fully final → step to the older window
  }
  return { synced, windows, error };
}

export async function GET(req: Request) {
  if (!(await cronAuthorized(req, "fraud_sync_token", "fraud-sync"))) return new NextResponse("Unauthorized", { status: 401 });

  const started = Date.now();
  const left = () => 52_000 - (Date.now() - started);
  // Tenggat KERAS untuk seluruh panggilan ESB pada permintaan ini. Tanpa ini,
  // satu permintaan ESB yang menggantung — `fetch` Node tidak punya batas waktu —
  // atau loop tunggu ekspor (22 × 2 detik) menahan seluruh cron sampai Vercel
  // mematikannya di detik ke-60, dan hasil kerjanya hangus semua. Dipasang di
  // sini karena hanya route yang tahu batas sesungguhnya.
  esbSetDeadline(left());
  const results: Record<string, unknown> = {};
  const job = new URL(req.url).searchParams.get("job");

  // Dedicated job: ESB product catalog sync (menu-recap is ~124 pages, needs a
  // full budget; scheduled on its own hourly pg_cron with ?job=menu). Resumable
  // upsert — a partial run converges over a few hours.
  if (job === "menu") {
    try {
      const { syncEsbMenus } = await import("@/lib/data/esb-menu");
      results["menu"] = await syncEsbMenus(30, 50_000);
    } catch (e) {
      results["menu"] = { error: e instanceof Error ? e.message : "failed" };
    }
    return NextResponse.json({ ok: true, tookMs: Date.now() - started, results });
  }

  // Dedicated job: spend the WHOLE budget backfilling this year's history so the
  // full Jan→now range is in the DB fast (schedule on its own frequent pg_cron
  // with ?job=backfill, or hit it manually to prime the cache). No live-day work.
  if (job === "backfill") {
    const start = backfillStart();
    for (const kind of ["all", "delete"] as const) {
      if (left() < 8_000) break;
      try {
        results[`backfill:${kind}`] = await backfillHistory(kind, start, ymdWib(1), left);
      } catch (e) {
        results[`backfill:${kind}`] = { error: e instanceof Error ? e.message : "failed" };
      }
    }
    return NextResponse.json({ ok: true, tookMs: Date.now() - started, results });
  }

  // Dedicated job: prime the seasonal (Musiman) daily gross+net cache for the
  // current year fast. Hit ?job=seasonal to fill it in one go.
  if (job === "seasonal") {
    try {
      const y = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
      const force = new URL(req.url).searchParams.get("force") === "1";
      results["seasonal"] = await syncSeasonalDays(`${y}-01-01`, ymdWib(0), "", Math.min(left() - 4_000, 50_000), force);
    } catch (e) {
      results["seasonal"] = { error: e instanceof Error ? e.message : "failed" };
    }
    return NextResponse.json({ ok: true, tookMs: Date.now() - started, results });
  }

  // Phase 1 — keep the live window fresh (yesterday + today, both kinds).
  for (const kind of ["all", "delete"] as const) {
    try {
      results[`fresh:${kind}`] = await syncFraudRange(ymdWib(1), ymdWib(0), kind, Math.min(20_000, left()));
    } catch (e) {
      results[`fresh:${kind}`] = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // Phase 2 — backfill the WHOLE year (Jan→now), newest first, with whatever
  // budget remains. After a few hourly runs the entire range is final in the DB
  // and every period opens instantly. (Prime it faster via ?job=backfill.)
  const start = backfillStart();
  for (const kind of ["all", "delete"] as const) {
    if (left() < 8_000) break;
    try {
      results[`backfill:${kind}`] = await backfillHistory(kind, start, ymdWib(2), left);
    } catch (e) {
      results[`backfill:${kind}`] = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // Phase 3 — omset context: all-outlet daily sales over the recent horizon, plus
  // a fresh per-branch snapshot for today so % dari omset is ready when opened.
  // (Historical omset fills on demand when an older month is opened.)
  if (left() > 6_000) {
    try {
      results["sales:daily"] = await syncSalesDaily(ymdWib(SALES_HORIZON_DAYS), ymdWib(0), Math.min(left() - 4_000, 14_000));
    } catch (e) {
      results["sales:daily"] = { error: e instanceof Error ? e.message : "failed" };
    }
  }
  if (left() > 6_000) {
    try {
      results["sales:today"] = await syncSalesPeriod("daily", ymdWib(0), Math.min(left() - 3_000, 12_000));
    } catch (e) {
      results["sales:today"] = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // Phase 4 — seasonal (Musiman): daily gross+net for the current year so the
  // seasonality chart opens instantly. Newest-first, whatever budget remains.
  if (left() > 5_000) {
    try {
      const y = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
      results["seasonal"] = await syncSeasonalDays(`${y}-01-01`, ymdWib(0), "", Math.min(left() - 3_000, 18_000));
    } catch (e) {
      results["seasonal"] = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // Phase 5 — per-branch seasonal (round-robin: ONE outlet per run) so the Data
  // Analysis per-outlet breakdown fills in over time without hammering ESB.
  if (left() > 6_000) {
    try {
      const { getSeasonalBranches } = await import("@/lib/data/seasonal");
      const { getAppConfig, setAppConfig } = await import("@/lib/data/app-config");
      const branches = await getSeasonalBranches();
      if (branches.length) {
        const cur = Number((await getAppConfig("seasonal_branch_cursor")) ?? "0") || 0;
        const b = branches[cur % branches.length];
        const y = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
        results[`seasonal:branch:${b.id}`] = await syncSeasonalDays(`${y}-01-01`, ymdWib(0), b.id, Math.min(left() - 3_000, 16_000));
        await setAppConfig("seasonal_branch_cursor", String(cur + 1));
      }
    } catch (e) {
      results["seasonal:branch"] = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  return NextResponse.json({ ok: true, tookMs: Date.now() - started, results });
}
