import * as React from "react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/constants";

/** Metric tile — matches the dashboard KPI card (gray icon square + grip dots + gradient). */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Accepted for compatibility; icon is neutral gray to match the dashboard. */
  tone?: Tone;
  sub?: string;
}) {
  return (
    <div className="card-gradient flex h-full flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
        </div>
        <GripDots />
      </div>
      <div className="mt-auto pt-5">
        <p className="truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/** 2×3 dot drag-handle (Aniq-ui style). */
function GripDots() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-0.5 text-muted-foreground/30">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="size-1 rounded-full bg-current" />
      ))}
    </div>
  );
}
