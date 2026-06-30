"use client";

import * as React from "react";
import { EVENT_STATUS_META } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { TONE_HEX } from "@/components/ui/tone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { monthOptions } from "@/components/work/division-filter";
import { EventDetailDialog } from "./event-detail";
import { EventFilters, filterEvents } from "./event-filters";
import { useEventFilters } from "./use-event-filters";
import type { EventOutlet } from "./event-data";
import type { EventRow } from "./event-table";

export function EventTimelineView({
  rows,
  outlets,
  coordinators,
  canEdit,
}: {
  rows: EventRow[];
  outlets: EventOutlet[];
  coordinators: { id: string; name: string }[];
  canEdit?: boolean;
}) {
  const filters = useEventFilters();
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.startDate)), [rows]);
  const visible = filterEvents(rows, filters);

  const starts = visible.map((e) => +new Date(e.startDate));
  const ends = visible.map((e) => +new Date(e.endDate));
  const min = visible.length ? Math.min(...starts) : 0;
  const max = visible.length ? Math.max(...ends) : 1;
  const span = Math.max(1, max - min);
  const pct = (t: number) => ((t - min) / span) * 100;

  return (
    <div className="space-y-4">
      <EventFilters months={months} outlets={outlets} />

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Schedule overview · click a bar to open the event</CardDescription>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No events in scope</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatDate(new Date(min))}</span>
                <span>{formatDate(new Date(max))}</span>
              </div>
              <div className="no-scrollbar max-h-[30rem] space-y-1.5 overflow-y-auto">
                {visible.map((e) => {
                  const left = pct(+new Date(e.startDate));
                  const width = Math.max(4, pct(+new Date(e.endDate)) - left);
                  const color = TONE_HEX[EVENT_STATUS_META[e.status].tone];
                  return (
                    <div key={e.id} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground" title={e.name}>
                        {e.name}
                      </span>
                      <EventDetailDialog
                        event={e}
                        outlets={outlets}
                        coordinators={coordinators}
                        canEdit={canEdit}
                        trigger={
                          <button type="button" className="relative h-6 flex-1 rounded-md bg-muted/40 text-left">
                            <span
                              className="absolute top-0.5 flex h-5 items-center justify-center rounded-md text-[9px] font-medium text-white/90 transition-all hover:brightness-110"
                              style={{ left: `${left}%`, width: `${width}%`, background: `${color}cc` }}
                              title={`${formatDate(e.startDate)} → ${formatDate(e.endDate)}`}
                            >
                              {width > 12 ? `${e.progress}%` : ""}
                            </span>
                          </button>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
