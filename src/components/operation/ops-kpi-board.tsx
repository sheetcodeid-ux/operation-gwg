"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, PenLine, Save, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { getOpsKpiBoardAction, saveOpsKpiManualAction, saveOpsKpiWeightsAction } from "@/lib/actions/ops-kpi";
import type { OpsKpiBoard, OpsKpiOutletRow } from "@/lib/data/ops-kpi";
import {
  OPS_KPI_INDICATORS,
  OPS_MONTHS,
  fmtRp,
  opsKpiCategory,
  opsPeriod,
  opsPeriodLabel,
  type OpsKpiKey,
  type OpsKpiRow,
} from "@/lib/ops-kpi";

const BLUE = "#3b82f6";
const GREY = "#94a3b8";
const SLICE = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6"];
const R = 66;
const STROKE = 22;
const CIRC = 2 * Math.PI * R;

const TONE_CLASS: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  brand: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const pct = (n: number) => `${num(Math.round(n * 100) / 100)}%`;
/** Indikator uang ditampilkan sebagai Rupiah, sisanya angka biasa. */
const val = (r: OpsKpiRow, n: number) => (r.indicator.unit === "Rp" ? fmtRp(n) : num(n));

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-card/40 p-5", className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function OpsKpiBoardView({ canEdit }: { canEdit: boolean }) {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [areaId, setAreaId] = React.useState("");
  const [board, setBoard] = React.useState<OpsKpiBoard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const period = opsPeriod(year, month);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getOpsKpiBoardAction(period, areaId);
    setLoading(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setBoard(res);
  }, [period, areaId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const rows = board?.rows ?? [];
  const score = board?.score ?? 0;
  const cat = opsKpiCategory(score);
  const below = rows.filter((r) => r.capaian < 100);
  const yearOpts = [year - 2, year - 1, year, year + 1].map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div>
      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Combobox
          className="w-56"
          value={areaId}
          onChange={setAreaId}
          searchPlaceholder="Cari area…"
          options={[
            { value: "", label: "Semua Outlet" },
            ...(board?.areas ?? []).map((a) => ({ value: a.id, label: `${a.name} — ${a.coordinator}` })),
          ]}
        />
        <Combobox
          className="w-40"
          searchable={false}
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={OPS_MONTHS.map((m, i) => ({ value: String(i), label: m }))}
        />
        <Combobox className="w-28" searchable={false} value={String(year)} onChange={(v) => setYear(Number(v))} options={yearOpts} />
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        {canEdit && board && (
          <div className="ml-auto flex items-center gap-2">
            <WeightsSheet weights={board.weights} onSaved={load} />
            <ManualSheet board={board} onSaved={load} />
          </div>
        )}
      </div>

      {/* Capaian + donut */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Panel
          title="Capaian per Indikator"
          subtitle={`${opsPeriodLabel(period)} · ${board?.areaName ?? "Semua Outlet"}${board?.coordinatorName && board.coordinatorName !== "—" ? ` · ${board.coordinatorName}` : ""}`}
        >
          <div className="min-h-[17rem] flex-1" style={{ outline: "none" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={rows.map((r) => ({ name: r.indicator.short, capaian: Math.round(r.capaian), bobot: r.weight, full: r.indicator.name }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                accessibilityLayer={false}
              >
                <defs>
                  <linearGradient id="opsBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="opsGrey" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREY} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={GREY} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} height={22} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={34} unit="%" />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<ChartTip />} />
                <Bar dataKey="bobot" name="Bobot" fill="url(#opsGrey)" radius={[3, 3, 0, 0]} maxBarSize={34} />
                <Area type="monotone" dataKey="capaian" name="Capaian" stroke={BLUE} strokeWidth={2.5} fill="url(#opsBlue)" dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} className="chart-glow-blue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <ContributionDonut rows={rows} score={score} category={cat} />
      </div>

      {/* Tren + tindak lanjut */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Panel title="Tren Total Skor KPI" subtitle="Enam periode terakhir">
          <div className="h-[13rem]" style={{ outline: "none" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={(board?.trend ?? []).map((t) => ({ name: opsPeriodLabel(t.period).split(" ")[0].slice(0, 3), skor: t.score, full: opsPeriodLabel(t.period) }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                accessibilityLayer={false}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} height={22} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={34} unit="%" />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<TrendTip />} />
                <Area type="monotone" dataKey="skor" stroke={BLUE} strokeWidth={2.5} fill="url(#opsBlue)" dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} className="chart-glow-blue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Tindak Lanjut" subtitle={cat.label}>
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">{cat.action}</p>
            {below.length === 0 ? (
              <p className="text-xs text-muted-foreground">Semua indikator sudah mencapai target.</p>
            ) : (
              <ul className="space-y-1.5">
                {below.map((r) => (
                  <li key={r.indicator.key} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>
                      <strong>{r.indicator.name}</strong> — {pct(r.capaian)} dari target ({val(r, r.realisasi)} / {val(r, r.target)}).
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
              <span className="text-xs text-muted-foreground">Outlet dihitung</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{board?.outlets.length ?? 0}</span>
            </div>
          </div>
        </Panel>
      </div>

      <IndicatorTable rows={rows} />

      {board && board.excluded.length > 0 && <ExcludedNote rows={board.excluded} />}
      {board && <OutletTable rows={board.outlets} />}
    </div>
  );
}

/* ─────────────────────────── tooltips ─────────────────────────── */

interface TipPayload { payload: { full: string; capaian?: number; bobot?: number; skor?: number } }
function ChartTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">{d.full}</p>
      <p className="flex items-center gap-2 text-muted-foreground">Capaian <span className="ml-auto font-semibold text-foreground">{pct(d.capaian ?? 0)}</span></p>
      <p className="flex items-center gap-2 text-muted-foreground">Bobot <span className="ml-auto font-semibold text-foreground">{d.bobot}%</span></p>
    </div>
  );
}
function TrendTip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">{d.full}</p>
      <p className="text-muted-foreground">Total skor <span className="font-semibold text-foreground">{pct(d.skor ?? 0)}</span></p>
    </div>
  );
}

/* ─────────────────────────── donut kontribusi ─────────────────────────── */

function ContributionDonut({ rows, score, category }: { rows: OpsKpiRow[]; score: number; category: ReturnType<typeof opsKpiCategory> }) {
  const [activeKey, setActiveKey] = React.useState<OpsKpiKey | null>(null);
  const slices = rows.map((r, i) => ({ key: r.indicator.key, label: r.indicator.name, value: r.aktual, color: SLICE[i % SLICE.length] }));
  const total = slices.reduce((a, s) => a + s.value, 0);
  const active = slices.find((s) => s.key === activeKey) ?? null;

  const arcs = React.useMemo(() => {
    let acc = 0;
    return slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = total ? (s.value / total) * CIRC : 0;
        const rot = -90 + (acc / CIRC) * 360;
        acc += len;
        return { key: s.key, color: s.color, len, rot };
      });
  }, [slices, total]);

  return (
    <Panel title="Kontribusi ke Total Skor" subtitle="% Aktual = Bobot × Capaian">
      <div className="flex flex-1 items-center gap-4 py-2">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 176 176" className="h-full w-full">
            {arcs.length === 0 ? (
              <circle cx={88} cy={88} r={R} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={STROKE} />
            ) : (
              arcs.map((a) => (
                <circle
                  key={a.key}
                  cx={88}
                  cy={88}
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${a.len} ${CIRC - a.len}`}
                  transform={`rotate(${a.rot} 88 88)`}
                  className="cursor-pointer transition-opacity"
                  style={{ opacity: active && a.key !== active.key ? 0.55 : 1 }}
                  onMouseEnter={() => setActiveKey(a.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onClick={() => setActiveKey(a.key)}
                />
              ))
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className={cn("text-[2rem] font-extrabold leading-none tracking-tight", TONE_CLASS[category.tone])}>
                {active ? pct(active.value) : `${num(score)}%`}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{active ? active.label : category.label}</p>
            </div>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {slices.map((s) => (
            <li
              key={s.key}
              onMouseEnter={() => setActiveKey(s.key)}
              onMouseLeave={() => setActiveKey(null)}
              onClick={() => setActiveKey(s.key)}
              className="flex cursor-pointer items-start gap-2 text-xs"
            >
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className={active?.key === s.key ? "font-medium text-foreground" : "text-foreground/85"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-xs text-muted-foreground">Total Skor KPI</span>
        <Badge tone={category.tone === "brand" ? "brand" : category.tone}>{category.label}</Badge>
      </div>
    </Panel>
  );
}

/* ─────────────────────────── tabel indikator ─────────────────────────── */

function IndicatorTable({ rows }: { rows: OpsKpiRow[] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60 text-xs text-muted-foreground">
            <th className="px-3 py-3 text-left font-medium">Indikator</th>
            <th className="px-3 py-3 text-right font-medium">Bobot</th>
            <th className="px-3 py-3 text-right font-medium">Target</th>
            <th className="px-3 py-3 text-right font-medium">Realisasi</th>
            <th className="px-3 py-3 text-right font-medium">Capaian</th>
            <th className="px-3 py-3 text-right font-medium">% Aktual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.indicator.key} className="border-t border-border/60">
              <td className="px-3 py-2.5">
                <p className="font-medium text-foreground">{r.indicator.name}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{r.indicator.measure}</p>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{r.weight}%</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{val(r, r.target)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{val(r, r.realisasi)}</td>
              <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", r.capaian >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{pct(r.capaian)}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{num(r.aktual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────── tabel per outlet ─────────────────────────── */

function OutletTable({ rows }: { rows: OpsKpiOutletRow[] }) {
  const [q, setQ] = React.useState("");
  const shown = rows.filter((r) => r.outletName.toLowerCase().includes(q.toLowerCase()));
  const sum = (f: (r: OpsKpiOutletRow) => number) => rows.reduce((a, r) => a + f(r), 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Rincian per Outlet ({rows.length})</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari outlet…"
          className="w-48 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[72rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-3 text-left font-medium">Outlet</th>
              <th className="px-2 py-3 text-right font-medium">AVG 3 Bln</th>
              <th className="px-2 py-3 text-right font-medium">Target GS</th>
              <th className="px-2 py-3 text-right font-medium">Actual GS</th>
              <th className="px-2 py-3 text-right font-medium">Target NP</th>
              <th className="px-2 py-3 text-right font-medium">Actual NP</th>
              <th className="px-2 py-3 text-right font-medium">Target WH</th>
              <th className="px-2 py-3 text-right font-medium">Actual WH</th>
              <th className="px-2 py-3 text-right font-medium">Target Non-WH</th>
              <th className="px-2 py-3 text-right font-medium">Actual Non-WH</th>
              <th className="px-2 py-3 text-right font-medium">Komplain</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.outletId} className="border-t border-border/60 hover:bg-foreground/5">
                <td className="sticky left-0 z-10 bg-card px-3 py-2">
                  <p className="truncate font-medium text-foreground">{r.outletName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.areaName}</p>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtRp(r.avg3)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtRp(r.targetGs)}</td>
                <td className={cn("px-2 py-2 text-right font-medium tabular-nums", r.actualGs >= r.targetGs ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{fmtRp(r.actualGs)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtRp(r.targetNp)}</td>
                <td className={cn("px-2 py-2 text-right font-medium tabular-nums", r.actualNp >= r.targetNp ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>{fmtRp(r.actualNp)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtRp(r.targetWh)}</td>
                <td className={cn("px-2 py-2 text-right tabular-nums", r.actualWh > r.targetWh && r.targetWh > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{fmtRp(r.actualWh)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{fmtRp(r.targetNonWh)}</td>
                <td className={cn("px-2 py-2 text-right tabular-nums", r.actualNonWh > r.targetNonWh && r.targetNonWh > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{fmtRp(r.actualNonWh)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-foreground">{r.complaints}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 text-[13px] font-semibold text-foreground">
              <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5">Total</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.avg3))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.targetGs))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.actualGs))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.targetNp))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.actualNp))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.targetWh))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.actualWh))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.targetNonWh))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtRp(sum((r) => r.actualNonWh))}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{sum((r) => r.complaints)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Warehouse &amp; Non-Warehouse ditampilkan sebagai kontrol biaya — keduanya tidak berbobot dan tidak memengaruhi skor KPI.
      </p>
    </div>
  );
}

function ExcludedNote({ rows }: { rows: OpsKpiOutletRow[] }) {
  return (
    <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
        <TriangleAlert className="size-4 shrink-0" /> {rows.length} outlet tidak ikut dihitung
      </p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.outletId} className="text-xs text-amber-700/90 dark:text-amber-300/90">
            <span className="font-medium">{r.outletName}</span> — {r.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── isian manual & bobot ─────────────────────────── */

function ManualSheet({ board, onSaved }: { board: OpsKpiBoard; onSaved: () => void }) {
  return (
    <Sheet>
      <SheetTrigger>
        <Button size="sm" variant="outline">
          <PenLine className="size-4" /> Isian Manual
        </Button>
      </SheetTrigger>
      <SheetContent
        title="Isian Manual KPI"
        description={`${opsPeriodLabel(board.period)} · ${board.areaName}`}
        className="max-w-md"
      >
        <ManualForm board={board} onSaved={onSaved} />
      </SheetContent>
    </Sheet>
  );
}

function ManualForm({ board, onSaved }: { board: OpsKpiBoard; onSaved: () => void }) {
  const { setOpen } = useSheetControl();
  const [ps, setPs] = React.useState(String(board.manual.problemSolver));
  const [psTarget, setPsTarget] = React.useState(String(board.manual.problemSolverTarget));
  const [cTarget, setCTarget] = React.useState(String(board.manual.complaintTarget));
  const [note, setNote] = React.useState(board.manual.note);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const res = await saveOpsKpiManualAction({
      period: board.period,
      areaId: board.areaId,
      problemSolver: Number(ps) || 0,
      problemSolverTarget: Number(psTarget) || 0,
      complaintTarget: Number(cTarget) || 0,
      note,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Isian manual tersimpan.");
    setOpen(false);
    onSaved();
  }

  return (
    <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Nilai ini berlaku untuk periode &amp; area yang sedang dipilih. Indikator lain terisi otomatis dari ESB, Laba Rugi,
        Pembelian, dan Komplain.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nilai Problem Solver">
          <Input type="number" min={0} value={ps} onChange={(e) => setPs(e.target.value)} />
        </Field>
        <Field label="Target Problem Solver">
          <Input type="number" min={0} value={psTarget} onChange={(e) => setPsTarget(e.target.value)} />
        </Field>
      </div>
      <Field label="Target Maksimal Komplain" hint="0 berarti tidak boleh ada komplain sama sekali.">
        <Input type="number" min={0} value={cTarget} onChange={(e) => setCTarget(e.target.value)} />
      </Field>
      <Field label="Catatan (opsional)">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Konteks penilaian periode ini…" />
      </Field>
      {board.updatedByName && <p className="text-[11px] text-muted-foreground">Terakhir diubah oleh {board.updatedByName}.</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </Button>
      </div>
    </div>
  );
}

function WeightsSheet({ weights, onSaved }: { weights: Record<OpsKpiKey, number>; onSaved: () => void }) {
  return (
    <Sheet>
      <SheetTrigger>
        <Button size="sm" variant="outline">
          <SlidersHorizontal className="size-4" /> Bobot
        </Button>
      </SheetTrigger>
      <SheetContent title="Bobot Indikator" description="Total seluruh bobot harus 100%." className="max-w-md">
        <WeightsForm weights={weights} onSaved={onSaved} />
      </SheetContent>
    </Sheet>
  );
}

function WeightsForm({ weights, onSaved }: { weights: Record<OpsKpiKey, number>; onSaved: () => void }) {
  const { setOpen } = useSheetControl();
  const [draft, setDraft] = React.useState<Record<OpsKpiKey, string>>(
    Object.fromEntries(OPS_KPI_INDICATORS.map((i) => [i.key, String(weights[i.key] ?? 0)])) as Record<OpsKpiKey, string>,
  );
  const [busy, setBusy] = React.useState(false);
  const total = OPS_KPI_INDICATORS.reduce((a, i) => a + (Number(draft[i.key]) || 0), 0);

  async function save() {
    setBusy(true);
    const next = Object.fromEntries(OPS_KPI_INDICATORS.map((i) => [i.key, Number(draft[i.key]) || 0])) as Record<OpsKpiKey, number>;
    const res = await saveOpsKpiWeightsAction(next);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Bobot tersimpan.");
    setOpen(false);
    onSaved();
  }

  return (
    <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
      {OPS_KPI_INDICATORS.map((i) => (
        <Field key={i.key} label={i.name}>
          <Input
            type="number"
            min={0}
            max={100}
            value={draft[i.key]}
            onChange={(e) => setDraft((d) => ({ ...d, [i.key]: e.target.value }))}
          />
        </Field>
      ))}
      <p className={cn("text-xs", total === 100 ? "text-muted-foreground" : "text-red-600 dark:text-red-400")}>
        Total bobot: <span className="font-semibold">{total}%</span>
        {total !== 100 && " — harus tepat 100%."}
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
        <Button onClick={save} disabled={busy || total !== 100}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </Button>
      </div>
    </div>
  );
}
