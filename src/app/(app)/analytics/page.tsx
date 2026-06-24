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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { ScoreRing } from "@/components/ui/score-ring";
import { TONE_HEX } from "@/components/ui/tone";
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

  const heatColumns = ["Hospitality", "Hygiene", "Task %", "Resolution %"];
  const heatRows = matrix.map((m) => ({
    label: m.area.name,
    values: [m.hospitality, m.hygiene, m.taskCompletion, m.resolution],
  }));

  return (
    <div className="mx-auto max-w-7xl">
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
