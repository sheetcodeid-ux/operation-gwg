"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { bodyZoom } from "@/components/layout/fit-scale";
import { cn } from "@/lib/utils";

/** Minimal anchored popover with click-outside + escape handling.
 *  Pass `portal` to render the menu into <body> (fixed-positioned) so it is
 *  never clipped by an `overflow` ancestor — needed inside horizontal scrollers. */
export function Popover({
  trigger,
  children,
  align = "end",
  className,
  contentClassName,
  portal = false,
  matchTriggerWidth = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
  portal?: boolean;
  /** Size the menu to exactly the trigger width (not the content width). */
  matchTriggerWidth?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; maxW: number } | null>(null);
  const close = React.useCallback(() => setOpen(false), []);

  const place = React.useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // The app scales <body> with CSS zoom on small screens; getBoundingClientRect
    // returns visual (post-zoom) px, but a fixed child of the zoomed body is
    // scaled again — so divide by the zoom to cancel it (all math in layout px).
    const z = bodyZoom();
    const margin = 8;
    const vw = window.innerWidth / z;
    const triggerLeft = r.left / z;
    const triggerWidth = r.width / z;
    const maxW = vw - margin * 2;
    // Clamp is folded INTO placement (not a separate effect) so every reposition
    // — including the ones fired while the mobile keyboard opens — is already
    // on-screen. Menu width is measured once mounted, else estimated by trigger.
    const menuW = menuRef.current ? menuRef.current.getBoundingClientRect().width / z : triggerWidth;
    const mw = Math.min(menuW || triggerWidth, maxW);
    let left = align === "end" ? triggerLeft + triggerWidth - mw : triggerLeft;
    left = Math.min(left, vw - margin - mw);
    left = Math.max(margin, left);
    setPos({ top: r.bottom / z + 8, left, width: triggerWidth, maxW });
  }, [align]);

  // Re-place once the menu has mounted (so its real width is measured) and keep
  // it placed across layout shifts.
  React.useEffect(() => {
    if (!open || !portal) return;
    place();
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portal]);

  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !portal) return;
    place();
    const on = () => place();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [open, portal, place]);

  const content = open ? (
    <div
      ref={menuRef}
      className={cn(
        // Solid surface, crisp border, no blur/shadow and no open animation.
        "rounded-xl border border-border bg-popover text-popover-foreground p-1.5",
        // Portalled menus must clear overlays like the SlideOver (z-[90]); the
        // in-flow variant only needs to beat page content.
        portal ? "fixed z-[120]" : cn("absolute z-50 mt-2 min-w-56", align === "end" ? "right-0" : "left-0"),
        contentClassName,
      )}
      style={
        portal && pos
          ? {
              top: pos.top,
              left: pos.left,
              maxWidth: pos.maxW,
              // Only matchTriggerWidth pins a pos-derived width. Otherwise width
              // is CSS-driven (w-max / min-w) and STABLE across renders — a
              // pos-derived minWidth would change the menu width after the first
              // measurement and shift the placement on first open.
              ...(matchTriggerWidth ? { width: pos.width } : {}),
            }
          : undefined
      }
    >
      {typeof children === "function" ? children(close) : children}
    </div>
  ) : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {portal ? open && typeof document !== "undefined" && createPortal(content, document.body) : content}
    </div>
  );
}
