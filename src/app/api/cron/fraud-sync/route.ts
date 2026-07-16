import { NextResponse } from "next/server";
import { syncFraudDays } from "@/lib/data/fraud";

/**
 * Daily cron (vercel.json): pulls yesterday + today from ESB into the DB cache
 * for both exports (Cancel/Void and Delete Order), so day changes are already
 * synced before anyone opens the fraud page.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env var is
 * set. Without CRON_SECRET, only requests bearing Vercel's cron user-agent are
 * accepted (best effort) — set CRON_SECRET in production.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ymdWib = (offsetDays: number) => new Date(Date.now() + 7 * 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const ua = req.headers.get("user-agent") ?? "";
  if (secret ? auth !== `Bearer ${secret}` : !ua.startsWith("vercel-cron")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results: Record<string, unknown> = {};
  // Yesterday (finalize it) + today (fresh snapshot), for both exports. Each
  // day is a single daily period; syncFraudDays skips days already final.
  for (const kind of ["all", "delete"] as const) {
    for (const day of [ymdWib(1), ymdWib(0)]) {
      try {
        results[`${kind}:${day}`] = await syncFraudDays("daily", day, kind, 12_000);
      } catch (e) {
        results[`${kind}:${day}`] = { error: e instanceof Error ? e.message : "failed" };
      }
    }
  }
  return NextResponse.json({ ok: true, results });
}
