import { LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import {
  aggregateOutlets,
  areaName,
  complaintCompareData,
  coordinatorPerformance,
  getUser,
  getUsers,
  listTasks,
  outletName,
  outletRankingInRange,
  reportPeriodCompare,
  userName,
  visibleOutlets,
} from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { resolveRange } from "@/lib/date-range";
import { ROLE_LABEL } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCarousel, type Kpi } from "@/components/dashboard/kpi-card";
import { HeroCard } from "@/components/dashboard/hero-card";
import { DashboardSwitcher } from "@/components/dashboard/dashboard-switcher";
import { OperationDashboard2 } from "@/components/dashboard/operation-dashboard-2";
import { getOpsDashboard } from "@/lib/data/ops-dashboard";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { GlobalFilterBar } from "@/components/dashboard/filter-bar";
import { OutletRankingTable } from "@/components/dashboard/outlet-ranking-table";
import { PerformanceMetrics } from "@/components/dashboard/performance-metrics";
import { ComplaintTrendCard } from "@/components/dashboard/complaint-trend-card";
import { QuickTasks } from "@/components/dashboard/quick-tasks";
import { departmentList } from "@/components/work/work-data";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Executive Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; scope?: string; view?: string }>;
}) {
  const user = (await getSessionUser())!;
  const sp = await searchParams;

  // Dashboard 2 (operational/financial) — switchable on the same page.
  if (sp.view === "ops2") {
    const opsData = await getOpsDashboard();
    return (
      <div className="w-full">
        <PageHeader
          icon={LayoutDashboard}
          title="Dashboard Operasional"
          description="Ringkasan finansial & operasional seluruh cabang"
          actions={<DashboardSwitcher current="ops2" />}
        />
        <OperationDashboard2 initial={opsData} />
      </div>
    );
  }
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

  const rankedOutlets = outletRankingInRange(ids, range.endMs, range.days);
  const coordPerf = coordinatorPerformance(ids);

  const complaintCompare = complaintCompareData(ids);

  const visibleAreas = [...new Map(all.map((o) => [o.areaId, areaName(o.areaId)])).entries()];
  const coordinators = getUsers().filter(
    (u) => u.role === "area_coordinator" && (u.outletIds ?? []).some((id) => allIdSet.has(id)),
  );

  // Quick Tasks — scoped Work Tracker tasks (Active/Completed) + a Work-Tracker-style create form scoped by coordinator area.
  const scopedIdSet = new Set(ids);
  const outletCoordName = new Map<string, string>();
  const outletCoordId = new Map<string, string>();
  for (const c of coordinators) {
    for (const oid of c.outletIds ?? []) {
      if (scopedIdSet.has(oid)) {
        outletCoordName.set(oid, c.name);
        outletCoordId.set(oid, c.id);
      }
    }
  }
  const quickTasks = listTasks(user)
    .filter((t) => (t.outletId === null || scopedIdSet.has(t.outletId)) && t.status !== "cancelled")
    .map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      division: t.division,
      outletId: t.outletId ?? "",
      outlet: t.outletId ? outletName(t.outletId) : "No branch",
      coordinator: (t.outletId ? outletCoordName.get(t.outletId) : null) ?? "—",
      category: t.category,
      priority: t.priority,
      status: t.status,
      start: t.startDate,
      due: t.dueDate,
      progress: t.progress,
      picIds: t.picIds,
      pic: t.picIds.length ? t.picIds.map(userName).join(", ") : "—",
      done: t.status === "done",
    }));
  const taskOutlets = scoped.map((o) => ({ id: o.id, name: o.name, coordinatorId: outletCoordId.get(o.id) ?? null }));
  const coordList = coordinators.map((c) => ({ id: c.id, name: c.name }));
  // Tasks are organised by department (Finance, Creative, …), same as Work Tracker.
  const divisions = await departmentList();
  const divisionMembers: Record<string, { id: string; name: string }[]> = {};
  for (const d of divisions) {
    divisionMembers[d] = getUsers()
      .filter((u) => u.active && u.department === d)
      .map((u) => ({ id: u.id, name: u.name }));
  }
  const defaultDivision = (user.department && divisions.includes(user.department) ? user.department : divisions[0]) ?? "";
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
        actions={<DashboardSwitcher current="" />}
      />

      <GlobalFilterBar scopeOptions={scopeOptions} />

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
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
        <ComplaintTrendCard data={complaintCompare} className="lg:col-span-2" />

        <PerformanceMetrics data={coordPerf} />
      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader>
            <CardTitle>Outlet Ranking</CardTitle>
            <CardDescription>Composite score (hospitality + hygiene − complaints) · {range.label.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {rankedOutlets.length > 0 ? (
              <OutletRankingTable rows={rankedOutlets} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No outlets in scope</p>
            )}
          </CardContent>
        </Card>

        <QuickTasks
          tasks={quickTasks}
          canAdd={can(user, "create_work_task")}
          outlets={taskOutlets}
          coordinators={coordList}
          members={divisionMembers}
          divisions={divisions}
          defaultDivision={defaultDivision}
        />
      </div>
    </div>
  );
}
