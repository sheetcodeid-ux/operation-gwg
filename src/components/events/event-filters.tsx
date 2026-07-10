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
    <div className={className ?? "scroll-fade-x -mx-1 flex items-center gap-2 px-1 py-0.5"}>
      <MonthFilter options={months} value={month} onChange={setMonth} className="w-36 shrink-0" />
      <Combobox
        portal
        value={outlet}
        onChange={setOutlet}
        className="w-48 shrink-0"
        options={[{ value: "all", label: "Semua Outlet" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
        searchPlaceholder="Cari outlet…"
      />
      <Combobox
        portal
        searchable={false}
        value={status}
        onChange={setStatus}
        className="w-36 shrink-0"
        options={[
          { value: "all", label: "Semua Status" },
          ...(Object.keys(EVENT_STATUS_META) as EventStatus[]).map((s) => ({ value: s, label: EVENT_STATUS_META[s].label })),
        ]}
      />
    </div>
  );
}
