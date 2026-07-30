"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { stroke: "#94a3b8", fontSize: 11 } as const;
const GRID = "rgba(148,163,184,0.18)";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

/* ---- Complaint trend (received vs resolved) ---- */
export function TrendAreaChart({
  data,
  height = 260,
}: {
  data: { label: string; received: number; resolved: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gReceived" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,0.12)" }} />
        <Area type="monotone" dataKey="received" name="Received" stroke="#a78bfa" strokeWidth={2} fill="url(#gReceived)" />
        <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22d3ee" strokeWidth={2} fill="url(#gResolved)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---- Generic vertical bar chart ---- */
export function CategoryBarChart({
  data,
  color = "#7c3aed",
  height = 260,
  max,
  radius = 6,
  maxBarSize = 42,
  angle = -12,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  max?: number;
  radius?: number;
  maxBarSize?: number;
  angle?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={angle} dy={8} height={angle ? 44 : 28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={32} domain={max ? [0, max] : undefined} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" radius={[radius, radius, radius, radius]} fill={color} maxBarSize={maxBarSize} isAnimationActive animationBegin={120} animationDuration={1100} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- Vertical bar chart with a distinct color per bar ---- */
export function ColoredBarChart({
  data,
  height = 200,
  max,
  radius = 6,
  maxBarSize = 40,
  angle = 0,
  unit = "",
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
  max?: number;
  radius?: number;
  maxBarSize?: number;
  angle?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={angle} dy={6} height={angle ? 40 : 24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={30} domain={max ? [0, max] : undefined} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [`${v}${unit}`, ""]} />
        <Bar dataKey="value" radius={[radius, radius, radius, radius]} maxBarSize={maxBarSize}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- Combo: previous period (gray gradient bars) vs current (glowing blue line) ---- */
function CompareTick(props: { x?: number; y?: number; payload?: { value: string }; weekendLabels?: Set<string> }) {
  const { x = 0, y = 0, payload, weekendLabels } = props;
  const value = payload?.value ?? "";
  const weekend = weekendLabels?.has(value) ?? false;
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={11} fontWeight={weekend ? 600 : 400} fill={weekend ? "#ef4444" : "#94a3b8"}>
      {value}
    </text>
  );
}

export function ComboCompareChart({
  data,
  height = 260,
  weekendLabels,
  names = ["Current", "Previous"],
  valueFormatter,
}: {
  data: { label: string; current: number; previous: number }[];
  height?: number;
  weekendLabels?: Set<string>;
  /** [current, previous] tooltip/legend names. */
  names?: [string, string];
  /** Format tooltip values (e.g. Rp) — defaults to the raw number. */
  valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 14, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="cmpBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#64748b" stopOpacity={0.25} />
          </linearGradient>
          <linearGradient id="cmpArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={4} height={28} tick={<CompareTick weekendLabels={weekendLabels} />} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip
          contentStyle={tooltipStyle}
          wrapperStyle={{ zIndex: 40 }}
          allowEscapeViewBox={{ x: false, y: true }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v, name) => [valueFormatter && v !== undefined ? valueFormatter(Number(v)) : (v as number | string), name as string]}
        />
        {/* tooltipType="none": the shaded area duplicates the line's dataKey and
            must not add a second "current" row to the tooltip. */}
        <Area type="monotone" dataKey="current" stroke="none" fill="url(#cmpArea)" tooltipType="none" isAnimationActive animationDuration={1100} animationEasing="ease-out" />
        <Bar dataKey="previous" name={names[1]} fill="url(#cmpBar)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive animationBegin={120} animationDuration={1100} animationEasing="ease-out" />
        <Line
          type="monotone"
          dataKey="current"
          name={names[0]}
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          className="chart-glow-blue"
          isAnimationActive
          animationBegin={220}
          animationDuration={1200}
          animationEasing="ease-out"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---- Quality combo: hygiene gray bars + glowing hospitality line ---- */
export function QualityComboChart({
  data,
  height = 280,
}: {
  data: { label: string; hospitality: number; hygiene: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 14, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="qBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#64748b" stopOpacity={0.25} />
          </linearGradient>
          <linearGradient id="qArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} height={28} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, 100]} width={32} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Area type="monotone" dataKey="hospitality" name="Hospitality" stroke="none" fill="url(#qArea)" />
        <Bar dataKey="hygiene" name="Hygiene" fill="url(#qBar)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          type="monotone"
          dataKey="hospitality"
          name="Hospitality"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 2, fill: "#3b82f6", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          className="chart-glow-blue"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ---- Multi-series line chart ---- */
export function MultiLineChart({
  data,
  series,
  height = 280,
}: {
  data: Record<string, string | number>[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---- Donut ---- */
export function DonutChart({
  data,
  height = 240,
  showLegend = true,
  centerValue,
  centerLabel,
  centerColor,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
  showLegend?: boolean;
  centerValue?: string;
  centerLabel?: string;
  centerColor?: string;
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="64%"
            outerRadius="90%"
            paddingAngle={3}
            cornerRadius={5}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />}
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color: centerColor ?? "var(--foreground)" }}>
            {centerValue}
          </span>
          {centerLabel && <span className="max-w-[7rem] truncate text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
