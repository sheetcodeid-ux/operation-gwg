"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Camera, ChartSpline, Loader2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/ui/combobox";
import { seasonalReportAction, seasonalSyncAction } from "@/lib/actions/seasonal";
import type { SeasonalReport } from "@/lib/data/seasonal";
import { cn, formatIDR, formatIDRShort } from "@/lib/utils";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** One distinct colour per month (stable, high-contrast on light & dark). */
const MONTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#84cc16"];
const AVG_COLOR = "#111827";
const SLIDER_MAROON = "#7f1d1d";

type Metric = "gross" | "net";
type Unit = "angka" | "persen";

interface Row {
  day: number;
  avg: number | null;
  [k: `m${number}`]: number | null;
}

export function SeasonalChart({
  initial,
  initialYear,
  years,
  outlets,
}: {
  initial: SeasonalReport;
  initialYear: number;
  years: number[];
  outlets: { id: string; name: string }[];
}) {
  const [report, setReport] = React.useState<SeasonalReport>(initial);
  const [year, setYear] = React.useState(initialYear);
  const [metric, setMetric] = React.useState<Metric>("gross");
  const [unit, setUnit] = React.useState<Unit>("angka");
  const [branch, setBranch] = React.useState("");
  const [showAvg, setShowAvg] = React.useState(true);
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const [range, setRange] = React.useState<{ start: number; end: number }>({ start: 0, end: 11 });
  const [syncLeft, setSyncLeft] = React.useState(0);
  const seqRef = React.useRef(0);
  const captureRef = React.useRef<HTMLDivElement>(null);

  // Months that actually have any data (only these are togglable / drawn).
  const presentMonths = React.useMemo(
    () => Array.from({ length: 12 }, (_, m) => m).filter((m) => report.months[m] && Object.keys(report.months[m]).length > 0),
    [report],
  );
  const visibleMonths = React.useMemo(
    () => presentMonths.filter((m) => m >= range.start && m <= range.end),
    [presentMonths, range],
  );

  // Per-month total (for the "Persen" normalisation = share of the month).
  const monthTotals = React.useMemo(() => {
    const t: Record<number, number> = {};
    for (const m of presentMonths) {
      let s = 0;
      for (const d of Object.values(report.months[m])) s += metric === "gross" ? d.gross : d.net;
      t[m] = s || 1;
    }
    return t;
  }, [report, presentMonths, metric]);

  const valueAt = React.useCallback(
    (m: number, day: number): number | null => {
      const v = report.months[m]?.[day];
      if (!v) return null;
      const raw = metric === "gross" ? v.gross : v.net;
      return unit === "persen" ? (raw / monthTotals[m]) * 100 : raw;
    },
    [report, metric, unit, monthTotals],
  );

  const data = React.useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (let day = 1; day <= 31; day++) {
      const row: Row = { day, avg: null };
      let sum = 0;
      let n = 0;
      for (const m of visibleMonths) {
        const val = valueAt(m, day);
        row[`m${m}`] = val;
        if (val != null) {
          sum += val;
          n += 1;
        }
      }
      row.avg = n ? sum / n : null;
      rows.push(row);
    }
    return rows;
  }, [visibleMonths, valueAt]);

  const fmt = React.useCallback((v: number) => (unit === "persen" ? `${v.toFixed(1)}%` : formatIDR(v)), [unit]);
  const fmtAxis = React.useCallback((v: number) => (unit === "persen" ? `${v.toFixed(0)}%` : formatIDRShort(v)), [unit]);

  // Background drain of days not yet cached (like the fraud page). Cancels on
  // year change via the seq guard.
  const drain = React.useCallback(async (y: number, br: string, seq: number, expected: number) => {
    setSyncLeft(expected);
    for (let i = 0; i < 60 && seqRef.current === seq; i++) {
      const s = await seasonalSyncAction(y, br);
      if (seqRef.current !== seq) return;
      if (!("synced" in s)) { toast.error(s.error); break; }
      setSyncLeft(s.remaining);
      const r = await seasonalReportAction(y, br);
      if (seqRef.current !== seq) return;
      if ("configured" in r) setReport(r);
      if (s.remaining === 0 || s.error || s.synced === 0) break;
    }
    if (seqRef.current === seq) setSyncLeft(0);
  }, []);

  // Load a (year, branch) selection: show cached data instantly, drain the rest.
  const load = React.useCallback(async (y: number, br: string) => {
    const seq = ++seqRef.current;
    setSyncLeft(0);
    const r = await seasonalReportAction(y, br);
    if (seqRef.current !== seq) return;
    if (!("configured" in r)) { toast.error((r as { error: string }).error); return; }
    setReport(r);
    if (r.pendingDays?.length) void drain(y, br, seq, r.pendingDays.length);
  }, [drain]);

  React.useEffect(() => {
    if (initial.pendingDays?.length) void drain(initialYear, "", ++seqRef.current, initial.pendingDays.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onYear(y: number) {
    setYear(y);
    setRange({ start: 0, end: 11 });
    void load(y, branch);
  }
  function onBranch(br: string) {
    setBranch(br);
    void load(year, br);
  }

  function capturePng() {
    const svg = captureRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const a = document.createElement("a");
      a.download = `musiman-${metric}-${year}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.onerror = () => toast.error("Gagal membuat gambar.");
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }

  const empty = presentMonths.length === 0;

  return (
    <div className="space-y-3">
      {/* Controls — one compact bar, swipes horizontally on mobile. */}
      <div className="glass rounded-2xl border border-border p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex shrink-0 items-center rounded-xl border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("chart")}
              className={cn("grid size-8 place-items-center rounded-lg", view === "chart" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              title="Grafik"
            >
              <ChartSpline className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn("grid size-8 place-items-center rounded-lg", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              title="Tabel"
            >
              <Table2 className="size-4" />
            </button>
          </div>

          <Combobox
            searchable={false}
            matchTriggerWidth
            value={String(year)}
            onChange={(v) => onYear(Number(v))}
            options={years.map((y) => ({ value: String(y), label: `Tahun ${y}` }))}
            className="w-32 shrink-0"
          />

          <Combobox
            value={branch}
            onChange={onBranch}
            className="w-48 shrink-0"
            options={[{ value: "", label: "Semua Cabang" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
            searchPlaceholder="Cari outlet…"
            placeholder="Semua Cabang"
          />

          <button
            type="button"
            onClick={() => setShowAvg((v) => !v)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium",
              showAvg ? "border-foreground/30 bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <ChartSpline className="size-4" /> Average
          </button>

          <Combobox
            searchable={false}
            matchTriggerWidth
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
            options={[{ value: "gross", label: "Gross Sales" }, { value: "net", label: "Net Sales" }]}
            className="w-36 shrink-0"
          />
          <Combobox
            searchable={false}
            matchTriggerWidth
            value={unit}
            onChange={(v) => setUnit(v as Unit)}
            options={[{ value: "angka", label: "Angka" }, { value: "persen", label: "Persen" }]}
            className="w-28 shrink-0"
          />

          {syncLeft > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Loader2 className="size-3 animate-spin" /> Sinkron · sisa {syncLeft} hari
            </span>
          )}

          <button
            type="button"
            onClick={capturePng}
            title="Simpan sebagai PNG"
            className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Camera className="size-4" />
          </button>
        </div>

        {/* Draggable month-range slider (drag handles / the bar to pick the span
            of months to overlay) + colour legend for the months in range. */}
        {!empty && (
          <div className="mt-3">
            <MonthRangeSlider value={range} onChange={setRange} present={new Set(presentMonths)} />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {visibleMonths.map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: MONTH_COLORS[m] }} />
                  {MONTHS[m]}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!report.configured ? (
        <div className="glass rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
          {report.error ?? "Integrasi POS belum aktif."}
        </div>
      ) : empty ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl border border-border px-6 py-16 text-center">
          {syncLeft > 0 ? <Loader2 className="size-7 animate-spin text-muted-foreground" /> : <ChartSpline className="size-8 text-muted-foreground" />}
          <p className="text-base font-semibold text-foreground">{syncLeft > 0 ? "Menyiapkan data musiman…" : `Belum ada data penjualan untuk ${year}`}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {syncLeft > 0 ? "Data harian sedang ditarik dari POS — grafik akan terisi otomatis." : "Coba pilih tahun lain atau tunggu sinkronisasi otomatis."}
          </p>
        </div>
      ) : view === "chart" ? (
        <div className="glass rounded-2xl border border-border p-3 sm:p-4">
          <div ref={captureRef} className="h-[62vh] min-h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} tickLine={false} interval={2} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.3} tickLine={false} width={64} />
                <Tooltip content={<SeasonalTooltip visibleMonths={visibleMonths} showAvg={showAvg} year={year} fmt={fmt} />} />
                {visibleMonths.map((m) => (
                  <Line
                    key={m}
                    type="linear"
                    dataKey={`m${m}`}
                    name={MONTHS[m]}
                    stroke={MONTH_COLORS[m]}
                    strokeWidth={1.4}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
                {showAvg && (
                  <Line
                    type="linear"
                    dataKey="avg"
                    name="Average"
                    stroke={AVG_COLOR}
                    strokeWidth={1.6}
                    strokeDasharray="5 4"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <SeasonalTable data={data} visibleMonths={visibleMonths} showAvg={showAvg} fmt={fmt} />
      )}
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: number;
  payload?: { dataKey: string; value: number | null; color: string; name: string }[];
  visibleMonths: number[];
  showAvg: boolean;
  year: number;
  fmt: (v: number) => string;
}

function SeasonalTooltip({ active, label, payload, showAvg, year, fmt }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null;
  // Chronological order (Jan → Des), Average last.
  const order = (dk: string) => (dk === "avg" ? 99 : Number(dk.slice(1)));
  const rows = payload
    .filter((p) => p.value != null && (showAvg || p.dataKey !== "avg"))
    .sort((a, b) => order(a.dataKey) - order(b.dataKey));
  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">Tanggal {label} · {year}</p>
      <div className="space-y-1">
        {rows.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">{fmt(p.value as number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** TradingView-style draggable month-range selector. Drag either handle to
 *  change the start/end month, or drag the filled bar to shift the whole span. */
function MonthRangeSlider({
  value,
  onChange,
  present,
}: {
  value: { start: number; end: number };
  onChange: (v: { start: number; end: number }) => void;
  present: Set<number>;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ mode: "start" | "end" | "range"; startVal: { start: number; end: number }; grab: number } | null>(null);
  const centerPct = (m: number) => ((m + 0.5) / 12) * 100;

  const monthAt = React.useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const frac = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(11, Math.floor(frac * 12)));
  }, []);

  React.useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const m = monthAt(e.clientX);
      if (d.mode === "start") onChange({ start: Math.min(m, value.end), end: value.end });
      else if (d.mode === "end") onChange({ start: value.start, end: Math.max(m, value.start) });
      else {
        const span = d.startVal.end - d.startVal.start;
        const s = Math.max(0, Math.min(11 - span, d.startVal.start + (m - d.grab)));
        onChange({ start: s, end: s + span });
      }
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [monthAt, onChange, value.start, value.end]);

  const beginDrag = React.useCallback(
    (mode: "start" | "end" | "range", clientX: number) => {
      drag.current = { mode, startVal: { start: value.start, end: value.end }, grab: monthAt(clientX) };
    },
    [value.start, value.end, monthAt],
  );

  return (
    <div className="select-none">
      {/* Month labels */}
      <div className="flex">
        {MONTH_SHORT.map((mo, m) => (
          <div
            key={m}
            className={cn(
              "flex-1 text-center text-[10px] font-medium",
              m >= value.start && m <= value.end ? "text-foreground" : present.has(m) ? "text-muted-foreground" : "text-muted-foreground/40",
            )}
          >
            {mo}
          </div>
        ))}
      </div>
      {/* Track — maroon range bar with two round handles, like the reference. */}
      <div ref={ref} className="relative mt-1 h-7 touch-none rounded-full bg-muted">
        <div
          onPointerDown={(e) => { e.preventDefault(); beginDrag("range", e.clientX); }}
          className="absolute inset-y-0 cursor-grab rounded-full active:cursor-grabbing"
          style={{ left: `${centerPct(value.start)}%`, right: `${100 - centerPct(value.end)}%`, background: SLIDER_MAROON }}
        >
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold tracking-[0.2em] text-white/80">⋮⋮⋮</span>
        </div>
        {(["start", "end"] as const).map((h) => (
          <button
            key={h}
            type="button"
            aria-label={h === "start" ? "Bulan awal" : "Bulan akhir"}
            onPointerDown={(e) => { e.preventDefault(); beginDrag(h, e.clientX); }}
            className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow active:cursor-grabbing"
            style={{ left: `${centerPct(h === "start" ? value.start : value.end)}%`, border: `2.5px solid ${SLIDER_MAROON}` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: SLIDER_MAROON }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SeasonalTable({
  data,
  visibleMonths,
  showAvg,
  fmt,
}: {
  data: Row[];
  visibleMonths: number[];
  showAvg: boolean;
  fmt: (v: number) => string;
}) {
  return (
    <div className="glass overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="whitespace-nowrap border-b border-border bg-muted/60 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Tgl</th>
            {visibleMonths.map((m) => (
              <th key={m} className="px-3 py-2 text-right font-medium">{MONTH_SHORT[m]}</th>
            ))}
            {showAvg && <th className="px-3 py-2 text-right font-medium">Avg</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.day} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-1.5 text-muted-foreground">{row.day}</td>
              {visibleMonths.map((m) => {
                const v = row[`m${m}`];
                return <td key={m} className="px-3 py-1.5 text-right tabular-nums text-foreground/90">{v == null ? "—" : fmt(v)}</td>;
              })}
              {showAvg && <td className="px-3 py-1.5 text-right font-medium tabular-nums text-foreground">{row.avg == null ? "—" : fmt(row.avg)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
