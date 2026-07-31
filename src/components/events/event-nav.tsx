"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarRange, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/events", label: "Table", icon: List },
  { href: "/events/kanban", label: "Kanban", icon: LayoutGrid },
  { href: "/events/timeline", label: "Timeline", icon: CalendarRange },
];

/** Segmented links to switch Event Tracker views; carries the filter query. */
export function EventNav() {
  const pathname = usePathname();
  const qs = useSearchParams().toString();
  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {VIEWS.map((v) => {
        const active = pathname === v.href;
        const Icon = v.icon;
        return (
          <Link
            key={v.href}
            href={qs ? `${v.href}?${qs}` : v.href}
            // Full prefetch so switching Table/Kanban/Timeline is instant.
            prefetch
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-md ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
