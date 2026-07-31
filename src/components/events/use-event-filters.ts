"use client";

import * as React from "react";

/**
 * Shared Event Tracker filters (month / outlet / status). Held in LOCAL state so
 * changing a filter is INSTANT (no navigation / server round-trip) — the views
 * filter already-loaded rows on the client. The selection is mirrored into the
 * URL via history.replaceState (no navigation) so it survives a reload and is
 * carried across Table ↔ Kanban ↔ Timeline by the view switcher.
 */
type EventFilterState = { month: string; outlet: string; status: string };

function readParams(): EventFilterState {
  if (typeof window === "undefined") return { month: "all", outlet: "all", status: "all" };
  const p = new URLSearchParams(window.location.search);
  return { month: p.get("month") ?? "all", outlet: p.get("outlet") ?? "all", status: p.get("status") ?? "all" };
}

export function useEventFilters() {
  const [state, setState] = React.useState<EventFilterState>({ month: "all", outlet: "all", status: "all" });

  // Restore from the URL after mount (client-only) — keeps SSR/hydration in sync
  // (both render "all" first) while still honouring a shared/bookmarked filter.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setState(readParams()), []);

  const apply = React.useCallback((updates: Partial<EventFilterState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(next)) {
          if (!v || v === "all") p.delete(k);
          else p.set(k, v);
        }
        const qs = p.toString();
        // Update the address bar WITHOUT a Next.js navigation → no round-trip.
        window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
      }
      return next;
    });
  }, []);

  const setMonth = React.useCallback((v: string) => apply({ month: v }), [apply]);
  const setOutlet = React.useCallback((v: string) => apply({ outlet: v }), [apply]);
  const setStatus = React.useCallback((v: string) => apply({ status: v }), [apply]);

  return { month: state.month, outlet: state.outlet, status: state.status, setMonth, setOutlet, setStatus };
}
