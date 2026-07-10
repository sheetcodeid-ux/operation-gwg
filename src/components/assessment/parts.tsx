"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Label } from "@/components/ui/input";
import type { ScoreOption } from "@/lib/assessment/config";

/** Gray uppercase mini-heading — the ".sl" section label used across the app. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70", className)}>
      {children}
    </p>
  );
}

/** Labeled custom dropdown (app Combobox) — replaces native selects. */
export function Dropdown({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  searchable = false,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Enable the type-to-filter box (only for long lists like employee names). */
  searchable?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}</Label>}
      <Combobox
        portal
        matchTriggerWidth
        searchable={searchable}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder ?? "Pilih…"}
        searchPlaceholder="Cari nama…"
        disabled={disabled}
      />
    </div>
  );
}

/**
 * A row of controls that stacks into a horizontal, swipeable scroller on
 * mobile (with left/right chevrons) and becomes a grid on ≥sm. Fixes the
 * "tumpang tindih" cramping on phones (spec revisi §9).
 */
export function ScrollRow({ children, cols = 3, className }: { children: React.ReactNode; cols?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const nudge = (dir: number) => ref.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  // A single column needs no scroller — keep the child full-width so it aligns
  // with the full-width cards around it (no big/small mismatch).
  if (cols === 1) return <div className={cn("grid gap-3", className)}>{children}</div>;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-end gap-1 sm:hidden">
        <span className="mr-auto text-[11px] text-muted-foreground">Geser untuk melihat semua</span>
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="grid size-7 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground active:translate-y-px"
          aria-label="Geser kiri"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          className="grid size-7 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground active:translate-y-px"
          aria-label="Geser kanan"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div
        ref={ref}
        className={cn(
          "flex gap-3 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Soft fade at both edges while swiping (mobile only; a grid on ≥sm).
          "[-webkit-mask-image:linear-gradient(to_right,transparent,#000_14px,#000_calc(100%-14px),transparent)] [mask-image:linear-gradient(to_right,transparent,#000_14px,#000_calc(100%-14px),transparent)] sm:[-webkit-mask-image:none] sm:[mask-image:none]",
          "[&>*]:min-w-[14rem] [&>*]:shrink-0 sm:[&>*]:min-w-0",
          cols === 2 ? "sm:grid sm:grid-cols-2" : cols === 4 ? "sm:grid sm:grid-cols-2 lg:grid-cols-4" : "sm:grid sm:grid-cols-3",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Compact metric tile for dashboard tracking rows. */
export function MiniStat({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: string; hint?: string }) {
  const bar =
    tone === "no" ? "text-red-500" : tone === "wait" ? "text-amber-500" : tone === "ok" ? "text-brand-500" : tone === "fast" ? "text-violet-500" : "text-foreground";
  return (
    <div className="card-gradient rounded-2xl p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", bar)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A meter/progress bar with an optional hover tooltip and hover-brighten. */
export function MeterBar({
  pct,
  colorClass,
  tooltip,
  className,
}: {
  pct: number;
  colorClass: string;
  tooltip?: React.ReactNode;
  className?: string;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      className={cn("group relative", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width,filter] duration-300 group-hover:brightness-110", colorClass)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      {tooltip && hover && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium text-foreground shadow-md">
          {tooltip}
          <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-popover" />
        </div>
      )}
    </div>
  );
}

/** Collapsible row — a professional "dropdown" for a parameter's detail. */
export function ExpandRow({
  title,
  right,
  defaultOpen = false,
  flagged = false,
  children,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={cn("overflow-hidden rounded-xl border", flagged ? "border-amber-500/40" : "border-border")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{title}</span>
        {right}
      </button>
      {/* Smooth height animation via grid 0fr→1fr (no JS measurement). */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="border-t border-border p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

type BannerTone = "info" | "amber" | "violet" | "success" | "danger";

const BANNER_TONE: Record<BannerTone, string> = {
  info: "border-sky-500/30 bg-sky-500/10 text-foreground",
  amber: "border-amber-500/30 bg-amber-500/10 text-foreground",
  violet: "border-violet-500/30 bg-violet-500/10 text-foreground",
  success: "border-brand-500/30 bg-brand-500/10 text-foreground",
  danger: "border-red-500/30 bg-red-500/10 text-foreground",
};

/** Colored callout box (info / warning / …), mirrors the mockup's banners. */
export function Banner({ tone = "info", icon, children }: { tone?: BannerTone; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3.5 text-sm leading-relaxed", BANNER_TONE[tone])}>
      {icon && <span className="mt-0.5 shrink-0 text-base leading-none">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Rounded card container matching the app's surface style. */
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card-gradient rounded-2xl p-4 sm:p-5", className)}>{children}</div>;
}

/** SVG donut showing a 0–100 score. */
export function ScoreRing({ value, size = 128, label, sub }: { value: number; size?: number; label?: string; sub?: string }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const color = pct >= 85 ? "var(--color-brand-500)" : pct >= 70 ? "var(--color-amber-accent)" : "#ef4444";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{label ?? pct.toFixed(1)}</span>
        {sub && <span className="mt-0.5 text-[11px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

const TIER_PILL: Record<string, string> = {
  no: "bg-red-500/15 text-red-600 ring-red-500/30 dark:text-red-400",
  wait: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400",
  ok: "bg-brand-500/15 text-brand-700 ring-brand-500/30 dark:text-brand-400",
  fast: "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-400",
};

export function TierPill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", TIER_PILL[tone] ?? TIER_PILL.wait)}>
      {children}
    </span>
  );
}

/**
 * A radio-style group of scored options. Selecting an option lifts it with an
 * accent ring + check — the app's elevated-pill selection idiom.
 */
export function ScoreOptions({
  options,
  value,
  onPick,
  accent = "sky",
}: {
  options: ScoreOption[];
  value: number | undefined;
  onPick: (v: number) => void;
  accent?: "sky" | "emerald" | "violet" | "amber";
}) {
  const ring = {
    sky: "border-sky-500/60 bg-sky-500/10 ring-sky-500/30",
    emerald: "border-brand-500/60 bg-brand-500/10 ring-brand-500/30",
    violet: "border-violet-500/60 bg-violet-500/10 ring-violet-500/30",
    amber: "border-amber-500/60 bg-amber-500/10 ring-amber-500/30",
  }[accent];
  const dot = {
    sky: "bg-sky-500",
    emerald: "bg-brand-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
  }[accent];

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
              active ? cn("ring-1", ring) : "border-border bg-muted/20 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-white transition-colors",
                active ? cn(dot, "border-transparent") : "border-border bg-background",
              )}
            >
              {active && <Check className="size-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{opt.head}</span>
              {opt.body && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{opt.body}</span>}
              {opt.src && <span className="mt-1 block text-[11px] text-muted-foreground/70">{opt.src}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
