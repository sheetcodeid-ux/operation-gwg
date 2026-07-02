"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleCheckBig,
  ConciergeBell,
  Gauge,
  SprayCan,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { ConcentricRings, type Ring } from "./concentric-rings";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { cn } from "@/lib/utils";

const LEGEND_ICONS: Record<string, LucideIcon> = {
  check: CircleCheckBig,
  bell: ConciergeBell,
  spray: SprayCan,
};

export interface InsightRing extends Ring {
  icon: string;
  sub: string;
}

export interface TrendItem {
  label: string;
  value: number;
  delta: number;
  color: string;
  sub: string;
}

export function InsightsPanel({
  rings,
  centerValue,
  trends,
  periodLabel,
}: {
  rings: InsightRing[];
  centerValue: number;
  trends: TrendItem[];
  periodLabel: string;
}) {
  const [tab, setTab] = React.useState<"performance" | "trends">("performance");

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Tabs */}
      <SegmentedTabs
        className="shrink-0"
        value={tab}
        onChange={(v) => setTab(v as "performance" | "trends")}
        items={[
          { value: "performance", label: "Performance", icon: Gauge },
          { value: "trends", label: "Trends", icon: TrendingUp },
        ]}
      />

      {tab === "performance" ? (
        // Wraps: when the card is too narrow for ring + legend side-by-side,
        // the legend drops below the ring instead of overflowing the card.
        <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-5">
          <ConcentricRings rings={rings} centerValue={centerValue} />
          <ul className="min-w-52 max-w-full flex-1 space-y-3.5">
            {rings.map((r) => {
              const Icon = LEGEND_ICONS[r.icon] ?? CircleCheckBig;
              return (
                <li key={r.label} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${r.color}22` }}>
                    <Icon className="size-4" style={{ color: r.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{r.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{r.sub}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: r.color }}>
                    {r.value.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <p className="text-[11px] text-muted-foreground">Change {periodLabel.toLowerCase()} vs previous period</p>
          {trends.map((t) => {
            const up = t.delta >= 0;
            const flat = t.delta === 0;
            return (
              <div key={t.label} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{t.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.sub}</p>
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  {t.value.toFixed(0)}%
                </span>
                <span className="flex w-16 shrink-0 justify-end">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                      flat
                        ? "bg-muted text-muted-foreground"
                        : up
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                          : "bg-red-500/15 text-red-600 dark:text-red-300",
                    )}
                  >
                    {flat ? <ArrowRight className="size-3" /> : up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {Math.abs(t.delta)}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
