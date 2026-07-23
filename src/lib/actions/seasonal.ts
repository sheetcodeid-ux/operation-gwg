"use server";

import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { getSeasonal, syncSeasonalDays, type SeasonalReport } from "@/lib/data/seasonal";

async function guard() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!canOpenMenu(user.role, "op_seasonal", user.grants)) return null;
  return user;
}

export async function seasonalReportAction(year: number): Promise<SeasonalReport | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return getSeasonal(year);
}

/** Pull the next batch of missing days for the year into the cache. The client
 *  calls this repeatedly (background) until remaining hits 0. Smaller budget than
 *  the cron so the chart fills in in visible steps. */
export async function seasonalSyncAction(year: number): Promise<{ synced: number; remaining: number; error?: string } | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return syncSeasonalDays(`${year}-01-01`, `${year}-12-31`, 12_000);
}
