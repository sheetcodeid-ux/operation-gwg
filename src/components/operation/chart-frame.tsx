"use client";

import * as React from "react";
import { ImageDown, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportChartPng } from "./analysis-export";

/**
 * Wraps a chart with a small toolbar: export to PNG and open fullscreen (zoom).
 * The chart (a Recharts ResponsiveContainer) is passed as children and re-mounts
 * into the fullscreen layer when expanded so it re-measures to the larger size.
 */
export function ChartFrame({
  title,
  filename,
  height = 256,
  children,
}: {
  title: string;
  filename: string;
  height?: number;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [full, setFull] = React.useState(false);

  const Btn = ({ onClick, label, children: c }: { onClick: () => void; label: string; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      {c}
    </button>
  );

  const toolbar = (close?: boolean) => (
    <div className="flex items-center gap-0.5">
      <Btn onClick={() => exportChartPng(ref.current, filename)} label="Export PNG">
        <ImageDown className="size-4" />
      </Btn>
      <Btn onClick={() => setFull((f) => !f)} label={close ? "Tutup" : "Perbesar"}>
        {close ? <X className="size-4" /> : <Maximize2 className="size-4" />}
      </Btn>
    </div>
  );

  return (
    <>
      <div className={cn("rounded-xl border border-border bg-card/40", full && "opacity-0")}>
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          {toolbar()}
        </div>
        {!full && (
          <div ref={ref} style={{ height }} className="w-full px-1 pb-1">
            {children}
          </div>
        )}
      </div>

      {full && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-background/98 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {toolbar(true)}
          </div>
          <div ref={ref} className="min-h-0 flex-1">
            {children}
          </div>
        </div>
      )}
    </>
  );
}
