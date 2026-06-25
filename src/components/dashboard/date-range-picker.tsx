"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  PRESETS,
  addMonths,
  diffDays,
  endOfMonth,
  fmt,
  isoOf,
  presetRange,
  resolveRange,
  startOfDay,
  startOfMonth,
} from "@/lib/date-range";
import { Popover } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateRangePicker() {
  const params = useSearchParams();
  const resolved = resolveRange({
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  return (
    <Popover
      align="end"
      contentClassName="w-[680px] max-w-[92vw] p-0"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <CalendarDays className="size-4 text-primary" />
          {resolved.label}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => <RangePanel initialRange={resolved} onClose={close} />}
    </Popover>
  );
}

function RangePanel({
  initialRange,
  onClose,
}: {
  initialRange: ReturnType<typeof resolveRange>;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [from, setFrom] = React.useState<Date>(initialRange.from);
  const [to, setTo] = React.useState<Date | null>(initialRange.to);
  const [anchor, setAnchor] = React.useState<Date>(startOfMonth(initialRange.from));
  const [presetKey, setPresetKey] = React.useState<string | null>(
    initialRange.label === "Custom" ? "custom" : PRESETS.find((p) => p.label === initialRange.label)?.key ?? null,
  );

  function applyPreset(key: string) {
    const r = presetRange(key);
    setFrom(r.from);
    setTo(r.to);
    setAnchor(startOfMonth(r.from));
    setPresetKey(key);
  }

  function pickDay(d: Date) {
    setPresetKey("custom");
    if (!to && d >= from) {
      setTo(d);
    } else {
      setFrom(d);
      setTo(null);
    }
  }

  function apply() {
    const next = new URLSearchParams(params.toString());
    next.set("from", isoOf(from));
    next.set("to", isoOf(to ?? from));
    if (presetKey && presetKey !== "custom") next.set("range", presetKey);
    else next.delete("range");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    onClose();
  }

  const days = to ? diffDays(from, to) : 1;

  return (
    <div className="flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Date</p>
        <button onClick={onClose} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* quick select */}
        <div className="border-b border-border p-2 sm:w-40 sm:border-b-0 sm:border-r">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Select</p>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={cn(
                "block w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                presetKey === p.key ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* calendars */}
        <div className="flex-1 p-4">
          {/* from / to */}
          <div className="mb-3 flex items-center gap-2">
            <DateField label="From" value={fmt(from)} />
            <ChevronRight className="mt-4 size-4 shrink-0 text-muted-foreground" />
            <DateField label="To" value={to ? fmt(to) : "—"} />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setAnchor(addMonths(anchor, -1))} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => setAnchor(addMonths(anchor, 1))} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <MonthGrid month={anchor} from={from} to={to} onPick={pickDay} />
            <MonthGrid month={addMonths(anchor, 1)} from={from} to={to} onPick={pickDay} className="hidden sm:block" />
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">{days} day{days === 1 ? "" : "s"} selected</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={apply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

function DateField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function MonthGrid({
  month,
  from,
  to,
  onPick,
  className,
}: {
  month: Date;
  from: Date;
  to: Date | null;
  onPick: (d: Date) => void;
  className?: string;
}) {
  const first = startOfMonth(month);
  const total = endOfMonth(month).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const fromMs = +startOfDay(from);
  const toMs = to ? +startOfDay(to) : null;

  return (
    <div className={className}>
      <p className="mb-2 text-center text-sm font-medium text-foreground">
        {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const d = new Date(month.getFullYear(), month.getMonth(), day);
          const ms = +startOfDay(d);
          const isFrom = ms === fromMs;
          const isTo = toMs !== null && ms === toMs;
          const inRange = toMs !== null && ms > fromMs && ms < toMs;
          return (
            <button
              key={i}
              onClick={() => onPick(d)}
              className={cn(
                "py-1.5 text-sm tabular-nums transition-colors",
                isFrom || isTo
                  ? "rounded-md bg-primary font-medium text-primary-foreground"
                  : inRange
                    ? "bg-primary/15 text-foreground"
                    : "rounded-md text-foreground/80 hover:bg-muted",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
