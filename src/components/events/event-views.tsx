import { CalendarRange, Wallet } from "lucide-react";
import { EVENT_STATUS_META } from "@/lib/constants";
import type { OpsEvent } from "@/lib/types";
import { areaName, outletName } from "@/lib/data/store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatIDR } from "@/lib/utils";
import { MilestoneStepper } from "./milestone-stepper";

export { MilestoneStepper };

/** Compact event card — used on the Outlet 360 page. */
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
