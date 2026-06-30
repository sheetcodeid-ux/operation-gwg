"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Shared Event Tracker filters (month / outlet / status) backed by the URL
 * query, so the selection is preserved when switching Table ↔ Kanban ↔ Timeline.
 * Each value defaults to "all" (param omitted).
 */
export function useEventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const month = params.get("month") ?? "all";
  const outlet = params.get("outlet") ?? "all";
  const status = params.get("status") ?? "all";

  const apply = React.useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const setMonth = React.useCallback((v: string) => apply({ month: v }), [apply]);
  const setOutlet = React.useCallback((v: string) => apply({ outlet: v }), [apply]);
  const setStatus = React.useCallback((v: string) => apply({ status: v }), [apply]);

  return { month, outlet, status, setMonth, setOutlet, setStatus };
}
