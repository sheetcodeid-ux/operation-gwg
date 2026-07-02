"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CircleCheck, CircleDot, Eye, ListChecks, TriangleAlert } from "lucide-react";
import { PRIORITY_META, ROLE_LABEL, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, Role, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { formatDate, isOverdue } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail";
import { DivisionFilter, PicFilter, MonthFilter, membersForDivision, monthKey, monthOptions } from "./division-filter";
import { useWorkFilters } from "./use-work-filters";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";

export interface WorkRow {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  division: Role;
  outletId: string;
  outlet: string;
  area: string;
  picIds: string[];
  pic: string;
  startDate: string;
  dueDate: string;
  progress: number;
}

export function WorkTable({
  rows,
  outlets,
  coordinators,
  members,
  canEdit,
}: {
  rows: WorkRow[];
  outlets?: TaskOutlet[];
  coordinators?: { id: string; name: string }[];
  members?: DivisionMembers;
  canEdit?: boolean;
}) {
  const [priority, setPriority] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  // month / division / pic are shared with the Kanban view via the URL query.
  const { month, division, pic, setMonth, setDivision, setPic } = useWorkFilters();
  const people = React.useMemo(() => membersForDivision(members, division), [members, division]);
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);

  // Scope = month + division + PIC. Drives the KPI cards so they follow the
  // selected month (and division/PIC), independent of the priority/status
  // drill-down filters which only narrow the table rows below.
  const scoped = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (division === "all" || r.division === division) &&
          (pic === "all" || r.picIds.includes(pic)) &&
          (month === "all" || monthKey(r.startDate) === month),
      ),
    [rows, division, pic, month],
  );

  const filtered = React.useMemo(
    () => scoped.filter((r) => (priority === "all" || r.priority === priority) && (status === "all" || r.status === status)),
    [scoped, priority, status],
  );

  const stats = React.useMemo(() => {
    const total = scoped.length;
    const done = scoped.filter((r) => r.status === "done").length;
    const ongoing = scoped.filter((r) => r.status === "ongoing").length;
    const overdue = scoped.filter((r) => isOverdue(r.dueDate) && r.status !== "done" && r.status !== "cancelled").length;
    return { total, ongoing, overdue, completion: total ? Math.round((done / total) * 100) : 0 };
  }, [scoped]);

  const columns = React.useMemo<ColumnDef<WorkRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Task",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.outlet}</p>
          </div>
        ),
      },
      {
        accessorKey: "division",
        header: "Division",
        cell: ({ getValue }) => <Badge tone="brand">{ROLE_LABEL[getValue<Role>()]}</Badge>,
      },
      { accessorKey: "category", header: "Category", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ getValue }) => {
          const p = getValue<Priority>();
          return <Badge tone={PRIORITY_META[p].tone}>{PRIORITY_META[p].label}</Badge>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<TaskStatus>();
          return <Badge tone={TASK_STATUS_META[s].tone} dot>{TASK_STATUS_META[s].label}</Badge>;
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
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ row }) => {
          const overdue = isOverdue(row.original.dueDate) && row.original.status !== "done" && row.original.status !== "cancelled";
          return (
            <span className={overdue ? "inline-flex items-center gap-1 text-red-300" : "text-muted-foreground"}>
              {overdue && <AlertTriangle className="size-3" />}
              {formatDate(row.original.dueDate)}
            </span>
          );
        },
      },
      { accessorKey: "pic", header: "Person in Charge", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TaskDetailDialog
              task={row.original}
              outlets={outlets}
              coordinators={coordinators}
              members={members}
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
    [outlets, coordinators, members, canEdit],
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ListChecks} label="Total Tasks" value={stats.total} tone="brand" />
        <StatTile icon={CircleDot} label="Ongoing" value={stats.ongoing} tone="cyan" />
        <StatTile icon={CircleCheck} label="Completion Rate" value={`${stats.completion}%`} tone="success" />
        <StatTile icon={TriangleAlert} label="Overdue" value={stats.overdue} tone="danger" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="work-tracker"
            columns={columns}
            data={filtered}
            searchPlaceholder="Search tasks…"
            toolbar={
              <div className="contents">
                <MonthFilter options={months} value={month} onChange={setMonth} className="min-w-0 shrink basis-40" />
                <DivisionFilter value={division} onChange={setDivision} className="min-w-0 shrink basis-44" />
                <PicFilter people={people} value={pic} onChange={setPic} className="min-w-0 shrink basis-40" />
                <Combobox
                  value={priority}
                  onChange={setPriority}
                  className="min-w-0 shrink basis-36"
                  options={[{ value: "all", label: "All priority" }, ...(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))]}
                />
                <Combobox
                  value={status}
                  onChange={setStatus}
                  className="min-w-0 shrink basis-36"
                  options={[{ value: "all", label: "All status" }, ...(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))]}
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
