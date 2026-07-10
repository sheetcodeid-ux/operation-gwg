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
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const close = React.useCallback(() => setOpen(false), []);

  const place = React.useCallback(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // The app scales <body> with CSS zoom on small screens; getBoundingClientRect
    // returns visual (post-zoom) px, but a fixed child of the zoomed body is
    // scaled again — so divide by the zoom to cancel it.
    const z = bodyZoom();
    setPos({ top: r.bottom / z + 8, left: r.left / z, width: r.width / z });
  }, []);

  // Keep the menu inside the viewport horizontally (no off-screen overflow).
  React.useEffect(() => {
    if (!open || !portal || !pos || !menuRef.current) return;
    const z = bodyZoom();
    const vw = window.innerWidth / z;
    const mw = menuRef.current.offsetWidth;
    const margin = 8;
    let left = align === "end" ? pos.left + pos.width - mw : pos.left;
    left = Math.min(left, vw - mw - margin);
    left = Math.max(margin, left);
    if (Math.abs(left - pos.left) > 0.5) setPos((p) => (p ? { ...p, left } : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portal, pos?.top, pos?.width]);

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
        "surface-solid z-50 origin-top rounded-xl p-1.5",
        "animate-in fade-in-0 zoom-in-95 duration-150 ease-out",
        portal ? "fixed" : cn("absolute mt-2 min-w-56", align === "end" ? "right-0" : "left-0"),
        contentClassName,
      )}
      style={portal && pos ? { top: pos.top, left: pos.left, ...(matchTriggerWidth ? { width: pos.width } : { minWidth: pos.width }) } : undefined}
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
