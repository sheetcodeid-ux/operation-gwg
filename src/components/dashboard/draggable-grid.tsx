"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dependency-free drag-to-reorder grid. Each child is wrapped in a card slot with
 * a drag handle; order persists to localStorage under `storageKey`. Uses native
 * HTML5 drag events (desktop); on touch the cards simply stay in saved order.
 */
export type GridItem = { id: string; className?: string; node: React.ReactNode };

export function DraggableGrid({ items, storageKey, className }: { items: GridItem[]; storageKey: string; className?: string }) {
  const ids = React.useMemo(() => items.map((i) => i.id), [items]);
  const [order, setOrder] = React.useState<string[]>(ids);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  // Load saved order once, reconciling with the current item set (new ids appended, stale removed).
  React.useEffect(() => {
    let saved: string[] | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {}
    if (saved) {
      const known = new Set(ids);
      const merged = saved.filter((id) => known.has(id)).concat(ids.filter((id) => !saved!.includes(id)));
      setOrder(merged);
    } else {
      setOrder(ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, ids.join("|")]);

  const persist = React.useCallback(
    (next: string[]) => {
      setOrder(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    },
    [storageKey],
  );

  function onDrop(target: string) {
    if (!dragId || dragId === target) return setDragId(null);
    const next = [...order];
    const from = next.indexOf(dragId);
    const to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    persist(next);
    setDragId(null);
    setOverId(null);
  }

  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as GridItem[];

  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-12", className)}>
      {ordered.map((it) => (
        <div
          key={it.id}
          draggable
          onDragStart={() => setDragId(it.id)}
          onDragEnter={() => setOverId(it.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(it.id)}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          className={cn(
            "group/card relative min-w-0 transition-[opacity,transform]",
            it.className ?? "lg:col-span-4",
            dragId === it.id && "opacity-40",
            overId === it.id && dragId && dragId !== it.id && "ring-2 ring-primary/40 rounded-2xl",
          )}
        >
          {/* Drag handle — appears on hover, top-right */}
          <button
            type="button"
            aria-label="Geser kartu"
            className="absolute right-2 top-2 z-10 hidden size-6 cursor-grab place-items-center rounded-md bg-muted/70 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover/card:opacity-100 active:cursor-grabbing lg:grid"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </button>
          {it.node}
        </div>
      ))}
    </div>
  );
}
