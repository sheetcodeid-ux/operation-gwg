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
import { CategoryFilter, DivisionFilter, PicFilter, MonthFilter, divisionLabel, membersForDivision, monthKey, monthOptions } from "./division-filter";
import { useWorkFilters } from "./use-work-filters";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";
import type { WorkRow } from "./work-table";

const COLUMNS = Object.keys(TASK_STATUS_META) as TaskStatus[];

/** Long-press (ms) before a touch turns into a drag. Below this, a swipe scrolls
 *  the board (up/down and sideways) as normal. Mouse drags start immediately. */
const HOLD_MS = 230;
const MOVE_CANCEL = 10; // px of movement that cancels the long-press (= a scroll)

type Gesture = {
  id: string;
  status: TaskStatus;
  x: number;
  y: number;
  pointerId: number;
  el: HTMLElement;
  armed: boolean;
  moved: boolean;
  scrolled: boolean;
  timer: number | null;
};

export function KanbanBoard({
  rows,
  outlets,
  coordinators,
  members,
  divisions,
  canEdit,
  isAdmin,
  userDepartment,
  categories,
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
}) {
  const [tasks, setTasks] = React.useState(rows);
  // Re-sync when the server data changes (after create/edit/delete + router.refresh).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setTasks(rows), [rows]);
  const [, startTransition] = React.useTransition();
  const [drag, setDrag] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [overCol, setOverCol] = React.useState<TaskStatus | null>(null);
  const { month, division, pic, category, setMonth, setDivision, setPic, setCategory } = useWorkFilters();
  const people = React.useMemo(() => membersForDivision(members, division), [members, division]);
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);
  const categoryOpts = React.useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [rows]);
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);
  const g = React.useRef<Gesture | null>(null);
  const openTask = openTaskId !== null ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  function move(id: string, status: TaskStatus) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status, progress: status === "done" ? 100 : t.progress } : t)));
    startTransition(async () => {
      await updateTaskStatusAction(id, status);
    });
  }

  function clearTimer() {
    if (g.current?.timer) {
      window.clearTimeout(g.current.timer);
      g.current.timer = null;
    }
  }

  /** Turn the current press into a drag (finger held still, or a mouse press).
   *  Arming only happens when the finger HASN'T moved, so flipping touch-action
   *  to none here reliably stops the browser scrolling for the rest of the drag. */
  function arm() {
    const s = g.current;
    if (!s || s.armed) return;
    s.armed = true;
    s.timer = null;
    s.el.style.touchAction = "none";
    try {
      s.el.setPointerCapture(s.pointerId);
    } catch {
      /* ignore */
    }
    navigator.vibrate?.(25);
    setDrag({ id: s.id, x: s.x, y: s.y }); // lift immediately for feedback
  }

  function onPointerDown(e: React.PointerEvent, task: WorkRow) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const s: Gesture = { id: task.id, status: task.status, x: e.clientX, y: e.clientY, pointerId: e.pointerId, el, armed: false, moved: false, scrolled: false, timer: null };
    g.current = s;
    if (e.pointerType === "mouse") {
      arm(); // mouse: drag right away (with grab cursor)
    } else {
      s.timer = window.setTimeout(arm, HOLD_MS); // touch/pen: hold to lift
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = g.current;
    if (!s) return;
    const dist = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    if (!s.armed) {
      // Moved before the long-press fired → it's a scroll; let the browser handle it.
      if (dist > MOVE_CANCEL) {
        s.scrolled = true;
        clearTimer();
      }
      return;
    }
    s.moved = true;
    setDrag({ id: s.id, x: e.clientX, y: e.clientY });
    const col = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-status]") as HTMLElement | null;
    setOverCol((col?.dataset.status as TaskStatus | undefined) ?? null);
  }

  function onPointerUp(_e: React.PointerEvent, task: WorkRow) {
    const s = g.current;
    g.current = null;
    if (s?.timer) window.clearTimeout(s.timer);
    if (s) {
      s.el.style.touchAction = "";
      if (s.armed && s.moved) {
        if (overCol && overCol !== task.status) move(s.id, overCol);
      } else if (!s.scrolled) {
        setOpenTaskId(task.id); // a tap (no lift / no scroll) opens the detail
      }
    }
    setDrag(null);
    setOverCol(null);
  }

  const ghost = drag ? tasks.find((t) => t.id === drag.id) : null;
  const visible = tasks.filter(
    (t) =>
      (division === "all" || t.division === division) &&
      (pic === "all" || t.picIds.includes(pic)) &&
      (category === "all" || t.category === category) &&
      (month === "all" || monthKey(t.startDate) === month),
  );

  return (
    <>
      <div className="scroll-fade-x -mx-1 mb-3 flex items-center gap-2 px-1 py-0.5">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">Filter</span>
        <MonthFilter options={months} value={month} onChange={setMonth} className="w-36 shrink-0" />
        {isAdmin && <DivisionFilter value={division} onChange={setDivision} options={divisions} className="w-40 shrink-0" />}
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
                    Tahan lalu geser tugas ke sini
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
          <div className="card-gradient scale-105 rounded-xl p-3 opacity-95 shadow-2xl ring-1 ring-foreground/20">
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
            <TaskDetail task={openTask} outlets={outlets} coordinators={coordinators} members={members} divisions={divisions} canEdit={canEdit} isAdmin={isAdmin} userDepartment={userDepartment} categories={categories} />
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
      // touch-action pan-y: a vertical swipe scrolls the column; a HOLD arms a
      // drag (which flips touch-action to none). Board's horizontal scroll is
      // handled by the outer container.
      style={{ touchAction: "pan-y" }}
      className={cn(
        "card-gradient cursor-grab select-none rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-border active:cursor-grabbing",
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
          <Avatar name={task.pic} size={18} src={task.picAvatarUrl} />
          <span className="max-w-24 truncate">{task.pic}</span>
        </span>
      </div>
    </div>
  );
}
