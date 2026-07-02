"use client";

import * as React from "react";
import type { CompareData } from "@/lib/compare-data";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Combobox } from "@/components/ui/combobox";
import { ComboCompareChart } from "@/components/charts/charts";

/** Dashboard "Complaint Trend"–style combo chart (gray bars = previous period,
 *  glowing blue line = current). Monthly view = daily points; Yearly = monthly.
 *  Reused verbatim across pages — only the title/noun differ. */
export function TrendCompareCard({
  title,
  noun,
  data,
  className,
}: {
  title: string;
  /** plural lowercase noun, e.g. "assessments", "audits", "complaints", "events". */
  noun: string;
  data: CompareData;
  className?: string;
}) {
  const [mode, setMode] = React.useState<"monthly" | "yearly">("monthly");
  const [month, setMonth] = React.useState(data.defaultMonth);

  const monthly = data.months.find((m) => m.month === month) ?? data.months[0];
  const chartData = mode === "monthly" ? monthly.days : data.yearly;
  const weekendLabels = mode === "monthly" ? new Set(monthly.days.filter((d) => d.weekend).map((d) => d.label)) : undefined;

  const desc =
    mode === "monthly"
      ? `Daily ${noun} · ${monthly.label} ${data.year} vs previous month`
      : `Monthly ${noun} · ${data.year} · each month vs the one before`;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {mode === "monthly" && (
            <Combobox
              className="min-w-0 shrink basis-40"
              options={data.months.map((m) => ({ value: String(m.month), label: m.label }))}
              value={String(month)}
              onChange={(v) => setMonth(Number(v))}
              searchPlaceholder="Month…"
            />
          )}
          <SegmentedTabs
            items={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as "monthly" | "yearly")}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center">
        <ComboCompareChart data={chartData} weekendLabels={weekendLabels} height={260} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)]" />
            This period
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-b from-slate-300 to-slate-500" />
            Previous period
          </span>
          {mode === "monthly" && (
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-red-500">1</span>
              Weekend
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
