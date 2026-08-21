"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { bodyZoom } from "@/components/layout/fit-scale";
import { cn } from "@/lib/utils";

// Run before paint on the client (so the menu is positioned before it's shown),
// but fall back to useEffect on the server to avoid the SSR warning.
const useIsoLayoutEffect = typeof document !== "undefined" ? React.useLayoutEffect : React.useEffect;

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
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; maxW: number; maxH: number } | null>(null);
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
    // Menu dibalik ke ATAS bila ruang di bawah tidak cukup.
    //
    // Sebelumnya ia selalu turun, jadi setiap pemilih yang berada di dekat kaki
    // layar membuka daftar yang terpotong tepi bawah — isinya ada, tapi tidak
    // bisa dicapai. Yang paling sering kena justru panel yang memang duduk di
    // bawah, seperti panel penempatan di bagan organisasi.
    const vh = window.innerHeight / z;
    const atas = r.top / z;
    const bawah = r.bottom / z;
    const menuH = menuRef.current ? menuRef.current.getBoundingClientRect().height / z : 0;
    const ruangBawah = vh - bawah - margin * 2;
    const ruangAtas = atas - margin * 2;
    // Dibalik hanya kalau ruang di atas benar-benar LEBIH lega — kalau
    // dua-duanya sempit, tetap ke bawah supaya arah bukanya bisa ditebak.
    const keAtas = menuH > 0 && menuH > ruangBawah && ruangAtas > ruangBawah;
    const top = keAtas ? Math.max(margin, atas - menuH - 8) : bawah + 8;
    setPos({ top, left, width: triggerWidth, maxW, maxH: Math.max(120, (keAtas ? ruangAtas : ruangBawah)) });
  }, [align]);

  // Place BEFORE paint (layout effect) so the menu is never shown at its
  // unpositioned top-left origin — that caused a first-open flash/jump. A
  // follow-up rAF re-measures the real width once mounted.
  useIsoLayoutEffect(() => {
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
        "overflow-auto rounded-xl border border-border bg-popover text-popover-foreground p-1.5",
        // Portalled menus must clear overlays like the SlideOver (z-[90]); the
        // in-flow variant only needs to beat page content.
        portal ? "fixed z-[120]" : cn("absolute z-50 mt-2 min-w-56", align === "end" ? "right-0" : "left-0"),
        contentClassName,
      )}
      style={
        portal
          ? pos
            ? {
                top: pos.top,
                left: pos.left,
                maxWidth: pos.maxW,
                // Tinggi dibatasi ruang yang tersedia di arah bukanya, jadi
                // daftar panjang menggulir DI DALAM menunya, bukan menembus
                // tepi layar.
                maxHeight: pos.maxH,
                // Only matchTriggerWidth pins a pos-derived width. Otherwise width
                // is CSS-driven (w-max / min-w) and STABLE across renders — a
                // pos-derived minWidth would change the menu width after the first
                // measurement and shift the placement on first open.
                ...(matchTriggerWidth ? { width: pos.width } : {}),
              }
            : // Not yet measured: keep it in the DOM (so it can be measured) but
              // invisible, so the unpositioned origin is never painted.
              { top: 0, left: 0, visibility: "hidden" }
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
