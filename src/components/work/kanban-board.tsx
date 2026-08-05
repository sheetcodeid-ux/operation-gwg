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
import { divisionLabel } from "./division-filter";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";
import type { WorkRow } from "./work-table";

const COLUMNS = Object.keys(TASK_STATUS_META) as TaskStatus[];

/** Long-press (ms) before a touch turns into a drag. Below this, a swipe scrolls
 *  the board (up/down and sideways) as normal. Mouse drags start immediately. */
const HOLD_MS = 230;
const MOVE_CANCEL = 10; // px of movement that cancels the long-press (= a scroll)
const EDGE = 60; // px from a board edge where auto-scroll kicks in while dragging
const EDGE_MAX = 20; // max px/frame auto-scroll speed

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
  // Re-sync when the server data OR the parent filters change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setTasks(rows), [rows]);
  const [, startTransition] = React.useTransition();
  const [drag, setDrag] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [overCol, setOverCol] = React.useState<TaskStatus | null>(null);
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);
  const g = React.useRef<Gesture | null>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const posRef = React.useRef({ x: 0, y: 0 });
  const autoRef = React.useRef<number | null>(null);
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

  /** Which column sits under this x position. Falls back to the nearest column
   *  so a drop just past the first/last one still lands where the user aimed. */
  function columnAt(x: number): TaskStatus | null {
    const el = boardRef.current;
    if (!el) return null;
    const cols = [...el.querySelectorAll<HTMLElement>("[data-status]")];
    let nearest: { d: number; status: TaskStatus } | null = null;
    for (const c of cols) {
      const r = c.getBoundingClientRect();
      const status = c.dataset.status as TaskStatus | undefined;
      if (!status) continue;
      if (x >= r.left && x <= r.right) return status;
      const d = x < r.left ? r.left - x : x - r.right;
      if (!nearest || d < nearest.d) nearest = { d, status };
    }
    return nearest?.status ?? null;
  }

  /** While a card is lifted, auto-scroll the board sideways when the finger sits
   *  near a horizontal edge — so a card can reach columns that are off-screen
   *  (previously it felt "stuck" on mobile). */
  function startAutoScroll() {
    if (autoRef.current != null) return;
    const step = () => {
      const el = boardRef.current;
      if (!el || !g.current?.armed) {
        autoRef.current = null;
        return;
      }
      const rect = el.getBoundingClientRect();
      const x = posRef.current.x;
      let dx = 0;
      if (x < rect.left + EDGE) dx = -Math.ceil(((rect.left + EDGE - x) / EDGE) * EDGE_MAX);
      else if (x > rect.right - EDGE) dx = Math.ceil(((x - (rect.right - EDGE)) / EDGE) * EDGE_MAX);
      if (dx !== 0) {
        el.scrollLeft += dx;
        // Board moved under the finger → re-detect the column beneath it.
        setOverCol(columnAt(x));
      }
      autoRef.current = requestAnimationFrame(step);
    };
    autoRef.current = requestAnimationFrame(step);
  }
  function stopAutoScroll() {
    if (autoRef.current != null) {
      cancelAnimationFrame(autoRef.current);
      autoRef.current = null;
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
    startAutoScroll();
  }

  function onPointerDown(e: React.PointerEvent, task: WorkRow) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    posRef.current = { x: e.clientX, y: e.clientY };
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
    posRef.current = { x: e.clientX, y: e.clientY };
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
    setOverCol(columnAt(e.clientX));
  }

  function onPointerUp(_e: React.PointerEvent, task: WorkRow) {
    const s = g.current;
    g.current = null;
    stopAutoScroll();
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

  /** The browser took over the gesture to SCROLL (fired once it commits to a
   *  pan). Cancel the pending long-press so a card never lifts mid-scroll. */
  function onPointerCancel() {
    const s = g.current;
    if (!s) return;
    stopAutoScroll();
    if (s.timer) window.clearTimeout(s.timer);
    if (s.armed) s.el.style.touchAction = "";
    g.current = null;
    setDrag(null);
    setOverCol(null);
  }

  const ghost = drag ? tasks.find((t) => t.id === drag.id) : null;

  return (
    <>
      <div ref={boardRef} className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((status) => {
          const meta = TASK_STATUS_META[status];
          const color = TONE_HEX[meta.tone];
          const items = tasks.filter((t) => t.status === status);
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
                    onPointerCancel={onPointerCancel}
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

      {/* Floating drag ghost — the FULL card, following the finger. Pointer coords
          are visual px, so we clamp them to the viewport (keeping the whole card
          on screen) and then undo the body zoom for positioning. */}
      {ghost && drag && <DragGhost task={ghost} x={drag.x} y={drag.y} />}

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

/** The card's inner content — shared by the column card and the drag ghost so
 *  the floating card looks EXACTLY like the real one (full content, not a stub). */
function TaskCardBody({ task }: { task: WorkRow }) {
  const overdue = isOverdue(task.dueDate) && task.status !== "done" && task.status !== "cancelled";
  return (
    <>
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
    </>
  );
}

function KanbanCard({
  task,
  dragging,
  ...handlers
}: { task: WorkRow; dragging: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...handlers}
      // touch-action pan-x pan-y: a swipe (any direction) scrolls the board/column;
      // a HOLD arms a drag (which flips touch-action to none for the rest of the
      // gesture). This keeps scrolling smooth and only lifts a card when held.
      style={{ touchAction: "pan-x pan-y" }}
      className={cn(
        "card-gradient cursor-grab select-none rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-border active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <TaskCardBody task={task} />
    </div>
  );
}

/** The lifted card that follows the finger. It renders the full card content and
 *  stays fully on screen (clamped to the viewport) so it's never cut off at an
 *  edge. `translate3d` keeps the follow buttery-smooth (GPU compositing). */
function DragGhost({ task, x, y }: { task: WorkRow; x: number; y: number }) {
  const zoom = bodyZoom();
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const HALF_W = 136; // half of the 16rem card + a little breathing room
  const HALF_H = 90;
  const cx = vw ? Math.min(Math.max(x, HALF_W), vw - HALF_W) : x;
  const cy = vh ? Math.min(Math.max(y, HALF_H), vh - HALF_H) : y;
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[60] w-64 will-change-transform"
      style={{ transform: `translate3d(${cx / zoom}px, ${cy / zoom}px, 0) translate(-50%, -50%) scale(1.03)` }}
    >
      <div className="card-gradient rounded-xl p-3 opacity-95 shadow-2xl ring-1 ring-foreground/25">
        <TaskCardBody task={task} />
      </div>
    </div>
  );
}
