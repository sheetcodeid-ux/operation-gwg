import * as React from "react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/constants";
import { TONE_HEX } from "./tone";

/** Compact stat tile for module summary strips. */
export function StatTile({
  icon: Icon,
  label,
  value,
  tone = "brand",
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  sub?: string;
}) {
  const color = TONE_HEX[tone];
  return (
    <div className="card-gradient flex items-center gap-3 rounded-xl p-3.5">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-border" style={{ background: `${color}22` }}>
        <Icon className="size-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground/80">{sub}</p>}
      </div>
    </div>
  );
}
