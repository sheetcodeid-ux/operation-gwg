import * as React from "react";

/**
 * Lightweight passthrough — previously a Framer-Motion scroll-reveal (fade/slide
 * on enter) plus a Lenis smooth-scroll provider. Both were removed because they
 * made the R&D pages heavy (constant requestAnimationFrame loop + per-card
 * IntersectionObserver animations) and slowed navigation.
 *
 * Kept as a plain wrapper so every existing call site works unchanged, but with
 * no animation/JS cost — content now renders instantly.
 */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  /** Accepted for backward-compat; ignored (no animation). */
  delay?: number;
  y?: number;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
