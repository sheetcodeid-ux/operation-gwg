"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Eye } from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { formatDate, isOverdue } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail";
import { divisionLabel } from "./division-filter";
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

/**
 * Presentational task table — filtering (month/division/PIC/category/priority/
 * status) is owned by the parent WorkTrackerViews and rendered ONCE above the
 * chart, so this only shows the rows + the search / export / column controls.
 */
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
  toolbar,
}: {
  rows: WorkRow[];
  outlets?: TaskOutlet[];
  coordinators?: { id: string; name: string }[];
  members?: DivisionMembers;
  divisions?: string[];
  canEdit?: boolean;
  isAdmin?: boolean;
  userDepartment?: string;
  categories?: Record<string, string[]>;
  /** Left-aligned content on the table's control row (e.g. the view toggle). */
  toolbar?: React.ReactNode;
}) {
  const columns = React.useMemo<ColumnDef<WorkRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Task",
        cell: ({ row }) => (
          // Cap the width so long titles ellipsize (…) instead of stretching the row.
          <div className="min-w-0 max-w-[15rem]">
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
    <DataTable
      tableId="work-tracker"
      columns={columns}
      data={rows}
      searchPlaceholder="Search tasks…"
      toolbar={toolbar}
      // Scroll only sideways for the wide table; the page handles up/down
      // (no nested vertical box → no diagonal "geser semua arah").
      stickyHeader={false}
    />
  );
}
