"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Eye } from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, Role, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { Combobox } from "@/components/ui/combobox";
import { formatDate, isOverdue } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail";
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

  const filtered = React.useMemo(
    () => rows.filter((r) => (priority === "all" || r.priority === priority) && (status === "all" || r.status === status)),
    [rows, priority, status],
  );

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
    <DataTable
      tableId="work-tracker"
      columns={columns}
      data={filtered}
      searchPlaceholder="Search tasksâ€¦"
      toolbar={
        <div className="flex gap-2">
          <Combobox
            value={priority}
            onChange={setPriority}
            className="w-36"
            options={[{ value: "all", label: "All priority" }, ...(Object.keys(PRIORITY_META) as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))]}
          />
          <Combobox
            value={status}
            onChange={setStatus}
            className="w-36"
            options={[{ value: "all", label: "All status" }, ...(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))]}
          />
        </div>
      }
    />
  );
}
