"use client";

import { useEffect } from "react";

/**
 * Flags <html> with `dash-neon-active` while the neon dashboard is mounted.
 *
 * Dropdowns, date pickers and the command palette render through React portals
 * to <body> — outside the `.dash-neon` wrapper — so page-scoped CSS can't reach
 * them. This class lets the stylesheet style those portaled overlays too, and
 * only while the dashboard is on screen (removed on unmount).
 */
export function DashNeonScope() {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("dash-neon-active");
    return () => el.classList.remove("dash-neon-active");
  }, []);
  return null;
}
