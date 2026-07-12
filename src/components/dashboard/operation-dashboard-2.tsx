"use client";

/**
 * Dashboard Operation 2 — financial/operational overview (Juknis v1.0).
 *
 * Layout mirrors Dashboard 1 (Card primitives + balanced grid-cols-3 rows,
 * items-stretch) — normal page flow, NO frozen/independent-scroll rails.
 * Colors follow the app palette (tone.ts): blue #3b82f6, green, amber, slate.
 * Data is deterministic PLACEHOLDER, marked TODO(api) for later ERP/DB wiring.
 */

import * as React from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Coins,
  Download,
  Eye,
  Flame,
  Layers,
  PackageSearch,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConcentricRings } from "@/components/dashboard/concentric-rings";
import type { OpsDashboardData, OpsFraud, OpsHourly } from "@/lib/data/ops-dashboard";
import { cn } from "@/lib/utils";

/* ---------- palette (tone.ts) ---------- */
const C = { blue: "#3b82f6", blueLt: "#93c5fd", green: "#22c55e", amber: "#f59e0b", red: "#ef4444", slate: "#94a3b8", slate2: "#64748b" };
/** 8 shades of blue (dark → light) for the stacked Beban chart gradient. */
const BLUES = ["#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"];
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
const rand = (seed: number) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };

