import { redirect } from "next/navigation";
import { ChartSpline, ConciergeBell, MessageSquareWarning, SprayCan, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import {
  areaMetricMatrix,
  areaName,
  getDashboardKpis,
  outletRanking,
  scoreTrend,
  visibleOutlets,
} from "@/lib/data/store";
import { listComplaints } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { KPI_TARGETS } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { ScoreRing } from "@/components/ui/score-ring";
import { Progress } from "@/components/ui/progress";
import { TONE_HEX, scoreTone } from "@/components/ui/tone";
import { CategoryBarChart, MultiLineChart } from "@/components/charts/charts";
import { Heatmap } from "@/components/charts/heatmap";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = (await getSessionUser())!;
  if (!can(user, "view_reports")) redirect("/dashboard");

  const kpis = getDashboardKpis(user);
  const trend = scoreTrend(user);
  const matrix = areaMetricMatrix(user);
  const leaderboard = outletRanking(user).slice(0, 10);

  // complaints by area (bar)
  const complaints = listComplaints(user);
  const areaCounts = new Map<string, number>();
  for (const c of complaints) areaCounts.set(c.areaId, (areaCounts.get(c.areaId) ?? 0) + 1);
  const byArea = [...areaCounts.entries()]
    .map(([areaId, value]) => ({ label: areaName(areaId), value }))
    .sort((a, b) => b.value - a.value);

  const resolution =
    kpis.complaintsOpen + kpis.complaintsClosed
      ? Math.round((kpis.complaintsClosed / (kpis.complaintsOpen + kpis.complaintsClosed)) * 100)
      : 0;
  const targets = [
    { label: "Hospitality", actual: kpis.hospitalityScore, target: KPI_TARGETS.hospitality },
    { label: "Hygiene", actual: kpis.hygieneScore, target: KPI_TARGETS.hygiene },
    { label: "Task Completion", actual: kpis.taskCompletionRate, target: KPI_TARGETS.taskCompletion },
    { label: "Resolution", actual: resolution, target: KPI_TARGETS.resolution },
  ];

  const heatColumns = ["Hospitality", "Hygiene", "Task %", "Resolution %"];
  const heatRows = matrix.map((m) => ({
    label: m.area.name,
    values: [m.hospitality, m.hygiene, m.taskCompletion, m.resolution],
  }));

  return (
    <div className="w-full">
      <PageHeader
        icon={ChartSpline}
        title="Analytics & Reporting"
        description="Cross-module performance insights across outlets and areas"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ConciergeBell} label="Hospitality" value={kpis.hospitalityScore.toFixed(1)} tone="brand" />
        <StatTile icon={SprayCan} label="Hygiene" value={kpis.hygieneScore.toFixed(1)} tone="success" />
        <StatTile icon={MessageSquareWarning} label="Open Complaints" value={kpis.complaintsOpen} tone="warning" />
        <StatTile icon={Trophy} label="Outlets Tracked" value={visibleOutlets(user).length} tone="cyan" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Targets vs Actual</CardTitle>
          <CardDescription>Organization KPI targets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {targets.map((t) => {
              const onTarget = t.actual >= t.target;
              return (
                <div key={t.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">{t.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{t.actual.toFixed(0)}</span>
                  </div>
                  <Progress value={t.actual} tone={onTarget ? "success" : scoreTone(t.actual)} className="mt-1.5" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Target {t.target} ·{" "}
                    <span className={onTarget ? "text-emerald-500" : "text-amber-500"}>
                      {onTarget ? "On target" : `${(t.target - t.actual).toFixed(0)} below`}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quality Score Trend</CardTitle>
            <CardDescription>Weekly hospitality vs. hygiene · last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <MultiLineChart
              data={trend}
              series={[
                { key: "hospitality", name: "Hospitality", color: TONE_HEX.brand },
                { key: "hygiene", name: "Hygiene", color: TONE_HEX.success },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Complaints by Area</CardTitle>
            <CardDescription>Volume distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {byArea.length > 0 ? (
              <CategoryBarChart data={byArea} color={TONE_HEX.cyan} height={240} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Performance Heatmap</CardTitle>
          <CardDescription>Area × metric · darker = stronger</CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap columns={heatColumns} rows={heatRows} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Outlet Leaderboard</CardTitle>
          <CardDescription>Top 10 by composite performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {leaderboard.map((row, i) => (
              <div key={row.outlet.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/40">
                <span className="grid size-6 place-items-center rounded-md bg-muted/50 text-xs font-semibold tabular-nums text-foreground/80">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.outlet.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{areaName(row.outlet.areaId)}</p>
                </div>
                <div className="hidden gap-4 text-right text-xs sm:flex">
                  <span className="text-muted-foreground">H {row.hospitality.toFixed(0)}</span>
                  <span className="text-muted-foreground">G {row.hygiene.toFixed(0)}</span>
                </div>
                <ScoreRing value={row.composite} size={40} stroke={4} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
