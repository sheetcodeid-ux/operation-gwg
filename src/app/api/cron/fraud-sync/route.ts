import { NextResponse } from "next/server";
import { syncFraudRange, syncSalesDaily, syncSalesPeriod } from "@/lib/data/fraud";
import { getAppConfig } from "@/lib/data/app-config";

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

const HORIZON_DAYS = 45;

const ymdWib = (offsetDays: number) => new Date(Date.now() + 7 * 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

async function authorized(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;
  if (secret && token === secret) return true;
  if ((req.headers.get("user-agent") ?? "").startsWith("vercel-cron")) return true;
  if (token) {
    const dbToken = await getAppConfig("fraud_sync_token");
    if (dbToken && token === dbToken) return true;
  }
  return false;
}

export async function GET(req: Request) {
  if (!(await authorized(req))) return new NextResponse("Unauthorized", { status: 401 });

  const started = Date.now();
  const left = () => 52_000 - (Date.now() - started);
  const results: Record<string, unknown> = {};

  // Dedicated job: ESB product catalog sync (menu-recap is ~124 pages, needs a
  // full budget; scheduled on its own hourly pg_cron with ?job=menu). Resumable
  // upsert — a partial run converges over a few hours.
  if (new URL(req.url).searchParams.get("job") === "menu") {
    try {
      const { syncEsbMenus } = await import("@/lib/data/esb-menu");
      results["menu"] = await syncEsbMenus(30, 50_000);
    } catch (e) {
      results["menu"] = { error: e instanceof Error ? e.message : "failed" };
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

  // Phase 2 — backfill history (newest first) with whatever budget remains, so
  // after a day or two of hourly runs the whole horizon is final and every
  // period opens instantly.
  for (const kind of ["all", "delete"] as const) {
    if (left() < 8_000) break;
    try {
      results[`backfill:${kind}`] = await syncFraudRange(ymdWib(HORIZON_DAYS), ymdWib(2), kind, Math.min(left() - 4_000, 22_000));
    } catch (e) {
      results[`backfill:${kind}`] = { error: e instanceof Error ? e.message : "failed" };
    }
  }

  // Phase 3 — omset context: all-outlet daily sales over the horizon, plus a
  // fresh per-branch snapshot for today so % dari omset is ready when opened.
  if (left() > 6_000) {
    try {
      results["sales:daily"] = await syncSalesDaily(ymdWib(HORIZON_DAYS), ymdWib(0), Math.min(left() - 4_000, 14_000));
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

  return NextResponse.json({ ok: true, tookMs: Date.now() - started, results });
}
