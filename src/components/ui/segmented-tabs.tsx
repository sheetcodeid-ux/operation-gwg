"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SegItem {
  value: string;
  label: string;
  icon?: LucideIcon;
}

/**
 * Aniq-ui segmented tab control. Active segment is a clearly visible elevated
 * pill (bg-background + ring + shadow) inside a muted container. Reuse this for
 * every tab/segmented control in the app.
 */
export function SegmentedTabs({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: SegItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn("grid gap-1 rounded-xl border border-border bg-muted/50 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => {
        const active = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active
                ? "bg-background text-foreground shadow-md ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
