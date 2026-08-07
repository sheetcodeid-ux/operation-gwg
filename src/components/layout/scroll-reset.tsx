"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { scrollToTop } from "@/lib/scroll";

/** Forces every route change to open at the top.
 *
 *  Next/browser scroll restoration can re-apply a previously-visited route's
 *  scroll position asynchronously — sometimes well after navigation (once the
 *  page's data finishes streaming). A one-shot reset loses that race, so we:
 *  1. set `history.scrollRestoration = "manual"`, and
 *  2. PIN the scroll to the top on every animation frame for ~400ms after each
 *     pathname change, releasing early the moment the user starts scrolling
 *     themselves (wheel / touch / keyboard).
 */
export function ScrollReset() {
  const pathname = usePathname();

  React.useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const stop = () => {
      cancelled = true;
    };
    const reset = () => {
      // Yang menggulir adalah wadah isi halaman, bukan dokumen — lihat lib/scroll.
      scrollToTop();
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    reset();
    const started = performance.now();
    let raf = requestAnimationFrame(function tick() {
      if (cancelled) return;
      reset();
      if (performance.now() - started < 600) raf = requestAnimationFrame(tick);
    });

    // Let the user take over immediately (wheel, touch, keys, scrollbar drag).
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    window.addEventListener("pointerdown", stop, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
    };
  }, [pathname]);

  return null;
}
