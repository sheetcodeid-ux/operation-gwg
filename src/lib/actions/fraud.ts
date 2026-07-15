"use server";

import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { getFraudReport, getOutletFraudDaily, type FraudDailyPoint, type FraudPeriod, type FraudReport } from "@/lib/data/fraud";

async function guard() {
  const user = await getSessionUser();
  if (!user) return null;
  if (!canOpenMenu(user.role, "op_fraud", user.grants)) return null;
  return user;
}

export async function fraudReportAction(period: FraudPeriod, date: string): Promise<FraudReport | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return getFraudReport(period, date);
}

export async function outletFraudDailyAction(branchId: number, from: string, to: string): Promise<FraudDailyPoint[] | { error: string }> {
  if (!(await guard())) return { error: "Not authorized" };
  return getOutletFraudDaily(branchId, from, to);
}
