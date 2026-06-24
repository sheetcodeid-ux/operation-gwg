"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/input";
import { formatDate, isOverdue } from "@/lib/utils";

export interface WorkRow {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  outlet: string;
  pic: string;
  dueDate: string;
  progress: number;
}

export function WorkTable({ rows }: { rows: WorkRow[] }) {
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
        header: "Due",
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
      { accessorKey: "pic", header: "PIC", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      searchPlaceholder="Search tasks…"
      toolbar={
        <div className="flex gap-2">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-32">
            <option value="all">All priority</option>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32">
            <option value="all">All status</option>
            {(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>
      }
    />
  );
}
