"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConcentricRings } from "@/components/dashboard/concentric-rings";
import { cn } from "@/lib/utils";

export interface InsightRing {
  label: string;
  value: number; // 0..100 (ring arc)
  color: string;
  sub?: string;
}

/** Dashboard Insights–style card: concentric rings + center headline + legend list. */
export function InsightsRingsCard({
  title,
  description,
  centerValue,
  centerLabel,
  rings,
  className,
}: {
  title: string;
  description: string;
  centerValue: number;
  centerLabel: string;
  rings: InsightRing[];
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-5">
        {rings.length > 0 ? (
          <>
            <ConcentricRings
              rings={rings.map((r) => ({ label: r.label, value: r.value, color: r.color }))}
              centerValue={centerValue}
              centerLabel={centerLabel}
              size={172}
            />
            <ul className="w-full space-y-3">
              {rings.map((r) => (
                <li key={r.label} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ background: `${r.color}22` }}>
                    <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.label}</p>
                    {r.sub && <p className="truncate text-[11px] text-muted-foreground">{r.sub}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: r.color }}>
                    {Math.round(r.value)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No data in scope</p>
        )}
      </CardContent>
    </Card>
  );
}
