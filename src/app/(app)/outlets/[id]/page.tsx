import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarRange,
  ChevronLeft,
  ConciergeBell,
  ListChecks,
  MessageSquareWarning,
  SprayCan,
  Store,
  UserCog,
} from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getOutletDetail, getOutlets } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import {
  COMPLAINT_STATUS_META,
  PRIORITY_META,
  TASK_STATUS_META,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page-header";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatTile } from "@/components/ui/stat";
import { Progress } from "@/components/ui/progress";
import { EventCard } from "@/components/events/event-views";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = getOutletDetail(id);
  return { title: detail ? detail.outlet.name : "Outlet" };
}

export default async function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  if (!canAccessOutlet(user, id, getOutlets())) redirect("/outlets");
  const d = getOutletDetail(id);
  if (!d) notFound();

  return (
    <div className="w-full">
      <Link
        href="/outlets"
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Outlets
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-muted ring-1 ring-border">
            <Store className="size-6 text-foreground/70" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{d.outlet.name}</h1>
            <p className="text-sm text-muted-foreground">
              {d.outlet.code} · {d.outlet.city} · {d.areaName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ScoreRing value={d.hospitality} size={56} stroke={6} label="Hosp" />
          <ScoreRing value={d.hygiene} size={56} stroke={6} label="Hyg" />
        </div>
      </div>

      {/* People */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Area Coordinator", name: d.coordinatorName },
          { label: "Supervisor", name: d.supervisorName },
          { label: "PIC Outlet", name: d.picName },
        ].map((p) => (
          <div key={p.label} className="glass flex items-center gap-2.5 rounded-xl p-3">
            <div className="grid size-9 place-items-center rounded-lg bg-muted/50 ring-1 ring-border">
              <UserCog className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ConciergeBell} label="Hospitality" value={d.hospitality.toFixed(1)} tone="brand" />
        <StatTile icon={SprayCan} label="Hygiene" value={d.hygiene.toFixed(1)} tone="success" />
        <StatTile icon={ListChecks} label="Task Completion" value={`${d.taskCompletion}%`} tone="cyan" sub={`${d.tasksOpen} open`} />
        <StatTile icon={MessageSquareWarning} label="Open Complaints" value={d.complaintsOpen} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" /> Work Tasks
            </CardTitle>
            <CardDescription>{d.tasks.length} total · {d.tasksDone} done</CardDescription>
          </CardHeader>
          <CardContent>
            {d.tasks.length === 0 ? (
              <EmptyState icon={ListChecks} title="No tasks" />
            ) : (
              <div className="space-y-1">
                {d.tasks.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                    <Badge tone={PRIORITY_META[t.priority].tone}>{PRIORITY_META[t.priority].label}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{t.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Progress value={t.progress} tone={t.progress === 100 ? "success" : "brand"} className="max-w-28" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">{t.progress}%</span>
                      </div>
                    </div>
                    <Badge tone={TASK_STATUS_META[t.status].tone} dot>{TASK_STATUS_META[t.status].label}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complaints */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareWarning className="size-4 text-muted-foreground" /> Complaints
            </CardTitle>
            <CardDescription>{d.complaints.length} total · {d.complaintsOpen} open</CardDescription>
          </CardHeader>
          <CardContent>
            {d.complaints.length === 0 ? (
              <EmptyState icon={MessageSquareWarning} title="No complaints" />
            ) : (
              <div className="space-y-1">
                {d.complaints.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{c.content}</p>
                      <p className="text-[11px] text-muted-foreground">{c.customerName} · {formatDate(c.createdAt)}</p>
                    </div>
                    <Badge tone={COMPLAINT_STATUS_META[c.status].tone} dot>{COMPLAINT_STATUS_META[c.status].label}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hygiene audits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SprayCan className="size-4 text-muted-foreground" /> Hygiene Audits
            </CardTitle>
            <CardDescription>{d.hygieneAudits.length} recorded</CardDescription>
          </CardHeader>
          <CardContent>
            {d.hygieneAudits.length === 0 ? (
              <EmptyState icon={SprayCan} title="No audits" />
            ) : (
              <div className="space-y-1">
                {d.hygieneAudits.slice(0, 6).map((h) => (
                  <div key={h.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                    <ScoreRing value={h.hygieneScore} size={36} stroke={4} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{h.shift} shift · {h.inspectorName}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(h.date)}</p>
                    </div>
                    <Badge tone={h.isClean ? "success" : "danger"} dot>{h.isClean ? "Clean" : "Attention"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarRange className="size-4 text-muted-foreground" /> Events
            </CardTitle>
            <CardDescription>{d.events.length} total · {d.eventsRunning} running</CardDescription>
          </CardHeader>
          <CardContent>
            {d.events.length === 0 ? (
              <EmptyState icon={CalendarRange} title="No events" />
            ) : (
              <div className="grid gap-2">
                {d.events.slice(0, 3).map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Button variant="outline" render={<Link href={`/reports/outlet/${d.outlet.id}`} />}>
          View full report
        </Button>
      </div>
    </div>
  );
}
