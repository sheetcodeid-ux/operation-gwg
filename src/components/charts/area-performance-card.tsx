"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBarChart } from "@/components/charts/charts";
import { cn } from "@/lib/utils";

/** Dashboard Performance-Metrics–style card: a by-area bar chart + summary stats. */
export function AreaPerformanceCard({
  title,
  description,
  data,
  color = "#3b82f6",
  max,
  target,
  lowerIsBetter,
  className,
}: {
  title: string;
  description: string;
  data: { label: string; value: number }[];
  color?: string;
  max?: number;
  target?: number;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const values = data.map((d) => d.value);
  const avg = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
  const best = data.length
    ? data.reduce((a, b) => (lowerIsBetter ? (b.value < a.value ? b : a) : b.value > a.value ? b : a))
    : null;
  const onTarget = target != null ? values.filter((v) => (lowerIsBetter ? v <= target : v >= target)).length : null;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {data.length > 0 ? (
          <>
            <CategoryBarChart data={data} color={color} max={max} height={220} angle={0} maxBarSize={36} />
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <Stat label="Average" value={String(avg)} />
              <Stat
                label={target != null ? "On target" : "Total"}
                value={target != null ? `${onTarget}/${values.length}` : String(values.reduce((a, b) => a + b, 0))}
              />
              <Stat label={lowerIsBetter ? "Fewest" : "Top area"} value={best ? best.label : "—"} />
            </div>
          </>
        ) : (
          <p className="flex-1 py-10 text-center text-sm text-muted-foreground">No data in scope</p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="truncate text-base font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
