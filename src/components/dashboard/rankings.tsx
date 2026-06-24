import { Trophy } from "lucide-react";
import type { AreaRankRow, OutletRankRow } from "@/lib/data/store";
import { areaName } from "@/lib/data/store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ui/score-ring";
import { scoreTone } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

function RankBadge({ rank }: { rank: number }) {
  const medal = ["text-amber-300 bg-amber-500/15", "text-foreground/80 bg-muted", "text-orange-300 bg-orange-500/15"][rank - 1];
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold tabular-nums",
        medal ?? "bg-muted/50 text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

export function OutletRanking({ rows }: { rows: OutletRankRow[] }) {
  const top = rows.slice(0, 8);
  return (
    <div className="space-y-1">
      {top.map((row, i) => (
        <div
          key={row.outlet.id}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40"
        >
          <RankBadge rank={i + 1} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{row.outlet.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {areaName(row.outlet.areaId)} · {row.outlet.code}
            </p>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <Metric label="Hosp" value={row.hospitality} />
            <Metric label="Hyg" value={row.hygiene} />
            {row.complaints > 0 && <Badge tone="danger">{row.complaints} open</Badge>}
          </div>
          <ScoreRing value={row.composite} size={40} stroke={4} />
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-sm font-semibold tabular-nums text-foreground">{value.toFixed(0)}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export function AreaRanking({ rows }: { rows: AreaRankRow[] }) {
  return (
    <div className="grid gap-2">
      {rows.map((row, i) => (
        <div
          key={row.area.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
        >
          <div className="flex items-center gap-2">
            {i === 0 && <Trophy className="size-4 text-amber-300" />}
            <ScoreRing value={row.composite} size={44} stroke={5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{row.area.name}</p>
            <p className="text-[11px] text-muted-foreground">{row.outlets} outlets</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Hospitality</span>
                  <span className="tabular-nums text-foreground/80">{row.hospitality.toFixed(0)}</span>
                </div>
                <Progress value={row.hospitality} tone={scoreTone(row.hospitality)} className="mt-0.5" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Hygiene</span>
                  <span className="tabular-nums text-foreground/80">{row.hygiene.toFixed(0)}</span>
                </div>
                <Progress value={row.hygiene} tone={scoreTone(row.hygiene)} className="mt-0.5" />
              </div>
            </div>
          </div>
          {row.complaintsOpen > 0 && <Badge tone="warning">{row.complaintsOpen}</Badge>}
        </div>
      ))}
    </div>
  );
}