const EXPENSE_CATS = ["Utilitas", "Sewa", "Tenaga Kerja", "Potongan", "Manajemen Fee", "Pemasaran", "Ongkos Kirim", "Lainnya"];
const EXPENSE_THRESHOLD: Record<string, number> = { Utilitas: 3, Sewa: 3, "Tenaga Kerja": 13, Potongan: 3, "Manajemen Fee": 3, Pemasaran: 3, "Ongkos Kirim": 3, Lainnya: 3 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/* ==================================================================== */

export function OperationDashboard2({ initial }: { initial: OpsDashboardData }) {
  const [period, setPeriod] = React.useState("bulan");
  const [cabang, setCabang] = React.useState("all");
  const [ca, setCa] = React.useState("all");

  const kpi = initial.kpi;
  const nsDelta = kpi && kpi.netSalesPrev > 0 ? +(((kpi.netSales - kpi.netSalesPrev) / kpi.netSalesPrev) * 100).toFixed(1) : 0;
  const cabangOptions = [{ v: "all", l: "Semua Cabang" }, ...initial.branches.map((b) => ({ v: b.code, l: b.name }))];

  return (
    <div className="w-full space-y-4">
      {/* Global filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">Periode</span>
          <PillSelect value={period} onChange={setPeriod} bare options={[{ v: "hari", l: "Per Hari" }, { v: "minggu", l: "Per Minggu" }, { v: "bulan", l: "Per Bulan 2026.03" }]} />
        </div>
        {initial.configured ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" /> ERP tersambung
            {initial.errors.length > 0 && <span className="text-amber-600 dark:text-amber-400"> · sebagian gagal: {initial.errors.join(", ")}</span>}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-slate-400" /> ERP belum tersambung
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PillSelect value={ca} onChange={setCa} options={[{ v: "all", l: "Semua CA" }, { v: "owner", l: "Owner" }, { v: "spv", l: "SPV" }]} />
          <PillSelect value={cabang} onChange={setCabang} options={cabangOptions} />
          <Button size="sm" className="gap-1.5"><Eye className="size-3.5" /> Petinjau</Button>
          <Button size="sm" variant="outline" className="gap-1.5"><Download className="size-3.5" /> Download</Button>
        </div>
      </div>

      {/* 3-rail layout exactly like the Figma: narrow-left · wide-middle · narrow-right.
          Normal page flow (no freeze); columns align to top. */}
      <div className="grid items-start gap-4 lg:grid-cols-12">
        {/* LEFT rail — targets & produk */}
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <TargetGauge />
          <ProgressCard title="Proyeksi Bulanan" pct={50} actual={300_000_000} target={600_000_000} />
          <ProgressCard title="Target Harian" pct={50} actual={10_000_000} target={20_000_000} />
          <WeeklyTarget />
          <ProdukCard />
        </div>

        {/* MIDDLE rail — KPI 2×2, charts, table */}
        <div className="min-w-0 space-y-4 lg:col-span-6">
          <div className="grid grid-cols-2 gap-4">
            <KpiTile icon={Coins} label="Net Sales" value={kpi ? rp(kpi.netSales) : rp(100_000_000)} delta={kpi ? nsDelta : 2.45} live={!!kpi} />
            <KpiTile icon={ShoppingCart} label="Pembelian" value={rp(100_000_000)} delta={2.45} />
            <KpiTile icon={Wallet} label="Beban Operasional" value={rp(100_000_000)} delta={-2.45} positiveIsGood={false} />
            <KpiTile icon={TrendingUp} label="Laba Bersih" value={rp(100_000_000)} delta={2.45} />
          </div>
          <PenjualanChart hourly={initial.hourly} />
          <BebanChart />
          <PerformaCabang />
        </div>

        {/* RIGHT rail — distribusi, kontrol, rencana, aktivitas */}
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <DistribusiMargin />
          <KontrolCard fraud={initial.fraud} />
          <RencanaPengeluaran />
          <AktivitasTerkini />
        </div>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
function PillSelect({ value, onChange, options, bare }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; bare?: boolean }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("cursor-pointer appearance-none rounded-lg pr-7 text-xs font-medium text-foreground outline-none", bare ? "bg-transparent" : "border border-border bg-card py-1.5 pl-3")}>
        {options.map((o) => <option key={o.v} value={o.v} className="bg-popover text-foreground">{o.l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </div>
  );
}
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("flex flex-col p-5", className)}>{children}</Card>;
}
function Head({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {desc && <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
function GripDots() {
  return <div className="grid shrink-0 grid-cols-2 gap-0.5 text-muted-foreground/30">{Array.from({ length: 6 }).map((_, i) => <span key={i} className="size-1 rounded-full bg-current" />)}</div>;
}
function Delta({ v, positiveIsGood = true }: { v: number; positiveIsGood?: boolean }) {
  const zero = v === 0;
  const good = v >= 0 === positiveIsGood;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", zero ? "bg-muted text-muted-foreground" : good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-red-500/15 text-red-600 dark:text-red-300")}>
      {zero ? <ArrowRight className="size-3" /> : v >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(v)}%
    </span>
  );
}

/* Premium hover tooltip (crosshair) shared by charts. */
type TipPayload = { name?: string; value?: number; color?: string; dataKey?: string };
type TipProps = { active?: boolean; label?: React.ReactNode; payload?: TipPayload[]; money?: boolean; suffix?: string };
function ChartTip({ active, label, payload, money, suffix }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="mb-1.5 font-medium text-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.filter((p) => p.value != null).map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{money ? rp(Math.abs(Number(p.value))) : `${Number(p.value)}${suffix ?? ""}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- KPI ---------- */
function KpiTile({ icon: Icon, label, value, delta, positiveIsGood, live }: { icon: LucideIcon; label: string; value: string; delta: number; positiveIsGood?: boolean; live?: boolean }) {
  return (
    <div className="card-gradient flex flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border"><Icon className="size-5 text-muted-foreground" /></div>
        {live ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><span className="size-1 rounded-full bg-emerald-500" />live</span> : <GripDots />}
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">vs kemarin</p>
        </div>
        <Delta v={delta} positiveIsGood={positiveIsGood} />
      </div>
    </div>
  );
}

/* ---------- Penjualan (3-line chart) ---------- */
function PenjualanChart({ className, hourly }: { className?: string; hourly: OpsHourly[] | null }) {
  const [mode, setMode] = React.useState("harian");
  const points = mode === "harian" ? 24 : mode === "mingguan" ? 7 : 30;
  const label = (i: number) => (mode === "harian" ? String(i).padStart(2, "0") : mode === "mingguan" ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][i] : String(i + 1));
  const r = rand(7 + points);
  // Real ERP hourly (today vs yesterday) drives Harian mode; other modes use placeholder until wired.
  const useReal = mode === "harian" && hourly && hourly.length > 0;
  const target = useReal ? Math.round(hourly!.reduce((a, p) => Math.max(a, p.hari), 0) * 0.9) : 6500;
  const data = useReal
    ? hourly!.map((p) => ({ x: p.x, hari: p.hari, kemarin: p.kemarin, target }))
    : Array.from({ length: points }, (_, i) => ({ x: label(i), hari: Math.round(3000 + r() * 6000), kemarin: Math.round(2500 + r() * 5000), target: 6500 }));
  const total = useReal ? hourly!.reduce((a, p) => a + p.hari, 0) : 100_000_000;
  return (
    <Panel className={className}>
      <Head title="Penjualan" desc={useReal ? "Data ERP · hari ini vs kemarin vs target" : "Hari ini vs kemarin vs target"} right={<PillSelect value={mode} onChange={setMode} options={[{ v: "harian", l: "Harian" }, { v: "mingguan", l: "Mingguan" }, { v: "bulanan", l: "Bulanan" }]} />} />
      <div className="mb-2 flex items-center gap-2"><p className="text-xl font-bold tabular-nums text-foreground">{rp(total)}</p><Delta v={1.78} />{useReal && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>}</div>
      <div className="min-h-[15rem] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="x" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} interval={mode === "harian" ? 1 : 0} minTickGap={4} />
            <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}K`} />
            <Tooltip cursor={{ stroke: "rgba(148,163,184,0.4)", strokeDasharray: "3 3" }} content={(p) => <ChartTip {...(p as unknown as TipProps)} money />} />
            <Line type="monotone" dataKey="target" name="Target" stroke={C.amber} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="kemarin" name="Kemarin" stroke={C.slate} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="hari" name="Hari ini" stroke={C.blue} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} className="chart-glow-blue" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: C.blue }} /> Hari ini</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: C.slate }} /> Kemarin</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full border-b-2 border-dashed" style={{ borderColor: C.amber }} /> Target</span>
      </div>
    </Panel>
  );
}

/* ---------- Distribusi Margin (2 concentric-ring views) ---------- */
function DistribusiMargin() {
  const [view, setView] = React.useState("wilayah");
  const sets: Record<string, { sehat: number; cukup: number; kritis: number }> = {
    wilayah: { sehat: 30, cukup: 15, kritis: 5 },
    coordinator: { sehat: 22, cukup: 18, kritis: 10 },
  };
  const d = sets[view];
  const total = d.sehat + d.cukup + d.kritis;
  const pct = (n: number) => Math.round((n / total) * 100);
  const rings = [
    { label: "Sehat", value: pct(d.sehat), color: C.green },
    { label: "Cukup", value: pct(d.cukup), color: C.amber },
    { label: "Kritis", value: pct(d.kritis), color: C.red },
  ];
  const legend = [
    { label: "Sehat", sub: ">30% margin", color: C.green, count: d.sehat, icon: CheckCircle2 },
    { label: "Cukup", sub: "29–30% margin", color: C.amber, count: d.cukup, icon: CircleAlert },
    { label: "Kritis", sub: "<15% margin", color: C.red, count: d.kritis, icon: AlertTriangle },
  ];
  return (
    <Panel>
      <Head title="Distribusi Margin" desc="Sebaran kesehatan margin cabang" />
      <SegmentedTabs size="sm" value={view} onChange={setView} items={[{ value: "wilayah", label: "Wilayah" }, { value: "coordinator", label: "Coordinator" }]} />
      <div className="mt-3 flex flex-1 flex-wrap content-center items-center justify-center gap-5">
        <ConcentricRings rings={rings} centerValue={rings[0].value} centerLabel="Sehat" size={168} />
        <ul className="min-w-44 flex-1 space-y-3">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: `${l.color}22` }}><l.icon className="size-4" style={{ color: l.color }} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{l.label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{l.sub}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: l.color }}>{l.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/* ---------- Beban Operasional (blue-gradient stacked) ---------- */
function BebanChart({ className }: { className?: string }) {
  const [mode, setMode] = React.useState("persentase");
  const r = rand(11);
  const data = MONTHS.map((m) => { const row: Record<string, number | string> = { m }; for (const c of EXPENSE_CATS) row[c] = Math.round(2 + r() * 6); return row; });
  return (
    <Panel className={className}>
      <Head title="Beban Operasional" desc="Rincian beban per kategori (% omset) · 12 bulan" right={<PillSelect value={mode} onChange={setMode} options={[{ v: "persentase", l: "Persentase" }, { v: "nominal", l: "Nominal" }]} />} />
      <div className="mb-1 flex items-center gap-2"><p className="text-xl font-bold tabular-nums text-foreground">{rp(100_000_000)}</p><Delta v={1.78} positiveIsGood={false} /></div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
        {EXPENSE_CATS.map((c, i) => <span key={c} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-2 rounded-full" style={{ background: BLUES[i] }} /> {c}</span>)}
      </div>
      <div className="min-h-[14rem] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={30} tickFormatter={(v) => `${v}%`} />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={(p) => <ChartTip {...(p as unknown as TipProps)} suffix="%" />} />
            <ReferenceLine y={13} stroke={C.red} strokeDasharray="4 4" strokeOpacity={0.5} />
            {EXPENSE_CATS.map((c, i) => <Bar key={c} dataKey={c} stackId="e" fill={BLUES[i]} radius={i === EXPENSE_CATS.length - 1 ? [3, 3, 0, 0] : undefined} maxBarSize={34} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Garis putus merah = ambang batas (threshold {EXPENSE_THRESHOLD["Tenaga Kerja"]}% Tenaga Kerja)</p>
    </Panel>
  );
}

/* ---------- Performa Cabang (executive table, Juknis 2.8) ---------- */
type SortDir = "asc" | "desc";
function PerformaCabang({ className }: { className?: string }) {
  const [tab, setTab] = React.useState("net");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [dir, setDir] = React.useState<SortDir>("desc");
  const per = 8;

  const all = React.useMemo(() => {
    const r = rand(99);
    return Array.from({ length: 512 }, (_, i) => {
      const prev = Math.round(80_000_000 + r() * 60_000_000);
      const cur = Math.round(prev * (0.9 + r() * 0.3));
      const growth = +(((cur - prev) / prev) * 100).toFixed(2);
      return { id: i + 1, name: `Cabang ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`, area: ["Kalimantan", "Jawa", "Bali"][i % 3], prev, cur, growth };
    });
  }, []);

  const filtered = React.useMemo(() => {
    const s = all.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    s.sort((a, b) => (dir === "asc" ? a.growth - b.growth : b.growth - a.growth));
    return s;
  }, [all, q, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * per;
  const rows = filtered.slice(start, start + per);
  const colLabel = tab === "net" ? "Net Sales" : tab === "beli" ? "Pembelian" : "Laba Bersih";

  return (
    <Panel className={className}>
      <Head title="Performa Cabang" desc={`Perbandingan ${colLabel.toLowerCase()} antar cabang`} right={<SegmentedTabs size="sm" value={tab} onChange={(v) => { setTab(v); setPage(1); }} items={[{ value: "net", label: "Net Sales" }, { value: "beli", label: "Pembelian" }, { value: "laba", label: "Laba Bersih" }]} />} />
      <div className="relative mb-3 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari cabang…" className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-3 text-left font-medium">Cabang</th>
              <th className="px-3 py-3 text-right font-medium">{tab === "beli" ? "Bulan Lalu" : "Target Lalu"}</th>
              <th className="px-3 py-3 text-right font-medium">Bulan Ini</th>
              <th className="px-3 py-3 text-right font-medium">
                <button type="button" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))} className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
                  % Pertumbuhan {dir === "desc" ? <ArrowDown className="size-3.5" /> : dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-t border-border/60 transition-colors hover:bg-foreground/10">
                <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground ring-1 ring-border">{start + i + 1}</span>
                    <div className="min-w-0"><p className="truncate font-medium text-foreground">{row.name}</p><p className="truncate text-[11px] text-muted-foreground">{row.area}</p></div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{rp(row.prev)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(row.cur)}</td>
                <td className="px-3 py-2.5 text-right"><span className="inline-flex justify-end"><Delta v={row.growth} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p className="text-[13px]">Menampilkan {filtered.length ? start + 1 : 0} sampai {start + rows.length} dari {filtered.length} hasil</p>
        <div className="flex items-center gap-1">
          <button disabled={cur === 1} onClick={() => setPage(cur - 1)} className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-muted disabled:opacity-40">Sebelumnya</button>
          <div className="no-scrollbar flex max-w-[11rem] items-center gap-1 overflow-x-auto">
            {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, cur - 2), Math.max(0, cur - 2) + 4).map((n) => (
              <button key={n} onClick={() => setPage(n)} className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-medium tabular-nums", n === cur ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>{n}</button>
            ))}
          </div>
          <button disabled={cur === pages} onClick={() => setPage(cur + 1)} className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-muted disabled:opacity-40">Berikutnya</button>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Kontrol (tabs + scrollable) ---------- */
function KontrolCard({ fraud }: { fraud: OpsFraud[] | null }) {
  const [tab, setTab] = React.useState("fraud");
  const fraudRows = fraud && fraud.length > 0 ? fraud : [{ name: "Promosi", value: 21_000_000 }, { name: "Kompliment", value: 5_200_000 }, { name: "Refund", value: 420_000 }, { name: "Void", value: 420_000 }];
  return (
    <Panel>
      <Head title="Kontrol" desc="Pemantauan potensi kebocoran" right={fraud && fraud.length > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span> : undefined} />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "fraud", label: "Fraud" }, { value: "complain", label: "Complain" }, { value: "bersih", label: "Kebersihan" }, { value: "event", label: "Event" }]} />
      <div className="mt-3 max-h-72 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {tab === "fraud" && (
          <div className="space-y-2">
            {fraudRows.map((row, i) => (
              <div key={row.name + i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{row.name}</span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{rp(row.value)}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "complain" && (
          <div className="space-y-2">
            {[{ o: "Cattu A. Yani", k: "Service", s: "Open" }, { o: "Nordu Bengkayang", k: "Food Quality", s: "In Progress" }, { o: "Busari Desa", k: "Cleanliness", s: "Open" }, { o: "Cattu Canteen", k: "Price", s: "In Progress" }, { o: "Nordu Memambang", k: "Order Error", s: "Open" }].map((c, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{c.o}</span>
                  <Badge tone={c.s === "Open" ? "danger" : "warning"}>{c.s}</Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.k}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "bersih" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[12px]">
              <span className="text-muted-foreground">Sudah checklist hari ini</span><span className="font-semibold text-foreground">28 / 32 outlet</span>
            </div>
            {[{ o: "Cattu A. Yani", a: "Kitchen", ok: true }, { o: "Nordu Bengkayang", a: "Toilet", ok: false }, { o: "Busari Desa", a: "Dining Area", ok: true }, { o: "Cattu Sohor", a: "Bar", ok: true }].map((x, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[12px]">
                {x.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" /> : <XCircle className="size-4 shrink-0 text-red-500" />}
                <span className="min-w-0 flex-1 truncate text-foreground">{x.o}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{x.a}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "event" && (
          <div className="space-y-2">
            {[{ n: "Promo Kopi Susu", u: 42, up: true }, { n: "Bundling Roti", u: 30, up: true }, { n: "Diskon Weekend", u: 18, up: false }, { n: "Voucher Member", u: 9, up: false }].map((e, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[12px]">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{e.n}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{e.u}×</span>
                {e.up ? <Flame className="size-3.5 shrink-0 text-amber-500" /> : <TrendingDown className="size-3.5 shrink-0 text-slate-400" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ---------- Aktivitas Terkini (timeline) ---------- */
type Act = { who: string; t: string; a: string; tone: "blue" | "green" | "amber" | "red" };
function ActTimeline({ label, rows }: { label: string; rows: Act[] }) {
  const dot = { blue: C.blue, green: C.green, amber: C.amber, red: C.red };
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="relative space-y-3 pl-1">
        {rows.map((r, i) => (
          <div key={i} className="relative flex gap-3">
            <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: dot[r.tone] }}>{r.who[0]}</span>
            <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{r.who}</span> · {r.t}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-foreground">{r.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function AktivitasTerkini() {
  const [tab, setTab] = React.useState("divisi");
  const divisi: Record<string, Act[]> = {
    today: [
      { who: "Andi", t: "11:45", a: "Review performa operasional 32 outlet selesai", tone: "green" },
      { who: "Fikri", t: "09:22", a: "Sinkronisasi data penjualan seluruh outlet berhasil", tone: "blue" },
      { who: "Jayadi", t: "07:15", a: "Menindaklanjuti temuan audit Outlet Bengkayang", tone: "amber" },
    ],
    yest: [
      { who: "Deo", t: "17:50", a: "Approval permintaan stok Outlet Air Upas disetujui", tone: "green" },
      { who: "Poetri", t: "15:30", a: "Jadwal kunjungan Outlet Tanjung Duren diperbarui", tone: "blue" },
    ],
  };
  const outlet: Record<string, Act[]> = {
    today: [
      { who: "Cattu A. Yani", t: "10:12", a: "SPV belum upload checklist kebersihan hari ini", tone: "red" },
      { who: "Nordu Bengkayang", t: "09:40", a: "Omset turun 12% dari target harian", tone: "amber" },
      { who: "Busari Desa", t: "08:05", a: "Finance belum input laporan kemarin", tone: "red" },
    ],
    yest: [{ who: "Cattu Sohor", t: "18:20", a: "Omset hanya mencapai 28% target bulan ini", tone: "amber" }],
  };
  const src = tab === "divisi" ? divisi : outlet;
  return (
    <Panel>
      <Head title="Aktivitas Terkini" desc="Task Tracker (Divisi) & sistem (Outlet)" />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "outlet", label: "Outlet" }, { value: "divisi", label: "Divisi" }]} />
      <div className="mt-3 flex-1 space-y-4">
        <ActTimeline label="Hari ini" rows={src.today} />
        <ActTimeline label="Kemarin" rows={src.yest} />
      </div>
    </Panel>
  );
}

/* ---------- Target Per Bulan (gauge) ---------- */
function TargetGauge() {
  const pct = 95.38, R = 52, circ = Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <Panel>
      <Head title="Target Per Bulan" desc="Realisasi vs target bulan ini" />
      <div className="relative mx-auto grid h-28 w-56 place-items-end">
        <svg viewBox="0 0 140 78" className="w-full">
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>
          </defs>
          <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="var(--muted)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{ transition: "stroke-dasharray .7s ease" }} />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-[10px] text-muted-foreground">Total Target</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{pct}%</p>
          <p className="text-[10px] font-medium text-red-500">-5% vs bulan lalu</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] font-semibold tabular-nums text-foreground">Rp12.400.000.000 <span className="text-muted-foreground">/ 13M</span></p>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blue }} /> Realisasi</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blueLt }} /> Target</span>
      </div>
    </Panel>
  );
}
function ProgressCard({ title, pct, actual, target }: { title: string; pct: number; actual: number; target: number }) {
  return (
    <Panel>
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">{title}</h3><span className="text-lg font-bold tabular-nums text-foreground">{pct}%</span></div>
      <p className="mt-3 text-[13px] font-semibold tabular-nums text-foreground">{rp(actual)} <span className="text-muted-foreground">/ {rp(target)}</span></p>
      <div className="mt-2"><Progress value={pct} tone="cyan" /></div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blue }} /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blueLt }} /> Target</span>
      </div>
    </Panel>
  );
}
function WeeklyTarget() {
  const weeks = [
    { w: "Minggu I", a: 105_000_000, t: 210_000_000, p: 50 },
    { w: "Minggu II", a: 15_000_000, t: 30_000_000, p: 50 },
    { w: "Minggu III", a: 120_000_000, t: 240_000_000, p: 50 },
    { w: "Minggu IV", a: 90_000_000, t: 240_000_000, p: 37.5 },
    { w: "Minggu V", a: 60_000_000, t: 240_000_000, p: 25 },
  ];
  return (
    <Panel>
      <Head title="Target Mingguan" desc="Total Pengeluaran Rp120.000.000" />
      <div className="space-y-2.5">
        {weeks.map((w) => (
          <div key={w.w}>
            <div className="flex items-center justify-between text-[12px]"><span className="font-medium text-foreground">{w.w}</span><span className="text-muted-foreground tabular-nums">{w.p}%</span></div>
            <div className="mt-1"><Progress value={w.p} tone="cyan" /></div>
            <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{rp(w.a)} / {rp(w.t)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function ProdukCard() {
  const [tab, setTab] = React.useState("total");
  const [q, setQ] = React.useState("");
  const rows = Array.from({ length: 16 }, (_, i) => ({ rank: i + 1, name: `Kategori ${String.fromCharCode(65 + (i % 8))}`, qty: 200 - i * 8, val: [21_000_000, 5_200_000, 420_000][i % 3] || 420_000 }));
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel>
      <Head title="Produk" right={<PillSelect value="kategori" onChange={() => {}} options={[{ v: "kategori", l: "Kategori" }, { v: "produk", l: "Nama Produk" }]} />} />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "jumlah", label: "Jumlah" }, { value: "total", label: "Total" }]} />
      <div className="relative mt-2">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari Kategori" className="w-full rounded-lg border border-border bg-transparent py-1.5 pl-8 pr-2 text-[12px] outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {filtered.map((r) => (
          <div key={r.rank} className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{r.rank}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{r.name}</span>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{tab === "jumlah" ? `${r.qty}×` : rp(r.val)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- Rencana Pengeluaran (Juknis 2.11) ---------- */
function RencanaPengeluaran() {
  const rows = [
    { l: "Warehouse", a: 105_000_000, t: 210_000_000, actualPct: 25, limit: 30, icon: Boxes },
    { l: "Non Warehouse", a: 15_000_000, t: 30_000_000, actualPct: 6, limit: 5, icon: PackageSearch },
    { l: "Rasio Total", a: 120_000_000, t: 240_000_000, actualPct: 31, limit: 35, icon: Layers },
  ];
  return (
    <Panel>
      <Head title="Rencana Pengeluaran" desc="Pembelian vs omset · ambang batas" />
      <div className="space-y-3.5">
        {rows.map((row) => {
          const over = row.actualPct > row.limit;
          return (
            <div key={row.l} className={cn("rounded-xl border p-3", over ? "border-red-500/30 bg-red-500/[0.05]" : "border-border/60 bg-muted/20")}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1.5 font-medium text-foreground"><row.icon className="size-3.5 text-muted-foreground" /> {row.l}</span>
                <span className="flex items-center gap-1.5">
                  {over && <Badge tone="danger" className="gap-1 px-1.5 py-0"><AlertTriangle className="size-3" /> Melebihi</Badge>}
                  <span className={cn("font-semibold tabular-nums", over ? "text-red-500" : "text-foreground")}>{row.actualPct}%</span>
                </span>
              </div>
              <div className="mt-2"><Progress value={(row.actualPct / row.limit) * 100} tone={over ? "danger" : "cyan"} /></div>
              <p className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums"><span>{rp(row.a)} / {rp(row.t)}</span><span>batas {row.limit}%</span></p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
