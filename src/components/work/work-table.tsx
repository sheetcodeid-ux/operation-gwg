"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CircleCheck, CircleDot, Eye, ListChecks, TriangleAlert } from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { formatDate, isOverdue } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail";
import { CategoryFilter, DivisionFilter, PicFilter, MonthFilter, divisionLabel, membersForDivision, monthKey, monthOptions } from "./division-filter";
import { useWorkFilters } from "./use-work-filters";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";

export interface WorkRow {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  division: string;
  outletId: string;
  outlet: string;
  area: string;
  picIds: string[];
  pic: string;
  /** Photo of the first PIC (for the avatar); null → initials fallback. */
  picAvatarUrl?: string | null;
  startDate: string;
  dueDate: string;
  progress: number;
}

export function WorkTable({
  rows,
  outlets,
  coordinators,
  members,
  divisions,
  canEdit,
  isAdmin,
  userDepartment,
  categories,
  initialDivision,
}: {
  rows: WorkRow[];
  outlets?: TaskOutlet[];
  coordinators?: { id: string; name: string }[];
  members?: DivisionMembers;
  divisions?: string[];
  canEdit?: boolean;
  /** Only Super Admin gets the division filter (others see just their dept). */
  isAdmin?: boolean;
  userDepartment?: string;
  categories?: Record<string, string[]>;
  /** Pre-select the department filter (e.g. Super Admin entering a dept's section). */
  initialDivision?: string;
}) {
  const [priority, setPriority] = React.useState<string>("all");
  const [status, setStatus] = React.useState<string>("all");
  // All filters are INSTANT local state — no URL navigation / server round-trip.
  const { month, division, pic, category, setMonth, setDivision, setPic, setCategory } = useWorkFilters(initialDivision);
  const people = React.useMemo(() => membersForDivision(members, division), [members, division]);
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);
  const categoryOpts = React.useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);

  // Scope = month + division + PIC + category. Drives the KPI cards, independent
  // of the priority/status drill-down that only narrows the table rows below.
  const scoped = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (division === "all" || r.division === division) &&
          (pic === "all" || r.picIds.includes(pic)) &&
          (category === "all" || r.category === category) &&
          (month === "all" || monthKey(r.startDate) === month),
      ),
    [rows, division, pic, category, month],
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
        cell: ({ getValue }) => <Badge tone="brand">{divisionLabel(getValue<string>())}</Badge>,
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
              divisions={divisions}
              canEdit={canEdit}
              isAdmin={isAdmin}
              userDepartment={userDepartment}
              categories={categories}
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
    [outlets, coordinators, members, divisions, canEdit, isAdmin, userDepartment, categories],
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
              <div className="flex items-center gap-2">
                <MonthFilter options={months} value={month} onChange={setMonth} className="w-36 shrink-0" />
                {isAdmin && <DivisionFilter value={division} onChange={setDivision} options={divisions} className="w-40 shrink-0" />}
                <PicFilter people={people} value={pic} onChange={setPic} className="w-40 shrink-0" />
                <CategoryFilter options={categoryOpts} value={category} onChange={setCategory} className="w-40 shrink-0" />
                <Combobox
                  portal
                  searchable={false}
                  value={priority}
                  onChange={setPriority}
                  className="w-36 shrink-0"
                  options={[{ value: "all", label: "Semua Prioritas" }, ...(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))]}
                />
                <Combobox
                  portal
                  searchable={false}
                  value={status}
                  onChange={setStatus}
                  className="w-36 shrink-0"
                  options={[{ value: "all", label: "Semua Status" }, ...(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))]}
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
