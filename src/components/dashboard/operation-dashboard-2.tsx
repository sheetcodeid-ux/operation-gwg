"use client";

/**
 * Dashboard Operation 2 — financial/operational overview.
 *
 * Matches the user's Figma: a 3-rail layout (narrow · wide · narrow). On desktop
 * each rail SCROLLS INDEPENDENTLY inside the viewport, so cards stay compact and
 * side-by-side with no trailing empty space. Colors come from the app's real
 * chart palette (tone.ts): blue #3b82f6, green, amber, slate — NOT violet.
 * Data is deterministic PLACEHOLDER, marked `TODO(api)` for later ERP/DB wiring.
 */

import * as React from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Coins,
  Download,
  Eye,
  Layers,
  MoreHorizontal,
  PackageSearch,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ---------- palette = Dashboard 1 (tone.ts): blue / green / amber / slate ---------- */
const C = { blue: "#3b82f6", blueLt: "#93c5fd", green: "#22c55e", green2: "#16a34a", amber: "#f59e0b", slate: "#94a3b8", slate2: "#64748b", teal: "#14b8a6", sky: "#0ea5e9", gray: "#cbd5e1" };
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

const rand = (seed: number) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
const EXPENSE_CATS = [
  { key: "Utilitas", color: C.blue },
  { key: "Sewa", color: C.sky },
  { key: "Tenaga Kerja", color: C.teal },
  { key: "Potongan", color: C.green },
  { key: "Manajemen Fee", color: C.amber },
  { key: "Pemasaran", color: C.slate2 },
  { key: "Ongkos Kirim", color: C.slate },
  { key: "Lainnya", color: C.gray },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/* ==================================================================== */

export function OperationDashboard2() {
  const [period, setPeriod] = React.useState("bulan");
  const [cabang, setCabang] = React.useState("all");
  const [ca, setCa] = React.useState("all");

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">Periode</span>
          <PillSelect value={period} onChange={setPeriod} options={[{ v: "hari", l: "Per Hari" }, { v: "minggu", l: "Per Minggu" }, { v: "bulan", l: "Per Bulan 2026.03" }]} bare />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PillSelect value={ca} onChange={setCa} options={[{ v: "all", l: "Semua CA" }, { v: "owner", l: "Owner" }, { v: "spv", l: "SPV" }]} />
          <PillSelect value={cabang} onChange={setCabang} options={[{ v: "all", l: "Semua Cabang" }, { v: "ccay", l: "Cattu A. Yani" }]} />
          <Button size="sm" className="gap-1.5"><Eye className="size-3.5" /> Petinjau</Button>
          <Button size="sm" variant="outline" className="gap-1.5"><Download className="size-3.5" /> Download</Button>
        </div>
      </div>

      {/* 3-rail layout. On lg+ each rail scrolls inside the viewport (no empty space);
          on mobile everything stacks and the page scrolls normally. */}
      <div className="lg:h-[calc(100vh-11.5rem)] lg:overflow-hidden">
        <div className="grid gap-4 lg:h-full lg:grid-cols-12">
          <Rail>
            <TargetGauge />
            <ProgressCard title="Proyeksi Bulanan" pct={50} actual={300_000_000} target={600_000_000} />
            <ProgressCard title="Target Harian" pct={50} actual={10_000_000} target={20_000_000} />
            <WeeklyTarget />
            <ProdukCard />
          </Rail>

          <Rail wide>
            <KpiCluster />
            <PenjualanChart />
            <BebanChart />
            <PerformaCabang />
          </Rail>

          <Rail>
            <DistribusiMargin />
            <KontrolCard />
            <RencanaPengeluaran />
            <AktivitasTerkini />
          </Rail>
        </div>
      </div>
    </div>
  );
}

function Rail({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]", wide ? "lg:col-span-6" : "lg:col-span-3")}>
      {children}
    </div>
  );
}

/* ---------- shared bits ---------- */
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
/** Compact glass card (Aniq). */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("p-4", className)}>{children}</Card>;
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

