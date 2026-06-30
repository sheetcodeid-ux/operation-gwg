"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Shared Work Tracker filters (month / division / PIC) backed by the URL query
 * string, so the selection is preserved when switching between the Table and
 * Kanban views (the WorkViews links carry the same query). Each value defaults
 * to "all" (param omitted). Changing the division resets PIC, since the member
 * list differs per division.
 */
export function useWorkFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const month = params.get("month") ?? "all";
  const division = params.get("division") ?? "all";
  const pic = params.get("pic") ?? "all";

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
  const setDivision = React.useCallback((v: string) => apply({ division: v, pic: "all" }), [apply]);
  const setPic = React.useCallback((v: string) => apply({ pic: v }), [apply]);

  return { month, division, pic, setMonth, setDivision, setPic };
}
