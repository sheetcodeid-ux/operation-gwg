"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "./date-picker";

const PANEL_W = 288;
const PANEL_H = 400;

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function fmt(d: Date | null): string {
  if (!d) return "";
  return `${d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Date + time picker in the app's own calendar style (same as the Operation
 * dashboard date select), with an hour/minute row. Value is an ISO string;
 * `onChange` emits an ISO string (or "" when cleared).
 */
export function DateTimePicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const selected = value ? new Date(value) : null;
  const valid = selected && !Number.isNaN(+selected) ? selected : null;
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
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
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

  // Base for edits: current value, or today at 09:00 when empty.
  const base = () => {
    if (valid) return new Date(valid);
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  };
  function pickDate(d: Date) {
    const next = base();
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    onChange(next.toISOString());
  }
  function pickTime(part: "h" | "m", v: number) {
    const next = base();
    if (part === "h") next.setHours(v);
    else next.setMinutes(v);
    onChange(next.toISOString());
  }

  const hh = valid ? valid.getHours() : 9;
  const mm = valid ? valid.getMinutes() : 0;

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
        <span className={cn("truncate", !valid && "text-muted-foreground")}>{valid ? fmt(valid) : "Pilih tanggal & jam"}</span>
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {mounted && open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_W }}
            className="surface-solid z-[60] overflow-hidden rounded-xl shadow-2xl"
          >
            <Calendar selected={valid} onPick={pickDate} />
            <div className="border-t border-border p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Clock className="size-3.5" /> Jam
              </div>
              <div className="flex items-center gap-1.5">
                <TimeSelect value={hh} options={HOURS} onChange={(v) => pickTime("h", v)} />
                <span className="text-sm font-semibold text-muted-foreground">:</span>
                <TimeSelect value={mm} options={MINUTES} onChange={(v) => pickTime("m", v)} />
                <div className="ml-auto flex gap-1">
                  {[
                    { label: "09:00", h: 9, m: 0 },
                    { label: "17:00", h: 17, m: 0 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { const next = base(); next.setHours(p.h, p.m); onChange(next.toISOString()); }}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function TimeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-16 appearance-none rounded-lg border border-input bg-background/40 pl-3 pr-6 text-center text-sm font-medium tabular-nums text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
      >
        {options.map((o) => (
          <option key={o} value={o}>{pad(o)}</option>
        ))}
      </select>
    </div>
  );
}
