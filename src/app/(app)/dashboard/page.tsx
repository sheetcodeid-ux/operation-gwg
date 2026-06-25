import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import {
  aggregateOutlets,
  areaName,
  complaintTrend,
  coordinatorPerformance,
  getUser,
  getUsers,
  outletRanking,
  reportPeriodCompare,
  visibleOutlets,
} from "@/lib/data/store";
import { resolveRange } from "@/lib/date-range";
import { ROLE_LABEL } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCarousel, type Kpi } from "@/components/dashboard/kpi-card";
import { HeroCard } from "@/components/dashboard/hero-card";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { GlobalFilterBar } from "@/components/dashboard/filter-bar";
import { OutletRanking } from "@/components/dashboard/rankings";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import { TrendAreaChart } from "@/components/charts/charts";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Executive Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; scope?: string }>;
}) {
  const user = (await getSessionUser())!;
  const sp = await searchParams;
  const range = resolveRange({ range: sp.range, from: sp.from, to: sp.to });
  const periodSub = `vs prev · ${range.label.toLowerCase()}`;

  const all = visibleOutlets(user);
  const allIdSet = new Set(all.map((o) => o.id));

  // One filter with two categories: Wilayah (area) + Coordinator Area (ca). Tokens: "area:id" / "ca:id".
  const tokens = (sp.scope ?? "").split(",").filter(Boolean);
  let scoped = all;
  if (tokens.length) {
    const allowed = new Set<string>();
    for (const tok of tokens) {
      const [type, id] = tok.split(":");
      if (type === "area") {
        for (const o of all) if (o.areaId === id) allowed.add(o.id);
      } else if (type === "ca") {
        for (const oid of getUser(id)?.outletIds ?? []) if (allIdSet.has(oid)) allowed.add(oid);
      }
    }
    scoped = all.filter((o) => allowed.has(o.id));
  }
  const ids = scoped.map((o) => o.id);
  const idSet = new Set(ids);

  const agg = aggregateOutlets(ids);
  const cmp = reportPeriodCompare(ids, range.days, range.endMs);
  const perfIndex = Math.round(((cmp.hospitality.cur + cmp.hygiene.cur) / 2) * 10) / 10;

  const insightRings = [
    { label: "Task Completion", value: agg.taskCompletion, color: "#22c55e", icon: "check", sub: "Overall completion rate" },
    { label: "Hospitality", value: cmp.hospitality.cur, color: "#3b82f6", icon: "bell", sub: "Service quality score" },
    { label: "Hygiene", value: cmp.hygiene.cur, color: "#94a3b8", icon: "spray", sub: "Cleanliness score" },
  ];
  const trendItems = [
    { label: "Task Completion", value: agg.taskCompletion, delta: cmp.tasksCompleted.delta, color: "#22c55e", sub: "Tasks completed" },
    { label: "Hospitality", value: cmp.hospitality.cur, delta: cmp.hospitality.delta, color: "#3b82f6", sub: "Average score" },
    { label: "Hygiene", value: cmp.hygiene.cur, delta: cmp.hygiene.delta, color: "#94a3b8", sub: "Average score" },
  ];

  const outlets = outletRanking(user).filter((r) => idSet.has(r.outlet.id));
  const coordPerf = coordinatorPerformance(ids);
  const trend = complaintTrend(user);

  const visibleAreas = [...new Map(all.map((o) => [o.areaId, areaName(o.areaId)])).entries()];
  const coordinators = getUsers().filter(
    (u) => u.role === "area_coordinator" && (u.outletIds ?? []).some((id) => allIdSet.has(id)),
  );
  const scopeOptions = [
    ...visibleAreas.map(([id, name]) => ({ value: `area:${id}`, label: name, group: "Wilayah" })),
    ...coordinators.map((c) => ({ value: `ca:${c.id}`, label: c.name, group: "Coordinator Area" })),
  ];

  const cards: Kpi[] = [
    { label: "Total Outlets", value: formatNumber(agg.outlets), icon: "Store", tone: "brand", sub: "In scope" },
    { label: "Total Areas", value: formatNumber(new Set(scoped.map((o) => o.areaId)).size), icon: "MapPinned", tone: "cyan", sub: "Coordination zones" },
    { label: "Hospitality Score", value: cmp.hospitality.cur.toFixed(1), icon: "ConciergeBell", tone: "brand", delta: { value: cmp.hospitality.delta }, sub: periodSub },
    { label: "Hygiene Score", value: cmp.hygiene.cur.toFixed(1), icon: "SprayCan", tone: "success", delta: { value: cmp.hygiene.delta }, sub: periodSub },
    { label: "Complaints Open", value: formatNumber(agg.complaintsOpen), icon: "MessageSquareWarning", tone: "warning", delta: { value: cmp.complaintsReceived.delta, positiveIsGood: false }, sub: `${cmp.complaintsReceived.cur} new` },
    { label: "Complaints Closed", value: formatNumber(agg.complaintsClosed), icon: "CheckCircle2", tone: "success", delta: { value: cmp.complaintsResolved.delta }, sub: `${cmp.complaintsResolved.cur} resolved` },
    { label: "Task Completion", value: `${agg.taskCompletion}%`, icon: "ListChecks", tone: "cyan", delta: { value: cmp.tasksCompleted.delta }, sub: `${cmp.tasksCompleted.cur} done` },
    { label: "Events Running", value: formatNumber(agg.eventsRunning), icon: "CalendarRange", tone: "amber", sub: `${agg.eventsTotal} total` },
  ];

  return (
    <div className="w-full">
      <PageHeader
        icon={LayoutDashboard}
        title="Executive Dashboard"
        description={`Real-time operational overview · ${ROLE_LABEL[user.role]} view`}
      />

      <GlobalFilterBar scopeOptions={scopeOptions} />

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <HeroCard name={user.name} />
          <KpiCarousel items={cards} />
        </div>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Performance analytics</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <InsightsPanel rings={insightRings} centerValue={perfIndex} trends={trendItems} periodLabel={range.label} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Complaint Trend</CardTitle>
            <CardDescription>Received vs. resolved · last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={trend} />
          </CardContent>
        </Card>

        <PerformanceMetrics data={coordPerf} />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Outlet Ranking</CardTitle>
            <CardDescription>Top performers by composite score (hospitality + hygiene − open complaints)</CardDescription>
          </CardHeader>
          <CardContent>
            {outlets.length > 0 ? <OutletRanking rows={outlets} /> : <p className="py-8 text-center text-sm text-muted-foreground">No outlets in scope</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
