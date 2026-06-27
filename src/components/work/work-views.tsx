"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/work-tracker", label: "Table", icon: List },
  { href: "/work-tracker/kanban", label: "Kanban", icon: LayoutGrid },
  { href: "/work-tracker/calendar", label: "Calendar", icon: Calendar },
];

/** Segmented links to switch between the three Work Tracker views (shared task data). */
export function WorkViews() {
  const pathname = usePathname();
  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1">
      {VIEWS.map((v) => {
        const active = pathname === v.href;
        const Icon = v.icon;
        return (
          <Link
            key={v.href}
            href={v.href}
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
