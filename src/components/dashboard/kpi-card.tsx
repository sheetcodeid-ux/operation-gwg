"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Coins,
  ConciergeBell,
  ListChecks,
  MapPinned,
  MessageSquareWarning,
  Package,
  Send,
  SprayCan,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

const KPI_ICONS: Record<string, LucideIcon> = {
  Store,
  MapPinned,
  ConciergeBell,
  SprayCan,
  MessageSquareWarning,
  CheckCircle2,
  ListChecks,
  CalendarRange,
  // R&D / HPP
  Calculator,
  Package,
  AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  Coins,
  Send,
};

export interface Kpi {
  label: string;
  value: string;
  icon: keyof typeof KPI_ICONS;
  tone: Tone;
  delta?: { value: number; positiveIsGood?: boolean };
  sub?: string;
}

/** Swipeable KPI row — shows ~4 cards, slide with ‹ › or drag/scroll. */
export function KpiCarousel({ items }: { items: Kpi[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  React.useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  function scroll(dir: number) {
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Key Metrics</h3>
        <div className="flex items-center gap-1.5">
          <CarouselBtn dir="left" disabled={atStart} onClick={() => scroll(-1)} />
          <CarouselBtn dir="right" disabled={atEnd} onClick={() => scroll(1)} />
        </div>
      </div>
      <div
        ref={ref}
        onScroll={update}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {items.map((kpi) => (
          <div
            key={kpi.label}
            className="shrink-0 basis-[80%] snap-start sm:basis-[calc(50%-8px)] lg:basis-[calc(25%-12px)]"
          >
            <KpiCard kpi={kpi} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CarouselBtn({ dir, disabled, onClick }: { dir: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Previous" : "Next"}
      className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {dir === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
    </button>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const Icon = KPI_ICONS[kpi.icon] ?? Store;
  const delta = kpi.delta;
  const good = delta ? (delta.positiveIsGood ?? true) === delta.value >= 0 : true;

  return (
    <div className="card-gradient flex h-full flex-col rounded-2xl p-4">
      {/* Top: icon + label + grip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <span className="truncate text-sm font-medium text-foreground">{kpi.label}</span>
        </div>
        <GripDots />
      </div>

      {/* Bottom: value + delta */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-5">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
          {kpi.sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{kpi.sub}</p>}
        </div>
        {delta && (
          <span
            className={cn(
              "mb-1 inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              delta.value === 0
                ? "bg-muted text-muted-foreground"
                : good
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                  : "bg-red-500/15 text-red-600 dark:text-red-300",
            )}
          >
            {delta.value === 0 ? (
              <ArrowRight className="size-3" />
            ) : delta.value >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta.value)}%
          </span>
        )}
      </div>
    </div>
  );
}

/** 2×3 dot drag-handle (Aniq-ui style). */
function GripDots() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-0.5 text-muted-foreground/30">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="size-1 rounded-full bg-current" />
      ))}
    </div>
  );
}
