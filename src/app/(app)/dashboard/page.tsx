import { LayoutDashboard, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import {
  areaRanking,
  complaintTrend,
  getDashboardKpis,
  outletRanking,
} from "@/lib/data/store";
import { ROLE_LABEL } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi-card";
import { AreaRanking, OutletRanking } from "@/components/dashboard/rankings";
import { TrendAreaChart } from "@/components/charts/charts";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Executive Dashboard" };

export default async function DashboardPage() {
  const user = (await getSessionUser())!;
  const kpis = getDashboardKpis(user);
  const outlets = outletRanking(user);
  const areas = areaRanking(user);
  const trend = complaintTrend(user);

  const cards: Kpi[] = [
    { label: "Total Outlets", value: formatNumber(kpis.totalOutlets), icon: "Store", tone: "brand", sub: "Under monitoring" },
    { label: "Total Areas", value: formatNumber(kpis.totalAreas), icon: "MapPinned", tone: "cyan", sub: "Coordination zones" },
    { label: "Hospitality Score", value: kpis.hospitalityScore.toFixed(1), icon: "ConciergeBell", tone: "brand", delta: { value: 2.4 } },
    { label: "Hygiene Score", value: kpis.hygieneScore.toFixed(1), icon: "SprayCan", tone: "success", delta: { value: 1.1 } },
    { label: "Complaints Open", value: formatNumber(kpis.complaintsOpen), icon: "MessageSquareWarning", tone: "warning", delta: { value: -8, positiveIsGood: false } },
    { label: "Complaints Closed", value: formatNumber(kpis.complaintsClosed), icon: "CheckCircle2", tone: "success", delta: { value: 12 } },
    { label: "Task Completion", value: `${kpis.taskCompletionRate}%`, icon: "ListChecks", tone: "cyan", delta: { value: 5 } },
    { label: "Event Progress", value: `${kpis.eventProgress}%`, icon: "CalendarRange", tone: "amber" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        icon={LayoutDashboard}
        title="Executive Dashboard"
        description={`Real-time operational overview · ${ROLE_LABEL[user.role]} view`}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            Scoped to your access
          </span>
        }
      />

      <KpiGrid items={cards} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Complaint Trend</CardTitle>
              <CardDescription>Received vs. resolved · last 8 weeks</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Area Ranking</CardTitle>
            <CardDescription>Composite performance by area</CardDescription>
          </CardHeader>
          <CardContent>
            <AreaRanking rows={areas} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Outlet Ranking</CardTitle>
              <CardDescription>Top performers by composite score (hospitality + hygiene − open complaints)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <OutletRanking rows={outlets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
