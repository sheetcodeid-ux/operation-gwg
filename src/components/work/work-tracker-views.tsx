"use client";

import * as React from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { WorkTable, type WorkRow } from "./work-table";
import { KanbanBoard } from "./kanban-board";
import { WorkPerformanceChart } from "./work-performance-chart";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";

type View = "table" | "kanban";

/**
 * Table ⇄ Kanban switch — a pure CLIENT toggle (no navigation), so flipping to
 * Kanban is INSTANT instead of a slow page load. Both views share the same task
 * data, already on the client.
 */
export function WorkTrackerViews({
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
  initialView = "table",
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
  initialDivision?: string;
  initialView?: View;
}) {
  const [view, setView] = React.useState<View>(initialView);
  const shared = { rows, outlets, coordinators, members, divisions, canEdit, isAdmin, userDepartment, categories, initialDivision };
  const defaultDivision = initialDivision && initialDivision !== "all" ? initialDivision : userDepartment;

  return (
    <div>
      <WorkPerformanceChart rows={rows} members={members} divisions={divisions} isAdmin={isAdmin} defaultDivision={defaultDivision} />

      <div className="inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
        {(
          [
            { id: "table", label: "Table", icon: List },
            { id: "kanban", label: "Kanban", icon: LayoutGrid },
          ] as const
        ).map((v) => {
          const active = view === v.id;
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Both mounted; we just show one — switching is instant with no refetch. */}
      <div className={cn("mt-4", view === "table" ? "block" : "hidden")}>
        <WorkTable {...shared} />
      </div>
      <div className={cn("mt-4", view === "kanban" ? "block" : "hidden")}>
        <Card>
          <CardContent className="pt-5">
            <KanbanBoard {...shared} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
