"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover } from "./popover";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/** Searchable single-select dropdown (type to filter, e.g. "baning" → GWG Baning). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder,
  className,
  disabled,
  portal = true,
  searchable,
  matchTriggerWidth = false,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** Render the menu in a portal so it escapes overflow-clipping ancestors and
   *  is clamped inside the viewport (never off-screen). Defaults to true. */
  portal?: boolean;
  /** Show the type-to-filter search box. Defaults on ONLY for real data pickers
   *  (those that pass a `searchPlaceholder`, e.g. outlet/user lists); short enum
   *  dropdowns get no search box (and no mobile keyboard). Pass explicitly to override. */
  searchable?: boolean;
  /** Size the menu to exactly the trigger width. */
  matchTriggerWidth?: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  // A custom search placeholder signals a long, searchable data list; without it
  // the dropdown is a short enum select that shouldn't show a search box.
  const canSearch = searchable ?? searchPlaceholder != null;

  return (
    <Popover
      portal={portal}
      className={cn("w-full", className)}
      matchTriggerWidth={matchTriggerWidth}
      // Default: menu sizes to content, at least the trigger width (Popover sets
      // minWidth) or 13rem, capped so it never exceeds the viewport. Avoid `100%`
      // here — under a portal it resolves to the viewport, not the trigger.
      // matchTriggerWidth: menu is exactly the trigger width (Popover sets width).
      contentClassName={
        matchTriggerWidth
          ? "p-0"
          : "w-max min-w-[13rem] max-w-[min(20rem,calc(100vw-1.5rem))] p-0"
      }
      align="start"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background/40 px-3 text-left text-sm transition-colors hover:bg-muted/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-50 dark:bg-input/30",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {(close) => <ComboList options={options} value={value} onPick={(v) => { onChange(v); close(); }} searchPlaceholder={searchPlaceholder ?? "Search…"} searchable={canSearch} />}
    </Popover>
  );
}

function ComboList({
  options,
  value,
  onPick,
  searchPlaceholder,
  searchable = true,
}: {
  options: ComboOption[];
  value: string;
  onPick: (v: string) => void;
  searchPlaceholder: string;
  searchable?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s));
  }, [options, q]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) onPick(filtered[active].value);
    }
  }

  return (
    <div>
      {searchable && (
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder={searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      )}
      <div className="max-h-60 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results.</p>
        ) : (
          filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(o.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                active === i ? "bg-accent text-accent-foreground" : "text-foreground/90 hover:bg-muted",
              )}
            >
              <Check className={cn("size-4 shrink-0", o.value === value ? "opacity-100 text-primary" : "opacity-0")} />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{o.hint}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
