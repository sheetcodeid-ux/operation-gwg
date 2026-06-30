"use client";

import { usePathname } from "next/navigation";
import * as React from "react";

/** Forces every route change to open at the top.
 *
 *  Two problems are handled: (1) the browser/Next restore the previous scroll
 *  position when you navigate back to an already-visited route — we disable
 *  that with `scrollRestoration = "manual"`; (2) that restoration can run a
 *  beat *after* our reset, so we re-assert top now, next frame, and after a
 *  short delay to reliably win the race. */
export function ScrollReset() {
  const pathname = usePathname();

  React.useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  React.useEffect(() => {
    const reset = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    reset();
    const raf = requestAnimationFrame(reset);
    const t = setTimeout(reset, 90);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [pathname]);

  return null;
}
