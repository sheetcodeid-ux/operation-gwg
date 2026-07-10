"use client";

import * as React from "react";
import { motion } from "motion/react";
import Lenis from "lenis";

/** Scroll-triggered reveal — fades & slides content up as it enters the viewport.
 *  Respects prefers-reduced-motion via Framer's reduced-motion handling. */
export function Reveal({ children, delay = 0, y = 16, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Lenis smooth scroll, scoped to the subtree that mounts it (R&D pages).
 *  Only smooths the wheel (desktop); touch stays native so mobile + body-zoom
 *  behave normally. Inner scrollers opt out with data-lenis-prevent. */
export function SmoothScroll() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}
