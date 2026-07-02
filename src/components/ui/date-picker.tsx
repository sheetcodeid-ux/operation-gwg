"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, endOfMonth, startOfDay, startOfMonth } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PANEL_W = 288;
const PANEL_H = 320;

function parse(value: string): Date {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(+d) ? new Date(2026, 5, 1) : d;
}
function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function label(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** Single-date calendar picker (month + day). Portaled + viewport-clamped so it never clips inside scroll/sheet containers. */
export function DatePicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const selected = value ? parse(value) : null;
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

  const place = React.useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // FitScale may zoom the body on small screens; getBoundingClientRect
    // returns visual px while fixed positions inside the zoomed body are
    // laid out in logical px — divide to compensate.
    const z = parseFloat(document.body.style.zoom || "1") || 1;
    const panelW = PANEL_W * z;
    const panelH = PANEL_H * z;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - panelW - 8);
    const below = r.bottom + 4;
    const top = below + panelH > window.innerHeight ? Math.max(8, r.top - panelH - 4) : below;
    setPos({ top: top / z, left: left / z });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  function toggle() {
    if (!open) place();
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-3 text-left text-sm transition-colors hover:bg-muted/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? label(selected) : "Pilih tanggal"}</span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_W }}
            className="surface-solid z-[60] rounded-xl shadow-2xl"
          >
            <Calendar
              selected={selected}
              onPick={(d) => {
                onChange(isoOf(d));
                setOpen(false);
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function Calendar({ selected, onPick }: { selected: Date | null; onPick: (d: Date) => void }) {
  const [anchor, setAnchor] = React.useState<Date>(startOfMonth(selected ?? new Date(2026, 5, 1)));
  const first = startOfMonth(anchor);
  const total = endOfMonth(anchor).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const selMs = selected ? +startOfDay(selected) : null;

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAnchor(addMonths(anchor, -1))}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-medium text-foreground">{anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        <button
          type="button"
          onClick={() => setAnchor(addMonths(anchor, 1))}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const d = new Date(anchor.getFullYear(), anchor.getMonth(), day);
          const isSel = selMs !== null && +startOfDay(d) === selMs;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(d)}
              className={cn(
                "rounded-md py-1.5 text-sm tabular-nums transition-colors",
                isSel ? "bg-primary font-medium text-primary-foreground" : "text-foreground/80 hover:bg-muted",
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
