"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusOption {
  value: string;
  label: string;
  count: number;
}

/**
 * Baris chip penyaring status — bentuknya sama dengan penyaring pada Antrian
 * Dokumen. Nilai "" berarti semua.
 */
export function StatusFilter({
  value,
  onChange,
  options,
  allLabel = "Semua",
  allCount,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: StatusOption[];
  allLabel?: string;
  allCount: number;
  className?: string;
}) {
  const items: StatusOption[] = [{ value: "", label: allLabel, count: allCount }, ...options];
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value || "all"}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {o.label}
            <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground/80")}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}
