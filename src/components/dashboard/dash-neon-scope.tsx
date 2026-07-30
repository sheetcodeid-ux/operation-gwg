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

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dash = document.querySelector<HTMLElement>(".dash-neon");

    // Cursor spotlight (all cards) + subtle 3D tilt (big .glass cards only, so
    // the KPI tiles inside the scroll row are never clipped).
    let tilted: HTMLElement | null = null;
    const MAX_DEG = 5;
    const onSpot = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      const anyCard = t?.closest<HTMLElement>(".glass, .card-gradient");
      if (anyCard) {
        const r = anyCard.getBoundingClientRect();
        anyCard.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
        anyCard.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
      }
      const card = t?.closest<HTMLElement>(".glass");
      if (card !== tilted) {
        if (tilted) tilted.style.transform = "";
        tilted = card;
      }
      if (card) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1000px) rotateX(${(-py * MAX_DEG * 2).toFixed(2)}deg) rotateY(${(px * MAX_DEG * 2).toFixed(2)}deg) scale(1.012)`;
      }
    };
    const onLeave = () => {
      if (tilted) {
        tilted.style.transform = "";
        tilted = null;
      }
    };
    if (dash && !reduce) {
      dash.addEventListener("pointermove", onSpot);
      dash.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        dash.removeEventListener("pointermove", onSpot);
        dash.removeEventListener("pointerleave", onLeave);
      });
    }

    // Count-up — animate the big metric numbers from 0 on first paint.
    if (dash && !reduce) {
      const nums = dash.querySelectorAll<HTMLElement>(".text-2xl, .text-3xl, .text-4xl");
      nums.forEach((el) => {
        if (el.dataset.counted) return;
        const raw = (el.textContent || "").trim();
        const m = raw.match(/^(-?)(\d[\d.]*)(%?)$/); // plain number, optional % — skips clocks, °C, Rp
        if (!m) return;
        const target = parseFloat(m[2]);
        if (!isFinite(target)) return;
        el.dataset.counted = "1";
        const decimals = (m[2].split(".")[1] || "").length;
        const dur = 900;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = m[1] + (target * eased).toFixed(decimals) + m[3];
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = raw;
        };
        requestAnimationFrame(tick);
      });
    }

    return () => {
      root.classList.remove("dash-neon-active");
      window.clearTimeout(t);
      cleanups.forEach((c) => c());
    };
  }, []);

  return null;
}
