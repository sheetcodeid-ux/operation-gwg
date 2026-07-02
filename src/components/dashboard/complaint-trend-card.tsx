"use client";

import * as React from "react";
import type { ComplaintCompareData } from "@/lib/data/store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Combobox } from "@/components/ui/combobox";
import { ComboCompareChart } from "@/components/charts/charts";

export function ComplaintTrendCard({ data, className }: { data: ComplaintCompareData; className?: string }) {
  const [mode, setMode] = React.useState<"monthly" | "yearly">("monthly");
  const [month, setMonth] = React.useState(data.defaultMonth);

  const monthly = data.months.find((m) => m.month === month) ?? data.months[0];
  const chartData = mode === "monthly" ? monthly.days : data.yearly;
  const weekendLabels =
    mode === "monthly" ? new Set(monthly.days.filter((d) => d.weekend).map((d) => d.label)) : undefined;

  const desc =
    mode === "monthly"
      ? `Daily complaints · ${monthly.label} ${data.year} vs previous month`
      : `Monthly complaints · ${data.year} · each month vs the one before`;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="truncate">Complaint Trend</CardTitle>
          <CardDescription className="truncate">{desc}</CardDescription>
        </div>
        {/* One row: month picker shrinks, tabs keep their size — never stacked. */}
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
            className="shrink-0"
            items={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as "monthly" | "yearly")}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ComboCompareChart data={chartData} weekendLabels={weekendLabels} height={260} />
        <div className="mt-3 flex items-center justify-center gap-5 text-xs text-muted-foreground">
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
