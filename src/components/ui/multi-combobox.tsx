"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Popover } from "./popover";
import { cn } from "@/lib/utils";

export interface MultiOption {
  value: string;
  label: string;
  group?: string;
  hint?: string;
}

/** Searchable multi-select. Group headers (when present) toggle all items in the group. */
export function MultiCombobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  allLabel = "All",
  className,
}: {
  options: MultiOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  className?: string;
}) {
  const selected = new Set(value);
  const count = value.length;

  return (
    <Popover
      className={cn("w-full", className)}
      contentClassName="w-max min-w-[max(100%,13rem)] max-w-[min(20rem,calc(100vw-2rem))] p-0"
      align="end"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-3 text-left text-sm transition-colors hover:bg-muted/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30",
            count === 0 && "text-muted-foreground",
          )}
        >
          <span className="truncate">{count === 0 ? placeholder : `${count} selected`}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {() => (
        <MultiList
          options={options}
          selected={selected}
          onChange={onChange}
          searchPlaceholder={searchPlaceholder}
          allLabel={allLabel}
        />
      )}
    </Popover>
  );
}

function MultiList({
  options,
  selected,
  onChange,
  searchPlaceholder,
  allLabel,
}: {
  options: MultiOption[];
  selected: Set<string>;
  onChange: (v: string[]) => void;
  searchPlaceholder: string;
  allLabel: string;
}) {
  const [q, setQ] = React.useState("");
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.group?.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s));
  }, [options, q]);

  const groups = React.useMemo(() => {
    const map = new Map<string, MultiOption[]>();
    for (const o of filtered) {
      const g = o.group ?? "";
      map.set(g, [...(map.get(g) ?? []), o]);
    }
    return [...map.entries()];
  }, [filtered]);

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange([...next]);
  }
  function toggleGroup(items: MultiOption[]) {
    const allOn = items.every((i) => selected.has(i.value));
    const next = new Set(selected);
    for (const i of items) {
      if (allOn) next.delete(i.value);
      else next.add(i.value);
    }
    onChange([...next]);
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {selected.size > 0 && (
          <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results.</p>
        ) : (
          groups.map(([group, items]) => {
            const allOn = items.every((i) => selected.has(i.value));
            const someOn = !allOn && items.some((i) => selected.has(i.value));
            return (
              <div key={group || "_"} className="mb-1">
                {group && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(items)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "grid size-4 place-items-center rounded border",
                        allOn ? "border-primary bg-primary text-primary-foreground" : someOn ? "border-primary bg-primary/30" : "border-border",
                      )}
                    >
                      {allOn && <Check className="size-3" />}
                    </span>
                    {group} <span className="ml-auto text-muted-foreground">({allLabel.toLowerCase()})</span>
                  </button>
                )}
                {items.map((o) => {
                  const on = selected.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md py-2 pr-2.5 text-left text-sm hover:bg-muted",
                        group ? "pl-7" : "pl-2.5",
                      )}
                    >
                      <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {on && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-foreground/90">{o.label}</span>
                      {o.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{o.hint}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Compact chips row showing current multi-select selection (optional). */
export function SelectionChips({ labels, onClear }: { labels: string[]; onClear?: () => void }) {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.slice(0, 6).map((l) => (
        <span key={l} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-foreground/80">
          {l}
        </span>
      ))}
      {labels.length > 6 && <span className="text-[11px] text-muted-foreground">+{labels.length - 6}</span>}
      {onClear && (
        <button onClick={onClear} className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground">
          <X className="size-3" /> clear
        </button>
      )}
    </div>
  );
}
