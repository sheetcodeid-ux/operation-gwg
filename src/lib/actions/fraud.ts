"use server";

import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { getFraudReport, getOutletFraudDaily, syncFraudDays, type FraudDailyPoint, type FraudKind, type FraudPeriod, type FraudReport } from "@/lib/data/fraud";

async function guard() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!canOpenMenu(user.role, "op_fraud", user.grants)) return null;
  return user;
}

export async function fraudReportAction(period: FraudPeriod, date: string, kind: FraudKind = "all"): Promise<FraudReport | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return getFraudReport(period, date, kind);
}

export async function outletFraudDailyAction(branchId: number, from: string, to: string): Promise<FraudDailyPoint[] | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return getOutletFraudDaily(branchId, from, to);
}

/** Pull the next batch of missing/stale days for the period into the DB cache.
 *  The client calls this repeatedly (background) until remaining hits 0. */
export async function fraudSyncAction(period: FraudPeriod, date: string, kind: FraudKind): Promise<{ synced: number; remaining: number; error?: string } | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return syncFraudDays(period, date, kind);
}
