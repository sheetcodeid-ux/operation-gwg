"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreOption } from "@/lib/assessment/config";

/** Gray uppercase mini-heading — the ".sl" section label used across the app. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70", className)}>
      {children}
    </p>
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
