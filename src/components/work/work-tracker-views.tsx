"use client";

import * as React from "react";
import { LayoutGrid, List } from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { WorkTable, type WorkRow } from "./work-table";
import { KanbanBoard } from "./kanban-board";
import { WorkPerformanceChart } from "./work-performance-chart";
import { WorkRoleDonut } from "./work-role-donut";
import { CategoryFilter, DivisionFilter, PicFilter, membersForDivision } from "./division-filter";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";

type View = "table" | "kanban";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM" dari sebuah tanggal ISO (potong langsung, konsisten dgn chart). */
const monthPrefix = (iso: string) => (iso || "").slice(0, 7);

/**
 * Table ⇄ Kanban switch — a pure CLIENT toggle (no navigation), so flipping to
 * Kanban is INSTANT instead of a slow page load. Both views share the same task
 * data + the SAME filter bar (rendered once, on top). The month filter is shared
 * with the performance chart: change the month → table & kanban follow.
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

  // One shared filter set for the chart, the table AND the kanban.
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth()); // 0–11, shared with chart
  const [division, setDivisionState] = React.useState(initialDivision ?? "all");
  const [pic, setPic] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [priority, setPriority] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const setDivision = React.useCallback((v: string) => {
    setDivisionState(v);
    setPic("all"); // member list differs per division
  }, []);

  // PIC list scoped to the department being viewed. A non-admin (department
  // account) has no division dropdown, so it must be locked to their OWN
  // department — otherwise "Semua" leaks PICs from every other department.
  const people = React.useMemo(
    () => membersForDivision(members, isAdmin ? division : userDepartment || division),
    [members, division, isAdmin, userDepartment],
  );
  const categoryOpts = React.useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const deptOptions = React.useMemo(() => (divisions ?? []).filter((d) => d && d !== "all"), [divisions]);
  // The chart is ALWAYS per-department: use the picked division, else the user's
  // own department (member), else the first department (admin on "Semua").
  const chartDept = division !== "all" ? division : userDepartment || deptOptions[0] || "";

  const selKey = `${now.getFullYear()}-${pad(month + 1)}`;
  // Scope = month + division + PIC + category (drives kanban + is the table base).
  const scoped = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (division === "all" || r.division === division) &&
          (pic === "all" || r.picIds.includes(pic)) &&
          (category === "all" || r.category === category) &&
          monthPrefix(r.startDate) === selKey,
      ),
    [rows, division, pic, category, selKey],
  );
  // The table adds the priority/status drill-down on top of the scope.
  const tableRows = React.useMemo(
    () => scoped.filter((r) => (priority === "all" || r.priority === priority) && (status === "all" || r.status === status)),
    [scoped, priority, status],
  );

  const shared = { outlets, coordinators, members, divisions, canEdit, isAdmin, userDepartment, categories };

  return (
    <div>
      {/* Shared filter bar — swipes horizontally on small screens. */}
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox
          portal
          searchable={false}
          className="w-36 shrink-0"
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
        />
        {isAdmin && <DivisionFilter value={division} onChange={setDivision} options={divisions} className="w-44 shrink-0" />}
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

      {/* Performance chart + per-jabatan donut — TABLE view only (hidden on Kanban). */}
      {view === "table" && (
        <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[1.7fr_1fr]">
          <WorkPerformanceChart rows={rows} members={members} month={month} department={chartDept} />
          <WorkRoleDonut rows={rows} members={members} department={chartDept} />
        </div>
      )}

      {/* Both mounted; we just show one — switching is instant with no refetch.
          The Table/Kanban toggle lives on the same row as the table controls
          (search/export/columns) so they align. On Kanban it sits on its own row. */}
      <div className={view === "table" ? "block" : "hidden"}>
        <WorkTable rows={tableRows} toolbar={<ViewToggle view={view} setView={setView} />} {...shared} />
      </div>
      <div className={view === "kanban" ? "block" : "hidden"}>
        <div className="mb-4">
          <ViewToggle view={view} setView={setView} />
        </div>
        <KanbanBoard rows={scoped} {...shared} />
      </div>
    </div>
  );
}

/** Table ⇄ Kanban segmented toggle (shared by both view rows). */
function ViewToggle({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
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
  );
}
