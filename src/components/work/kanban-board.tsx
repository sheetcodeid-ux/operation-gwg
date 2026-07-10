"use client";

import * as React from "react";
import { TASK_STATUS_META, PRIORITY_META } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";
import { updateTaskStatusAction } from "@/lib/actions/work";
import { cn, formatDate, isOverdue } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TONE_HEX } from "@/components/ui/tone";
import { Avatar } from "@/components/ui/avatar";
import { bodyZoom } from "@/components/layout/fit-scale";
import { TaskDetail } from "./task-detail";
import { DivisionFilter, PicFilter, MonthFilter, divisionLabel, membersForDivision, monthKey, monthOptions } from "./division-filter";
import { useWorkFilters } from "./use-work-filters";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";
import type { WorkRow } from "./work-table";

const COLUMNS = Object.keys(TASK_STATUS_META) as TaskStatus[];

export function KanbanBoard({
  rows,
  outlets,
  coordinators,
  members,
  divisions,
  canEdit,
}: {
  rows: WorkRow[];
  outlets?: TaskOutlet[];
  coordinators?: { id: string; name: string }[];
  members?: DivisionMembers;
  divisions?: string[];
  canEdit?: boolean;
}) {
  const [tasks, setTasks] = React.useState(rows);
  // Re-sync when the server data changes (after create/edit/delete + router.refresh).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setTasks(rows), [rows]);
  const [, startTransition] = React.useTransition();
  const [drag, setDrag] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [overCol, setOverCol] = React.useState<TaskStatus | null>(null);
  // month / division / pic are shared with the Table view via the URL query.
  const { month, division, pic, setMonth, setDivision, setPic } = useWorkFilters();
  const people = React.useMemo(() => membersForDivision(members, division), [members, division]);
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);
  const startRef = React.useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  // Live task for the detail dialog (re-derived from synced `tasks`, so edits reflect without reopening).
  const openTask = openTaskId !== null ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  function move(id: string, status: TaskStatus) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status, progress: status === "done" ? 100 : t.progress } : t)));
    startTransition(async () => {
      await updateTaskStatusAction(id, status);
    });
  }

  function onPointerDown(e: React.PointerEvent, task: WorkRow) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    startRef.current = { id: task.id, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = startRef.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
    s.moved = true;
    setDrag({ id: s.id, x: e.clientX, y: e.clientY });
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-status]") as HTMLElement | null;
    setOverCol((el?.dataset.status as TaskStatus | undefined) ?? null);
  }

  function onPointerUp(_e: React.PointerEvent, task: WorkRow) {
    const s = startRef.current;
    startRef.current = null;
    if (s?.moved) {
      if (overCol && overCol !== task.status) move(s.id, overCol);
    } else {
      setOpenTaskId(task.id);
    }
    setDrag(null);
    setOverCol(null);
  }

  const ghost = drag ? tasks.find((t) => t.id === drag.id) : null;
  const visible = tasks.filter(
    (t) =>
      (division === "all" || t.division === division) &&
      (pic === "all" || t.picIds.includes(pic)) &&
      (month === "all" || monthKey(t.startDate) === month),
  );

  return (
    <>
      <div className="no-scrollbar -mx-0.5 mb-3 flex items-center gap-2 overflow-x-auto px-0.5 py-0.5">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Filter</span>
        <MonthFilter options={months} value={month} onChange={setMonth} className="w-36 shrink-0" />
        <DivisionFilter value={division} onChange={setDivision} options={divisions} className="w-40 shrink-0" />
        <PicFilter people={people} value={pic} onChange={setPic} className="w-40 shrink-0" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((status) => {
          const meta = TASK_STATUS_META[status];
          const color = TONE_HEX[meta.tone];
          const items = visible.filter((t) => t.status === status);
          const isOver = overCol === status;
          return (
            <div
              key={status}
              data-status={status}
              className={cn(
                "flex w-[19rem] shrink-0 flex-col overflow-hidden rounded-2xl border bg-muted/15 transition-colors",
                isOver ? "border-foreground/30 bg-muted/40 ring-2 ring-foreground/10" : "border-border",
              )}
            >
              <div className="h-1 w-full" style={{ background: color }} />
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: color }} />
                  {meta.label}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="no-scrollbar flex max-h-[32rem] min-h-28 flex-1 flex-col gap-2.5 overflow-y-auto p-3 pt-0">
                {items.map((t) => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    dragging={drag?.id === t.id}
                    onPointerDown={(e) => onPointerDown(e, t)}
                    onPointerMove={onPointerMove}
                    onPointerUp={(e) => onPointerUp(e, t)}
                  />
                ))}
                {items.length === 0 && (
                  <div
                    className={cn(
                      "grid flex-1 place-items-center rounded-xl border border-dashed text-[11px] transition-colors",
                      isOver ? "border-foreground/30 text-foreground/70" : "border-border/60 text-muted-foreground/60",
                    )}
                  >
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating drag ghost (pointer coords are visual px — undo body zoom) */}
      {ghost && drag && (
        <div
          className="pointer-events-none fixed z-[60] w-64 -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.x / bodyZoom(), top: drag.y / bodyZoom() }}
        >
          <div className="card-gradient rounded-xl p-3 opacity-95 shadow-2xl ring-1 ring-border">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-medium text-foreground">{ghost.title}</p>
              <Badge tone={PRIORITY_META[ghost.priority].tone}>{PRIORITY_META[ghost.priority].label}</Badge>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{ghost.outlet}</p>
          </div>
        </div>
      )}

      {/* Tap → detail (with Edit/Delete) */}
      {openTask && (
        <Dialog open onOpenChange={(o) => !o && setOpenTaskId(null)}>
          <DialogContent title={openTask.title} description={`${openTask.outlet} · ${openTask.area}`} align="center" className="max-w-md">
            <TaskDetail task={openTask} outlets={outlets} coordinators={coordinators} members={members} divisions={divisions} canEdit={canEdit} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function KanbanCard({
  task,
  dragging,
  ...handlers
}: { task: WorkRow; dragging: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  const overdue = isOverdue(task.dueDate) && task.status !== "done" && task.status !== "cancelled";
  return (
    <div
      {...handlers}
      className={cn(
        "card-gradient touch-none cursor-grab select-none rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-border active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{task.title}</p>
        <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Badge tone="brand">{divisionLabel(task.division)}</Badge>
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {task.outlet} · {task.area}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={task.progress} tone={task.progress === 100 ? "success" : "brand"} />
        <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{task.progress}%</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11px]">
        <span className={cn(overdue ? "font-medium text-red-400" : "text-muted-foreground")}>{formatDate(task.dueDate)}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Avatar name={task.pic} size={18} />
          <span className="max-w-24 truncate">{task.pic}</span>
        </span>
      </div>
    </div>
  );
}