/* ---------- MIDDLE: KPIs ---------- */
function KpiTile({ icon: Icon, label, value, delta, positiveIsGood }: { icon: LucideIcon; label: string; value: string; delta: number; positiveIsGood?: boolean }) {
  return (
    <div className="card-gradient flex flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border"><Icon className="size-5 text-muted-foreground" /></div>
        <GripDots />
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
function KpiCluster() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiTile icon={Coins} label="Net Sales" value={rp(100_000_000)} delta={2.45} />
      <KpiTile icon={ShoppingCart} label="Pembelian" value={rp(100_000_000)} delta={2.45} />
      <KpiTile icon={Wallet} label="Beban Operasional" value={rp(100_000_000)} delta={-2.45} positiveIsGood={false} />
      <KpiTile icon={TrendingUp} label="Laba Bersih" value={rp(100_000_000)} delta={2.45} />
    </div>
  );
}

/* ---------- LEFT ---------- */
function TargetGauge() {
  const pct = 95.38, R = 52, circ = Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <Panel>
      <Head title="Target Per Bulan" desc="Realisasi vs target bulan ini" />
      <div className="relative mx-auto grid h-24 w-52 place-items-end">
        <svg viewBox="0 0 140 78" className="w-full">
          <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="var(--muted)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke={C.blue} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-[10px] text-muted-foreground">Total Target</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{pct}%</p>
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
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">{title}</h3><span className="text-sm font-semibold text-foreground">{pct}%</span></div>
      <p className="mt-2 text-[12px] font-semibold tabular-nums text-foreground">{rp(actual)} <span className="text-muted-foreground">/ {rp(target)}</span></p>
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
    { w: "Minggu I", a: 105_000_000, t: 210_000_000, p: 15 },
    { w: "Minggu II", a: 15_000_000, t: 30_000_000, p: 2.5 },
    { w: "Minggu III", a: 120_000_000, t: 240_000_000, p: 17.5 },
    { w: "Minggu IV", a: 120_000_000, t: 240_000_000, p: 17.5 },
    { w: "Minggu V", a: 120_000_000, t: 240_000_000, p: 17.5 },
  ];
  return (
    <Panel>
      <Head title="Target Mingguan" desc="Total Pengeluaran Rp120.000.000" />
      <div className="space-y-2.5">
        {weeks.map((w) => (
          <div key={w.w}>
            <div className="flex items-center justify-between text-[12px]"><span className="font-medium text-foreground">{w.w}</span><span className="text-muted-foreground tabular-nums">{w.p}%</span></div>
            <div className="mt-1"><Progress value={w.p * 4} tone="cyan" /></div>
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
  const rows = Array.from({ length: 14 }, (_, i) => ({ rank: i + 1, name: `Kategori ${String.fromCharCode(65 + (i % 6))}`, val: [21_000_000, 5_200_000, 420_000][i % 3] || 420_000 }));
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel>
      <Head title="Produk" right={<PillSelect value="kategori" onChange={() => {}} options={[{ v: "kategori", l: "Kategori" }]} />} />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "jumlah", label: "Jumlah" }, { value: "total", label: "Total" }]} />
      <div className="relative mt-2">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari Kategori" className="w-full rounded-lg border border-border bg-transparent py-1.5 pl-8 pr-2 text-[12px] outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {filtered.map((r) => (
          <div key={r.rank} className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{r.rank}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{r.name}</span>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{rp(r.val)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- MIDDLE: charts ---------- */
function PenjualanChart() {
  const [mode, setMode] = React.useState("harian");
  const r = rand(7);
  const data = Array.from({ length: 24 }, (_, h) => ({ h: String(h).padStart(2, "0"), hari: Math.round(2000 + r() * 6000), kemarin: -Math.round(1500 + r() * 5000) }));
  return (
    <Panel>
      <Head title="Penjualan" desc="Per jam · hari ini vs kemarin" right={<PillSelect value={mode} onChange={setMode} options={[{ v: "harian", l: "Harian" }, { v: "mingguan", l: "Mingguan" }]} />} />
      <div className="mb-1 flex items-center gap-2"><p className="text-lg font-bold tabular-nums text-foreground">{rp(100_000_000)}</p><Delta v={1.78} /></div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="sign" margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="h" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}K`} />
            <Tooltip contentStyle={tip} formatter={(v, n) => [rp(Math.abs(Number(v))), n === "hari" ? "Hari ini" : "Kemarin"]} />
            <Bar dataKey="hari" name="Hari ini" fill={C.blue} radius={[3, 3, 0, 0]} stackId="s" />
            <Bar dataKey="kemarin" name="Kemarin" fill={C.blueLt} radius={[0, 0, 3, 3]} stackId="s" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-end gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blue }} /> Hari ini</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blueLt }} /> Kemarin</span>
      </div>
    </Panel>
  );
}
function BebanChart() {
  const [mode, setMode] = React.useState("persentase");
  const r = rand(11);
  const data = MONTHS.map((m) => { const row: Record<string, number | string> = { m }; for (const c of EXPENSE_CATS) row[c.key] = Math.round(4 + r() * 8); return row; });
  return (
    <Panel>
      <Head title="Beban Operasional" desc="Rincian beban per kategori · 12 bulan" right={<PillSelect value={mode} onChange={setMode} options={[{ v: "persentase", l: "Persentase" }, { v: "nominal", l: "Nominal" }]} />} />
      <div className="mb-1 flex items-center gap-2"><p className="text-lg font-bold tabular-nums text-foreground">{rp(100_000_000)}</p><Delta v={1.78} /></div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
        {EXPENSE_CATS.map((c) => <span key={c.key} className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-2 rounded-full" style={{ background: c.color }} /> {c.key}</span>)}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={tip} />
            {EXPENSE_CATS.map((c, i) => <Bar key={c.key} dataKey={c.key} stackId="e" fill={c.color} radius={i === EXPENSE_CATS.length - 1 ? [3, 3, 0, 0] : undefined} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
function PerformaCabang() {
  const [page, setPage] = React.useState(1);
  const per = 8, total = 512;
  const r = rand(3 + page);
  const rows = Array.from({ length: per }, (_, i) => { const pct = +(r() * 6 - 3).toFixed(2); return { no: (page - 1) * per + i + 1, name: "Cabang A", a: 100_000_000, b: 100_000_000, pct }; });
  const pages = Math.ceil(total / per);
  const from = (page - 1) * per + 1, to = Math.min(total, page * per);
  const nums = [1, 2, 3].filter((n) => n <= pages);
  return (
    <Panel>
      <Head title="Performa Cabang" desc="Perbandingan net sales antar cabang" right={
        <div className="flex items-center gap-2">
          <PillSelect value="netsales" onChange={() => {}} options={[{ v: "netsales", l: "Net Sales" }, { v: "beban", l: "Beban" }]} />
          <Button size="icon-sm" variant="outline"><SlidersHorizontal className="size-3.5" /></Button>
        </div>
      } />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-2 font-medium">#</th><th className="px-2 py-2 font-medium">Nama Cabang</th><th className="px-2 py-2 font-medium">Mei 2026</th><th className="px-2 py-2 font-medium">Jun 2026</th><th className="px-2 py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.no} className="border-t border-border/60 hover:bg-muted/30">
                <td className="px-2 py-2 tabular-nums text-muted-foreground">{row.no}</td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border">{row.name.slice(0, 2).toUpperCase()}</span>
                    <span className="font-medium text-foreground">{row.name}</span>
                  </span>
                </td>
                <td className="px-2 py-2 tabular-nums text-muted-foreground">{rp(row.a)}</td>
                <td className="px-2 py-2 tabular-nums text-muted-foreground">{rp(row.b)}</td>
                <td className="px-2 py-2 text-right"><Delta v={row.pct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Menampilkan {from}–{to} dari {total}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border px-2 py-1 hover:bg-muted disabled:opacity-40">Sebelumnya</button>
          {nums.map((n) => <button key={n} onClick={() => setPage(n)} className={cn("size-7 rounded-lg border text-center tabular-nums", n === page ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{n}</button>)}
          {pages > 3 && <span className="px-1">…</span>}
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-lg border border-border px-2 py-1 hover:bg-muted disabled:opacity-40">Berikutnya</button>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- RIGHT ---------- */
function DistribusiMargin() {
  const [tab, setTab] = React.useState("Semua");
  const data = [
    { name: "Sehat", value: 30, fill: C.green },
    { name: "Cukup", value: 15, fill: C.amber },
    { name: "Kritis", value: 5, fill: C.slate },
  ];
  return (
    <Panel>
      <Head title="Distribusi Margin" desc="Sebaran kesehatan margin cabang" />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={["Semua", "Kalimantan", "Jawa", "Bali"].map((t) => ({ value: t, label: t }))} />
      <div className="mx-auto my-3 h-36 w-36">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="35%" outerRadius="100%" startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" background={{ fill: "var(--muted)" }} cornerRadius={8} />
            <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${Number(v)} cabang`, p?.payload?.name]} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {[{ l: ">30%", n: "Sehat", c: C.green, v: 30 }, { l: "<29%", n: "Cukup", c: C.amber, v: 15 }, { l: "<15%", n: "Kritis", c: C.slate, v: 5 }].map((x) => (
          <div key={x.n} className="flex items-center gap-2 text-[12px]">
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: x.c }}>{x.l}</span>
            <span className="text-muted-foreground">{x.n}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{x.v} Cabang</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function KontrolCard() {
  const [tab, setTab] = React.useState("Fraud");
  const rows = [
    { n: "Promosi", v: 21_000_000 },
    { n: "Kompliment", v: 5_200_000 },
    { n: "Refund", v: 420_000 },
    { n: "Void", v: 420_000 },
    { n: "Cancel", v: 210_000 },
  ];
  return (
    <Panel>
      <Head title="Kontrol" desc="Pemantauan potensi kebocoran" />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={["Fraud", "Complain", "Kebersihan", "Event"].map((t) => ({ value: t, label: t }))} />
      <div className="mt-3 space-y-2">
        {rows.map((row, i) => (
          <div key={row.n} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{row.n}</span>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{rp(row.v)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function RencanaPengeluaran() {
  const rows = [
    { l: "Warehouse", a: 105_000_000, t: 210_000_000, p: 15, icon: Boxes },
    { l: "Non Warehouse", a: 15_000_000, t: 30_000_000, p: 2.5, icon: PackageSearch },
    { l: "Rasio %", a: 120_000_000, t: 240_000_000, p: 17.5, icon: Layers },
  ];
  return (
    <Panel>
      <Head title="Rencana Pengeluaran" desc="Total Pengeluaran Rp120.000.000" />
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.l}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 font-medium text-foreground"><row.icon className="size-3.5 text-muted-foreground" /> {row.l}</span>
              <span className="text-muted-foreground tabular-nums">{row.p}%</span>
            </div>
            <div className="mt-1"><Progress value={row.p * 4} tone="cyan" /></div>
            <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{rp(row.a)} / {rp(row.t)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
type ActivityRow = { who: string; t: string; a: string };
function ActivityGroup({ label, rows }: { label: string; rows: ActivityRow[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/12 text-[11px] font-semibold text-blue-600 dark:text-blue-400">{r.who[0]}</span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{r.who}</span> · {r.t}</p>
              <p className="text-[12px] leading-snug text-foreground">{r.a}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function AktivitasTerkini() {
  const [tab, setTab] = React.useState("divisi");
  const today: ActivityRow[] = [
    { who: "Andi", t: "11:45 AM", a: "Review performa operasional 32 outlet selesai" },
    { who: "Fikri", t: "09:22 AM", a: "Sinkronisasi data penjualan seluruh outlet berhasil" },
    { who: "Jayadi", t: "07:15 AM", a: "Menindaklanjuti temuan audit Outlet Bengkayang" },
  ];
  const yest: ActivityRow[] = [
    { who: "Deo", t: "05:50 PM", a: "Approval permintaan stok Outlet Air Upas disetujui" },
    { who: "Poetri", t: "03:30 PM", a: "Jadwal kunjungan Outlet Tanjung Duren diperbarui" },
  ];
  return (
    <Panel>
      <Head title="Aktivitas Terkini" desc="Dari Work & Event Tracker" right={<MoreHorizontal className="size-4 text-muted-foreground" />} />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "outlet", label: "Outlet" }, { value: "divisi", label: "Divisi" }]} />
      <div className="mt-3 space-y-4">
        <ActivityGroup label="Hari ini" rows={today} />
        <ActivityGroup label="Kemarin" rows={yest} />
      </div>
    </Panel>
  );
}
