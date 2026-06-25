import { CalendarRange, Wallet } from "lucide-react";
import { EVENT_MILESTONES, EVENT_STATUS_META } from "@/lib/constants";
import type { OpsEvent } from "@/lib/types";
import { areaName, outletName } from "@/lib/data/store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TONE_HEX } from "@/components/ui/tone";
import { formatDate, formatIDR } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MilestoneStepper({ current }: { current: OpsEvent["milestone"] }) {
  const idx = EVENT_MILESTONES.findIndex((m) => m.value === current);
  return (
    <div className="flex items-center">
      {EVENT_MILESTONES.map((m, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={m.value} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[10px] font-semibold ring-1 transition-colors",
                  done && "bg-primary text-primary-foreground ring-border",
                  active && "bg-blue-500/20 text-blue-600 ring-blue-400/50 dark:text-blue-300",
                  !done && !active && "bg-muted/50 text-muted-foreground ring-border",
                )}
              >
                {i + 1}
              </div>
              <span className={cn("text-[10px]", active ? "text-blue-600 dark:text-blue-300" : done ? "text-foreground/80" : "text-muted-foreground")}>
                {m.label}
              </span>
            </div>
            {i < EVENT_MILESTONES.length - 1 && (
              <div className={cn("mx-1 h-0.5 flex-1 rounded-full", i < idx ? "bg-primary/50" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EventCard({ event }: { event: OpsEvent }) {
  const status = EVENT_STATUS_META[event.status];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{event.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {outletName(event.outletId)} · {areaName(event.areaId)}
          </p>
        </div>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarRange className="size-3" /> {formatDate(event.startDate)} → {formatDate(event.endDate)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Wallet className="size-3" /> {formatIDR(event.budget)}
        </span>
      </div>

      <div className="my-3">
        <MilestoneStepper current={event.milestone} />
      </div>

      <div className="flex items-center gap-2">
        <Progress value={event.progress} tone="brand" />
        <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">{event.progress}%</span>
      </div>
    </div>
  );
}

/** Gantt-style horizontal timeline across all events. */
export function EventTimeline({ events }: { events: OpsEvent[] }) {
  if (events.length === 0) return null;
  const starts = events.map((e) => +new Date(e.startDate));
  const ends = events.map((e) => +new Date(e.endDate));
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const span = Math.max(1, max - min);

  const pct = (t: number) => ((t - min) / span) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(new Date(min))}</span>
        <span>{formatDate(new Date(max))}</span>
      </div>
      <div className="space-y-1.5">
        {events.slice(0, 12).map((e) => {
          const left = pct(+new Date(e.startDate));
          const width = Math.max(4, pct(+new Date(e.endDate)) - left);
          const color = TONE_HEX[EVENT_STATUS_META[e.status].tone];
          return (
            <div key={e.id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[11px] text-muted-foreground" title={e.name}>
                {e.name}
              </span>
              <div className="relative h-5 flex-1 rounded-md bg-muted/40">
                <div
                  className="absolute top-0.5 flex h-4 items-center justify-center rounded-md text-[9px] font-medium text-white/90"
                  style={{ left: `${left}%`, width: `${width}%`, background: `${color}cc` }}
                  title={`${formatDate(e.startDate)} → ${formatDate(e.endDate)}`}
                >
                  {width > 12 ? `${e.progress}%` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
