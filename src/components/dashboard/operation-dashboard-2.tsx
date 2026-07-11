"use client";

/**
 * Dashboard Operation 2 — financial/operational overview.
 *
 * Built to mirror Dashboard 1's layout system: the app's `Card` primitives +
 * `KpiCarousel`, and BALANCED rows (`grid lg:grid-cols-3 items-stretch`, cards
 * `flex h-full flex-col`) so paired cards always match height — no empty gaps.
 * Data is deterministic PLACEHOLDER, marked `TODO(api)` for later ERP/DB wiring.
 */

import * as React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Download,
  Eye,
  Layers,
  MoreHorizontal,
  PackageSearch,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { KpiCarousel, type Kpi } from "@/components/dashboard/kpi-card";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ---------- theme palette (violet brand, matches app) ---------- */
const C = { brand: "#8b5cf6", brand2: "#a78bfa", brand3: "#c4b5fd", emerald: "#22c55e", amber: "#f59e0b", cyan: "#06b6d4", slate: "#94a3b8" };
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

const rand = (seed: number) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
const EXPENSE_CATS = [
  { key: "Utilitas", color: C.brand },
  { key: "Sewa", color: C.brand2 },
  { key: "Tenaga Kerja", color: C.cyan },
  { key: "Potongan", color: C.brand3 },
  { key: "Manajemen Fee", color: C.amber },
  { key: "Pemasaran", color: C.emerald },
  { key: "Ongkos Kirim", color: C.slate },
  { key: "Lainnya", color: "#cbd5e1" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const KPIS: Kpi[] = [
  { label: "Net Sales", value: rp(100_000_000), icon: "Coins", tone: "brand", delta: { value: 2.45 }, sub: "vs kemarin" },
  { label: "Pembelian", value: rp(100_000_000), icon: "ShoppingCart", tone: "cyan", delta: { value: 2.45 }, sub: "vs kemarin" },
  { label: "Beban Operasional", value: rp(100_000_000), icon: "Wallet", tone: "amber", delta: { value: -2.45, positiveIsGood: false }, sub: "vs kemarin" },
  { label: "Laba Bersih", value: rp(100_000_000), icon: "TrendingUp", tone: "success", delta: { value: 2.45 }, sub: "vs kemarin" },
];

/* ==================================================================== */

export function OperationDashboard2() {
  const [period, setPeriod] = React.useState("bulan");
  const [cabang, setCabang] = React.useState("all");
  const [ca, setCa] = React.useState("all");

  return (
    <div className="w-full space-y-4">
      {/* Controls — mirrors Dashboard 1's filter row */}
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

      {/* Row 1 — KPI carousel (identical component to Dashboard 1) */}
      <KpiCarousel items={KPIS} />

      {/* Row 2 — Penjualan (2/3) + Distribusi Margin (1/3) */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <PenjualanChart className="lg:col-span-2" />
        <DistribusiMargin />
      </div>

      {/* Row 3 — Beban Operasional (2/3) + Kontrol (1/3) */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <BebanChart className="lg:col-span-2" />
        <KontrolCard />
      </div>

      {/* Row 4 — Performa Cabang (2/3) + Aktivitas Terkini (1/3) */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <PerformaCabang className="lg:col-span-2" />
        <AktivitasTerkini />
      </div>

      {/* Row 5 — Target Per Bulan + Target Mingguan + Produk */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <TargetGauge />
        <WeeklyTarget />
        <ProdukCard />
      </div>

      {/* Row 6 — Proyeksi + Target Harian + Rencana Pengeluaran */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <ProgressCard title="Proyeksi Bulanan" pct={50} actual={300_000_000} target={600_000_000} />
        <ProgressCard title="Target Harian" pct={50} actual={10_000_000} target={20_000_000} />
        <RencanaPengeluaran />
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */
function PillSelect({ value, onChange, options, bare }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; bare?: boolean }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("cursor-pointer appearance-none rounded-lg pr-7 text-xs font-medium text-foreground outline-none", bare ? "bg-transparent" : "border border-border bg-card py-2 pl-3")}
      >
        {options.map((o) => <option key={o.v} value={o.v} className="bg-popover text-foreground">{o.l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </div>
  );
}
/** Card panel matching Dashboard 1 (glass card, p-5, stretches to row height). */
function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("flex h-full flex-col p-5", className)}>{children}</Card>;
}
function Head({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
function Delta({ v, positiveIsGood = true }: { v: number; positiveIsGood?: boolean }) {
  const zero = v === 0;
  const good = v >= 0 === positiveIsGood;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", zero ? "bg-muted text-muted-foreground" : good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")}>
      {zero ? <ArrowRight className="size-3" /> : v >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(v)}%
    </span>
  );
}

/* ---------- widgets ---------- */
function TargetGauge() {
  const pct = 95.38, R = 52, circ = Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <Panel>
      <Head title="Target Per Bulan" desc="Realisasi vs target bulan ini" />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative grid h-28 w-56 place-items-end">
          <svg viewBox="0 0 140 78" className="w-full">
            <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="var(--muted)" strokeWidth="12" strokeLinecap="round" />
            <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke={C.brand} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
          </svg>
          <div className="absolute inset-x-0 bottom-1 text-center">
            <p className="text-[10px] text-muted-foreground">Total Target</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{pct}%</p>
            <p className="text-[10px] font-medium text-red-500">-5% vs bulan lalu</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[13px] font-semibold tabular-nums text-foreground">Rp12.400.000.000 <span className="text-muted-foreground">/ 13.000.000.000</span></p>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Realisasi</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/25" /> Target</span>
      </div>
    </Panel>
  );
}
function ProgressCard({ title, pct, actual, target }: { title: string; pct: number; actual: number; target: number }) {
  return (
    <Panel>
      <Head title={title} right={<span className="text-sm font-semibold text-foreground">{pct}%</span>} />
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-[13px] font-semibold tabular-nums text-foreground">{rp(actual)} <span className="text-muted-foreground">/ {rp(target)}</span></p>
        <div className="mt-2"><Progress value={pct} tone="brand" /></div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/25" /> Target</span>
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
      <div className="flex flex-1 flex-col justify-between gap-2.5">
        {weeks.map((w) => (
          <div key={w.w}>
            <div className="flex items-center justify-between text-[12px]"><span className="font-medium text-foreground">{w.w}</span><span className="text-muted-foreground tabular-nums">{w.p}%</span></div>
            <div className="mt-1"><Progress value={w.p * 4} tone="brand" /></div>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground tabular-nums">{rp(w.a)} / {rp(w.t)}</p>
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
      <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]" style={{ maxHeight: 240 }}>
        {filtered.map((r) => (
          <div key={r.rank} className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary/12 text-[10px] font-semibold text-primary">{r.rank}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{r.name}</span>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{rp(r.val)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function PenjualanChart({ className }: { className?: string }) {
  const [mode, setMode] = React.useState("harian");
  const r = rand(7);
  const data = Array.from({ length: 24 }, (_, h) => ({ h: String(h).padStart(2, "0"), hari: Math.round(2000 + r() * 6000), kemarin: -Math.round(1500 + r() * 5000) }));
  return (
    <Panel className={className}>
      <Head title="Penjualan" desc="Penjualan per jam · hari ini vs kemarin" right={<PillSelect value={mode} onChange={setMode} options={[{ v: "harian", l: "Harian" }, { v: "mingguan", l: "Mingguan" }]} />} />
      <div className="mb-1 flex items-center gap-2"><p className="text-lg font-bold tabular-nums text-foreground">{rp(100_000_000)}</p><Delta v={1.78} /></div>
      <div className="min-h-[13rem] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} stackOffset="sign" margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="h" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} interval={1} />
            <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}K`} />
            <Tooltip contentStyle={tip} formatter={(v, n) => [rp(Math.abs(Number(v))), n === "hari" ? "Hari ini" : "Kemarin"]} />
            <Bar dataKey="hari" name="Hari ini" fill={C.brand} radius={[3, 3, 0, 0]} stackId="s" />
            <Bar dataKey="kemarin" name="Kemarin" fill={C.brand3} radius={[0, 0, 3, 3]} stackId="s" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-end gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Hari ini</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/40" /> Kemarin</span>
      </div>
    </Panel>
  );
}
function BebanChart({ className }: { className?: string }) {
  const [mode, setMode] = React.useState("persentase");
  const r = rand(11);
  const data = MONTHS.map((m) => { const row: Record<string, number | string> = { m }; for (const c of EXPENSE_CATS) row[c.key] = Math.round(4 + r() * 8); return row; });
  return (
    <Panel className={className}>
      <Head title="Beban Operasional" desc="Rincian beban per kategori · 12 bulan" right={<PillSelect value={mode} onChange={setMode} options={[{ v: "persentase", l: "Persentase" }, { v: "nominal", l: "Nominal" }]} />} />
      <div className="mb-1 flex items-center gap-2"><p className="text-lg font-bold tabular-nums text-foreground">{rp(100_000_000)}</p><Delta v={1.78} /></div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
        {EXPENSE_CATS.map((c) => <span key={c.key} className="flex items-center gap-1 text-[10.5px] text-muted-foreground"><span className="size-2 rounded-full" style={{ background: c.color }} /> {c.key}</span>)}
      </div>
      <div className="min-h-[13rem] flex-1">
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
function PerformaCabang({ className }: { className?: string }) {
  const [page, setPage] = React.useState(1);
  const per = 8, total = 512;
  const r = rand(3 + page);
  const rows = Array.from({ length: per }, (_, i) => { const pct = +(r() * 6 - 3).toFixed(2); return { no: (page - 1) * per + i + 1, name: "Cabang A", a: 100_000_000, b: 100_000_000, pct }; });
  const pages = Math.ceil(total / per);
  const from = (page - 1) * per + 1, to = Math.min(total, page * per);
  const nums = [1, 2, 3].filter((n) => n <= pages);
  return (
    <Panel className={className}>
      <Head title="Performa Cabang" desc="Perbandingan net sales antar cabang" right={
        <div className="flex items-center gap-2">
          <PillSelect value="netsales" onChange={() => {}} options={[{ v: "netsales", l: "Net Sales" }, { v: "beban", l: "Beban" }]} />
          <Button size="icon-sm" variant="outline"><SlidersHorizontal className="size-3.5" /></Button>
        </div>
      } />
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-2 font-medium">#</th><th className="px-2 py-2 font-medium">Nama Cabang</th><th className="px-2 py-2 font-medium">Mei 2026</th><th className="px-2 py-2 font-medium">Jun 2026</th><th className="px-2 py-2 text-right font-medium">Persentase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.no} className="border-t border-border/60 hover:bg-muted/30">
                <td className="px-2 py-2.5 tabular-nums text-muted-foreground">{row.no}</td>
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border">{row.name.slice(0, 2).toUpperCase()}</span>
                    <span className="font-medium text-foreground">{row.name}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 tabular-nums text-muted-foreground">{rp(row.a)}</td>
                <td className="px-2 py-2.5 tabular-nums text-muted-foreground">{rp(row.b)}</td>
                <td className="px-2 py-2.5 text-right"><Delta v={row.pct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span>Menampilkan {from}–{to} dari {total}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40">Sebelumnya</button>
          {nums.map((n) => (
            <button key={n} onClick={() => setPage(n)} className={cn("size-8 rounded-lg border text-center tabular-nums", n === page ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{n}</button>
          ))}
          {pages > 3 && <span className="px-1">…</span>}
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded-lg border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-40">Berikutnya</button>
        </div>
      </div>
    </Panel>
  );
}
function DistribusiMargin() {
  const [tab, setTab] = React.useState("Semua");
  const data = [
    { name: "Sehat", value: 30, fill: C.emerald },
    { name: "Cukup", value: 15, fill: C.amber },
    { name: "Kritis", value: 5, fill: C.slate },
  ];
  return (
    <Panel>
      <Head title="Distribusi Margin" desc="Sebaran kesehatan margin cabang" />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={["Semua", "Kalimantan", "Jawa", "Bali"].map((t) => ({ value: t, label: t }))} />
      <div className="mx-auto my-3 h-40 w-40 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="35%" outerRadius="100%" startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" background={{ fill: "var(--muted)" }} cornerRadius={8} />
            <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${Number(v)} cabang`, p?.payload?.name]} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5">
        {[{ l: ">30%", n: "Sehat", c: C.emerald, v: 30 }, { l: "<29%", n: "Cukup", c: C.amber, v: 15 }, { l: "<15%", n: "Kritis", c: C.slate, v: 5 }].map((x) => (
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
      <div className="mt-3 flex-1 space-y-2">
        {rows.map((row, i) => (
          <div key={row.n} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary/12 text-[10px] font-semibold text-primary">{i + 1}</span>
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
      <div className="flex flex-1 flex-col justify-between gap-3">
        {rows.map((row) => (
          <div key={row.l}>
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 font-medium text-foreground"><row.icon className="size-3.5 text-muted-foreground" /> {row.l}</span>
              <span className="text-muted-foreground tabular-nums">{row.p}%</span>
            </div>
            <div className="mt-1"><Progress value={row.p * 4} tone="brand" /></div>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground tabular-nums">{rp(row.a)} / {rp(row.t)}</p>
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
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">{r.who[0]}</span>
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
      <div className="mt-3 flex-1 space-y-4">
        <ActivityGroup label="Hari ini" rows={today} />
        <ActivityGroup label="Kemarin" rows={yest} />
      </div>
    </Panel>
  );
}
