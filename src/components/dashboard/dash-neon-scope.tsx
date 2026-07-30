"use client";

import { useEffect } from "react";

/**
 * Dashboard-only interaction layer:
 *  1. Flags <html> with `dash-neon-active` while the neon dashboard is mounted,
 *     so portaled overlays (dropdowns, pickers) can be styled by scoped CSS.
 *  2. Enables click-and-drag horizontal scrolling on the dashboard's
 *     horizontally-scrollable rows (KPI carousel, wide tables) so users can grab
 *     with a mouse and slide — no scrollbars or arrows needed. Trackpads keep
 *     their native two-finger scroll.
 */
export function DashNeonScope() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dash-neon-active");

    const cleanups: Array<() => void> = [];

    function wire(el: HTMLElement) {
      let down = false;
      let moved = false;
      let startX = 0;
      let startLeft = 0;

      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const t = e.target as HTMLElement;
        // Don't hijack drags that start on a real control.
        if (t.closest("button,a,input,textarea,select,[role='button'],[role='option'],[role='tab'],label")) return;
        down = true;
        moved = false;
        startX = e.clientX;
        startLeft = el.scrollLeft;
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
      };
      const onMove = (e: PointerEvent) => {
        if (!down) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) moved = true;
        el.scrollLeft = startLeft - dx;
      };
      const onUp = () => {
        if (!down) return;
        down = false;
        el.style.cursor = "grab";
        el.style.userSelect = "";
      };
      // Swallow the click that ends a real drag, so a drag never fires a button.
      const onClick = (e: MouseEvent) => {
        if (moved) {
          e.stopPropagation();
          e.preventDefault();
          moved = false;
        }
      };

      el.style.cursor = "grab";
      el.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      el.addEventListener("click", onClick, true);
      cleanups.push(() => {
        el.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        el.removeEventListener("click", onClick, true);
        el.style.cursor = "";
        el.style.userSelect = "";
      });
    }

    const scan = () => {
      const dash = document.querySelector<HTMLElement>(".dash-neon");
      if (!dash) return;
      dash.querySelectorAll<HTMLElement>("div").forEach((el) => {
        if ((el as HTMLElement).dataset.dragWired) return;
        const s = getComputedStyle(el);
        const scrollableX = /(auto|scroll)/.test(s.overflowX);
        if (scrollableX && el.scrollWidth > el.clientWidth + 8) {
          el.dataset.dragWired = "1";
          wire(el);
        }
      });
    };

    scan();
    const t = window.setTimeout(scan, 400); // rescan once layout settles

    return () => {
      root.classList.remove("dash-neon-active");
      window.clearTimeout(t);
      cleanups.forEach((c) => c());
    };
  }, []);

  return null;
}
