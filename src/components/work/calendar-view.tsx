"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PRIORITY_META } from "@/lib/constants";
import { cn, isOverdue } from "@/lib/utils";
import { TONE_HEX } from "@/components/ui/tone";
import { TaskDetailDialog } from "./task-detail";
import type { DivisionMembers, TaskOutlet } from "./task-sheet";
import type { WorkRow } from "./work-table";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function CalendarView({
  rows,
  initialYear,
  initialMonth,
  todayKey,
  outlets,
  coordinators,
  members,
  canEdit,
}: {
  rows: WorkRow[];
  initialYear: number;
  initialMonth: number;
  todayKey: string;
  outlets?: TaskOutlet[];
  coordinators?: { id: string; name: string }[];
  members?: DivisionMembers;
  canEdit?: boolean;
}) {
  const [cursor, setCursor] = React.useState({ y: initialYear, m: initialMonth });

  const byDay = React.useMemo(() => {
    const map = new Map<string, WorkRow[]>();
    for (const t of rows) map.set(dayKey(t.dueDate), [...(map.get(dayKey(t.dueDate)) ?? []), t]);
    return map;
  }, [rows]);

  const monthCount = React.useMemo(
    () => rows.filter((t) => dayKey(t.dueDate).startsWith(`${cursor.y}-${cursor.m}-`)).length,
    [rows, cursor],
  );

  const firstWeekday = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.m + delta;
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {MONTHS[cursor.m]} {cursor.y}
          </h3>
          <p className="text-xs text-muted-foreground">{monthCount} tasks due this month</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor({ y: initialYear, m: initialMonth })}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn("pb-1 text-center text-[11px] font-medium", i === 0 || i === 6 ? "text-red-400/80" : "text-muted-foreground")}
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="min-h-28 rounded-xl bg-muted/5" />;
          const key = `${cursor.y}-${cursor.m}-${day}`;
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const weekday = new Date(Date.UTC(cursor.y, cursor.m, day)).getUTCDay();
          const weekend = weekday === 0 || weekday === 6;
          return (
            <div
              key={i}
              className={cn(
                "flex min-h-28 flex-col rounded-xl border p-1.5 transition-colors",
                isToday
                  ? "border-foreground/40 bg-muted/40 ring-1 ring-foreground/15"
                  : weekend
                    ? "border-border/60 bg-red-500/[0.03]"
                    : "border-border bg-muted/10",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full text-[11px] tabular-nums",
                    isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {day}
                </span>
                {items.length > 0 && <span className="text-[10px] tabular-nums text-muted-foreground/70">{items.length}</span>}
              </div>
              <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto">
                {items.slice(0, 3).map((t) => {
                  const overdue = isOverdue(t.dueDate) && t.status !== "done" && t.status !== "cancelled";
                  return (
                    <TaskDetailDialog
                      key={t.id}
                      task={t}
                      outlets={outlets}
                      coordinators={coordinators}
                      members={members}
                      canEdit={canEdit}
                      trigger={
                        <button
                          type="button"
                          title={`${t.title} · ${t.outlet}`}
                          className="flex w-full items-center gap-1 rounded-md bg-muted/60 px-1.5 py-1 text-left text-[10px] transition-colors hover:bg-muted"
                        >
                          <span className="size-1.5 shrink-0 rounded-full" style={{ background: TONE_HEX[PRIORITY_META[t.priority].tone] }} />
                          <span className={cn("truncate", overdue ? "text-red-400" : "text-foreground/90")}>{t.title}</span>
                        </button>
                      }
                    />
                  );
                })}
                {items.length > 3 && (
                  <p className="px-1 text-[10px] font-medium text-muted-foreground">+{items.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="font-medium">Priority:</span>
        {(Object.keys(PRIORITY_META) as (keyof typeof PRIORITY_META)[]).map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: TONE_HEX[PRIORITY_META[p].tone] }} />
            {PRIORITY_META[p].label}
          </span>
        ))}
      </div>
    </div>
  );
}
