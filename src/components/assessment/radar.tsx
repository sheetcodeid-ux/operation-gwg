"use client";

import * as React from "react";

export interface RadarPoint {
  label: string;
  short: string;
  value: number; // 0–100
}

/**
 * Single-series competency radar (one brand hue — no categorical palette, so no
 * CVD validation needed). Theme-aware, recessive grid, hover tooltip per vertex.
 * The per-parameter bars rendered below it act as the accessible table view.
 */
export function CompetencyRadar({ data, size = 260 }: { data: RadarPoint[]; size?: number }) {
  const [active, setActive] = React.useState<number | null>(null);
  const N = data.length;
  const pad = 48;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - pad;
  const rings = [0.25, 0.5, 0.75, 1];

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });
  const poly = (r: (i: number) => number) => data.map((_, i) => { const p = pt(i, r(i)); return `${p.x},${p.y}`; }).join(" ");

  const dataPoly = poly((i) => (R * Math.max(0, Math.min(100, data[i].value))) / 100);
  const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / (N || 1));

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Profil kompetensi per parameter"
        className="animate-pop-in"
        style={{ overflow: "visible", transformOrigin: "center" }}
      >
        {/* grid rings */}
        {rings.map((lvl) => (
          <polygon key={lvl} points={poly(() => R * lvl)} fill="none" stroke="currentColor" strokeWidth={1} className="text-border" />
        ))}
        {/* spokes */}
        {data.map((_, i) => {
          const p = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth={1} className="text-border" />;
        })}
        {/* data polygon */}
        <polygon points={dataPoly} fill="var(--color-brand-500)" fillOpacity={0.18} stroke="var(--color-brand-500)" strokeWidth={2} strokeLinejoin="round" />
        {/* vertices */}
        {data.map((d, i) => {
          const p = pt(i, (R * d.value) / 100);
          const on = active === i;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={on ? 6 : 4}
              fill="var(--color-brand-500)"
              stroke="var(--color-background)"
              strokeWidth={2}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
        {/* axis labels */}
        {data.map((d, i) => {
          const p = pt(i, R + 16);
          const c = Math.cos(angle(i));
          const anchor = Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end";
          return (
            <text key={i} x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontWeight: 500 }}>
              {d.short}
            </text>
          );
        })}
      </svg>

      {/* center average */}
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span className="text-2xl font-semibold tabular-nums text-foreground">{avg}</span>
        <span className="text-[10px] text-muted-foreground">rata-rata</span>
      </div>

      {/* hover tooltip */}
      {active != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-2.5 py-1.5 text-center shadow-md"
          style={{ left: pt(active, (R * data[active].value) / 100).x, top: pt(active, (R * data[active].value) / 100).y - 8 }}
        >
          <p className="whitespace-nowrap text-[11px] font-medium text-foreground">{data[active].label}</p>
          <p className="text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">{Math.round(data[active].value)}%</p>
        </div>
      )}
    </div>
  );
}
