"use client";

import { EVENT_STATUS_META } from "@/lib/constants";
import type { EventStatus } from "@/lib/types";
import { Combobox } from "@/components/ui/combobox";
import { MonthFilter, monthKey } from "@/components/work/division-filter";
import { useEventFilters } from "./use-event-filters";
import type { EventRow } from "./event-table";

/** Filter by month (start date) + outlet + status — shared across event views. */
export function filterEvents(rows: EventRow[], f: { month: string; outlet: string; status: string }): EventRow[] {
  return rows.filter(
    (r) =>
      (f.month === "all" || monthKey(r.startDate) === f.month) &&
      (f.outlet === "all" || r.outletId === f.outlet) &&
      (f.status === "all" || r.status === f.status),
  );
}

export function EventFilters({
  months,
  outlets,
  className,
}: {
  months: { value: string; label: string }[];
  outlets: { id: string; name: string }[];
  className?: string;
}) {
  const { month, outlet, status, setMonth, setOutlet, setStatus } = useEventFilters();
  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      <MonthFilter options={months} value={month} onChange={setMonth} className="min-w-0 shrink basis-40" />
      <Combobox
        value={outlet}
        onChange={setOutlet}
        className="min-w-0 shrink basis-48"
        options={[{ value: "all", label: "All outlets" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
        searchPlaceholder="Outlet…"
      />
      <Combobox
        value={status}
        onChange={setStatus}
        className="min-w-0 shrink basis-36"
        options={[
          { value: "all", label: "All status" },
          ...(Object.keys(EVENT_STATUS_META) as EventStatus[]).map((s) => ({ value: s, label: EVENT_STATUS_META[s].label })),
        ]}
      />
    </div>
  );
}
