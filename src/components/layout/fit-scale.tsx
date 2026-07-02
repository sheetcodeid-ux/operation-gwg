"use client";

import * as React from "react";

/** The layout width the app is designed for. Below this, the whole app is
 *  scaled down (CSS zoom) so small windows/phones show the SAME desktop
 *  composition, just smaller — per the product decision that mobile should
 *  look identical to desktop (zoom-out), not restack. */
const DESIGN_WIDTH = 1200;

export function FitScale() {
  React.useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      const z = w >= DESIGN_WIDTH ? 1 : w / DESIGN_WIDTH;
      document.body.style.zoom = z === 1 ? "" : String(z);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      document.body.style.zoom = "";
    };
  }, []);
  return null;
}

/** Current body zoom factor (1 when unscaled). Fixed-position overlays that
 *  are placed with viewport coordinates must divide by this. */
export function bodyZoom(): number {
  if (typeof document === "undefined") return 1;
  const z = parseFloat(document.body.style.zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}
