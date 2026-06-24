"use client";

import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ConciergeBell,
  ListChecks,
  MapPinned,
  MessageSquareWarning,
  SprayCan,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/constants";
import { TONE_HEX } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

/** Icon registry — server passes a name string (icons aren't serializable across the RSC boundary). */
const KPI_ICONS: Record<string, LucideIcon> = {
  Store,
  MapPinned,
  ConciergeBell,
  SprayCan,
  MessageSquareWarning,
  CheckCircle2,
  ListChecks,
  CalendarRange,
};

export interface Kpi {
  label: string;
  value: string;
  icon: keyof typeof KPI_ICONS;
  tone: Tone;
  delta?: { value: number; positiveIsGood?: boolean };
  sub?: string;
}

export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((kpi, i) => (
        <KpiCard key={kpi.label} kpi={kpi} index={i} />
      ))}
    </div>
  );
}

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const Icon = KPI_ICONS[kpi.icon] ?? Store;
  const color = TONE_HEX[kpi.tone];
  const delta = kpi.delta;
  const good = delta ? (delta.positiveIsGood ?? true) === delta.value >= 0 : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="glass group relative overflow-hidden rounded-2xl p-4"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />
      <div className="flex items-center justify-between">
        <div
          className="grid size-9 place-items-center rounded-xl ring-1 ring-border"
          style={{ background: `${color}22` }}
        >
          <Icon className="size-[18px]" style={{ color }} />
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
              good ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
            )}
          >
            {delta.value >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta.value)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
      <p className="text-xs text-muted-foreground">{kpi.label}</p>
      {kpi.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.sub}</p>}
    </motion.div>
  );
}
