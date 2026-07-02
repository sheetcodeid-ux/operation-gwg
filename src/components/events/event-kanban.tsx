"use client";

import * as React from "react";
import { Wallet } from "lucide-react";
import { EVENT_MILESTONES, EVENT_STATUS_META } from "@/lib/constants";
import type { EventMilestone } from "@/lib/types";
import { updateEventMilestoneAction } from "@/lib/actions/events";
import { cn, formatDate, formatIDR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { bodyZoom } from "@/components/layout/fit-scale";
import { monthOptions } from "@/components/work/division-filter";
import { EventDetail } from "./event-detail";
import { EventFilters, filterEvents } from "./event-filters";
import { useEventFilters } from "./use-event-filters";
import type { EventOutlet } from "./event-data";
import type { EventRow } from "./event-table";

const COLUMNS = EVENT_MILESTONES;
const COLUMN_COLOR: Record<EventMilestone, string> = {
  planning: "#06b6d4",
  preparation: "#3b82f6",
  execution: "#8b5cf6",
  evaluation: "#22c55e",
};

export function EventKanban({
  rows,
  outlets,
  coordinators,
  canEdit,
}: {
  rows: EventRow[];
  outlets: EventOutlet[];
  coordinators: { id: string; name: string }[];
  canEdit?: boolean;
}) {
  const filters = useEventFilters();
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);
  const [events, setEvents] = React.useState(rows);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setEvents(rows), [rows]);
  const [, startTransition] = React.useTransition();
  const [drag, setDrag] = React.useState<{ id: string; x: number; y: number } | null>(null);
  const [overCol, setOverCol] = React.useState<EventMilestone | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const startRef = React.useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  const visible = filterEvents(events, filters);
  const openEvent = openId !== null ? events.find((e) => e.id === openId) ?? null : null;

  function move(id: string, milestone: EventMilestone) {
    const progress = EVENT_MILESTONES.find((m) => m.value === milestone)?.progress ?? 0;
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, milestone, progress } : e)));
    startTransition(async () => {
      await updateEventMilestoneAction(id, milestone);
    });
  }

  function onPointerDown(e: React.PointerEvent, ev: EventRow) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    startRef.current = { id: ev.id, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = startRef.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
    s.moved = true;
    setDrag({ id: s.id, x: e.clientX, y: e.clientY });
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-milestone]") as HTMLElement | null;
    setOverCol((el?.dataset.milestone as EventMilestone | undefined) ?? null);
  }
  function onPointerUp(_e: React.PointerEvent, ev: EventRow) {
    const s = startRef.current;
    startRef.current = null;
    if (s?.moved) {
      if (overCol && overCol !== ev.milestone) move(s.id, overCol);
    } else {
      setOpenId(ev.id);
    }
    setDrag(null);
    setOverCol(null);
  }

  const ghost = drag ? events.find((e) => e.id === drag.id) : null;

  return (
    <>
      <div className="mb-3">
        <EventFilters months={months} outlets={outlets} />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const color = COLUMN_COLOR[col.value];
          const items = visible.filter((e) => e.milestone === col.value);
          const isOver = overCol === col.value;
          return (
            <div
              key={col.value}
              data-milestone={col.value}
              className={cn(
                "flex w-[19rem] shrink-0 flex-col overflow-hidden rounded-2xl border bg-muted/15 transition-colors",
                isOver ? "border-foreground/30 bg-muted/40 ring-2 ring-foreground/10" : "border-border",
              )}
            >
              <div className="h-1 w-full" style={{ background: color }} />
              <div className="flex items-center justify-between px-3.5 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: color }} />
                  {col.label}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="no-scrollbar flex max-h-[32rem] min-h-28 flex-1 flex-col gap-2.5 overflow-y-auto p-3 pt-0">
                {items.map((e) => (
                  <EventCardMini
                    key={e.id}
                    event={e}
                    dragging={drag?.id === e.id}
                    onPointerDown={(ev) => onPointerDown(ev, e)}
                    onPointerMove={onPointerMove}
                    onPointerUp={(ev) => onPointerUp(ev, e)}
                  />
                ))}
                {items.length === 0 && (
                  <div
                    className={cn(
                      "grid flex-1 place-items-center rounded-xl border border-dashed text-[11px] transition-colors",
                      isOver ? "border-foreground/30 text-foreground/70" : "border-border/60 text-muted-foreground/60",
                    )}
                  >
                    Drop events here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ghost && drag && (
        <div
          className="pointer-events-none fixed z-[60] w-64 -translate-x-1/2 -translate-y-1/2"
          style={{ left: drag.x / bodyZoom(), top: drag.y / bodyZoom() }}
        >
          <div className="card-gradient rounded-xl p-3 opacity-95 shadow-2xl ring-1 ring-border">
            <p className="line-clamp-2 text-sm font-medium text-foreground">{ghost.name}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{ghost.outlet}</p>
          </div>
        </div>
      )}

      {openEvent && (
        <Dialog open onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogContent title={openEvent.name} description={`${openEvent.outlet} · ${openEvent.area}`} align="center" className="max-w-md">
            <EventDetail event={openEvent} outlets={outlets} coordinators={coordinators} canEdit={canEdit} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function EventCardMini({
  event,
  dragging,
  ...handlers
}: { event: EventRow; dragging: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...handlers}
      className={cn(
        "card-gradient touch-none cursor-grab select-none rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-border active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{event.name}</p>
        <Badge tone={EVENT_STATUS_META[event.status].tone} dot>
          {EVENT_STATUS_META[event.status].label}
        </Badge>
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">
        {event.outlet} · {event.area}
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Wallet className="size-3" /> {formatIDR(event.budget)}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={event.progress} tone={event.progress === 100 ? "success" : "brand"} />
        <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">{event.progress}%</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11px]">
        <span className="text-muted-foreground">{formatDate(event.startDate)}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Avatar name={event.pic} size={18} />
          <span className="max-w-24 truncate">{event.pic}</span>
        </span>
      </div>
    </div>
  );
}
