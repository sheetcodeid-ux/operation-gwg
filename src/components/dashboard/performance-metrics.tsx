"use client";

import * as React from "react";
import type { CoordinatorPerf } from "@/lib/data/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { CategoryBarChart } from "@/components/charts/charts";

type Metric = "hospitality" | "hygiene" | "complaints";

const METRICS: { value: Metric; label: string; color: string; score: boolean }[] = [
  { value: "hospitality", label: "Hospitality", color: "#3b82f6", score: true },
  { value: "hygiene", label: "Hygiene", color: "#22c55e", score: true },
  { value: "complaints", label: "Complaints", color: "#f59e0b", score: false },
];

const TARGET = 80;

function firstName(name: string) {
  return name.split(" ")[0];
}

export function PerformanceMetrics({ data }: { data: CoordinatorPerf[] }) {
  const [metric, setMetric] = React.useState<Metric>("hospitality");
  const meta = METRICS.find((m) => m.value === metric)!;
  const isScore = meta.score;

  const points = data.map((d) => ({ label: firstName(d.name), value: d[metric] }));
  const values = points.map((p) => p.value);
  const avg = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

  // Best CA: highest score, or fewest complaints.
  const best = data.length
    ? data.reduce((a, b) => (isScore ? (b[metric] > a[metric] ? b : a) : b[metric] < a[metric] ? b : a))
    : null;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>By coordinator area</CardDescription>
        </div>
        <Combobox
          className="w-36 shrink-0"
          options={METRICS.map((m) => ({ value: m.value, label: m.label }))}
          value={metric}
          onChange={(v) => setMetric(v as Metric)}
          searchPlaceholder="Metric…"
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {points.length > 0 ? (
          <>
            <CategoryBarChart
              data={points}
              color={meta.color}
              max={isScore ? 100 : undefined}
              radius={20}
              maxBarSize={28}
              angle={0}
              height={220}
            />
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <Stat label={isScore ? "Avg Score" : "Avg Complaints"} value={isScore ? avg.toFixed(1) : String(avg)} />
              <Stat
                label={isScore ? "Above Target" : "Total Complaints"}
                value={isScore ? `${values.filter((v) => v >= TARGET).length}/${values.length}` : String(values.reduce((a, b) => a + b, 0))}
              />
              <Stat label={isScore ? "Top Area" : "Cleanest Area"} value={best ? firstName(best.name) : "—"} />
            </div>
          </>
        ) : (
          <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-muted-foreground">
            No coordinator areas in scope
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
