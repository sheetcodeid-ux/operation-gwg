"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { CalendarRange, CheckCheck, Eye, PlayCircle, Wallet } from "lucide-react";
import { EVENT_MILESTONES, EVENT_STATUS_META } from "@/lib/constants";
import type { EventMilestone, EventStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat";
import { formatDate, formatIDR } from "@/lib/utils";
import { monthOptions } from "@/components/work/division-filter";
import { EventDetailDialog } from "./event-detail";
import { EventFilters, filterEvents } from "./event-filters";
import { useEventFilters } from "./use-event-filters";
import type { EventOutlet } from "./event-data";

export interface EventRow {
  id: string;
  name: string;
  description: string;
  outletId: string;
  outlet: string;
  areaId: string;
  area: string;
  picId: string;
  pic: string;
  budget: number;
  startDate: string;
  endDate: string;
  milestone: EventMilestone;
  status: EventStatus;
  progress: number;
}

const milestoneLabel = (m: EventMilestone) => EVENT_MILESTONES.find((x) => x.value === m)?.label ?? m;

export function EventTable({
  rows,
  outlets,
  coordinators,
  canEdit,
}: {
  rows: EventRow[];
  outlets: EventOutlet[];
  coordinators: { id: string; name: string }[];
  canEdit?: boolean;
}) {
  const filters = useEventFilters();
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);
  const scoped = React.useMemo(() => filterEvents(rows, filters), [rows, filters]);

  const stats = React.useMemo(() => {
    const running = scoped.filter((e) => e.status === "running").length;
    const finished = scoped.filter((e) => e.status === "finished").length;
    const budget = scoped.reduce((a, b) => a + b.budget, 0);
    return { total: scoped.length, running, finished, budget };
  }, [scoped]);

  const columns = React.useMemo<ColumnDef<EventRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Event",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.outlet}</p>
          </div>
        ),
      },
      { accessorKey: "area", header: "Area", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "pic", header: "Coordinator Area", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        accessorKey: "budget",
        header: "Budget",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/90">{formatIDR(getValue<number>())}</span>,
      },
      {
        accessorKey: "milestone",
        header: "Milestone",
        cell: ({ getValue }) => <Badge tone="brand">{milestoneLabel(getValue<EventMilestone>())}</Badge>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<EventStatus>();
          return (
            <Badge tone={EVENT_STATUS_META[s].tone} dot>
              {EVENT_STATUS_META[s].label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "progress",
        header: "Progress",
        cell: ({ row }) => (
          <div className="flex w-28 items-center gap-2">
            <Progress value={row.original.progress} tone={row.original.progress === 100 ? "success" : "brand"} />
            <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{row.original.progress}%</span>
          </div>
        ),
      },
      {
        accessorKey: "startDate",
        header: "Schedule",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.startDate)} → {formatDate(row.original.endDate)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <EventDetailDialog
              event={row.original}
              outlets={outlets}
              coordinators={coordinators}
              canEdit={canEdit}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Eye className="size-3.5" /> View
                </button>
              }
            />
          </div>
        ),
      },
    ],
    [outlets, coordinators, canEdit],
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={CalendarRange} label="Total Events" value={stats.total} />
        <StatTile icon={PlayCircle} label="Running" value={stats.running} />
        <StatTile icon={CheckCheck} label="Finished" value={stats.finished} />
        <StatTile icon={Wallet} label="Total Budget" value={formatIDR(stats.budget)} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>All Events</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="event-tracker"
            columns={columns}
            data={scoped}
            searchPlaceholder="Search events…"
            toolbar={<EventFilters months={months} outlets={outlets} />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
