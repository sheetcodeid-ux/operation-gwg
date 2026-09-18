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
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { OpsActivityFeed, OpsBranchPerf, OpsControl, OpsDashboardData, OpsFinance, OpsFraud, OpsHourly, OpsProduct, OpsTarget } from "@/lib/data/ops-dashboard";
import { cn } from "@/lib/utils";

/* ---------- palette (tone.ts) ---------- */
const C = { blue: "#3b82f6", blueLt: "#93c5fd", green: "#22c55e", amber: "#f59e0b", red: "#ef4444", slate: "#94a3b8", slate2: "#64748b" };
/** 8 shades of blue (dark → light) for the stacked Beban chart gradient. */
const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
/** Rupiah, atau pernyataan jujur bahwa angkanya belum ada. */
const rpAtau = (n: number | null) => (n === null ? TAK_ADA : rp(n));
/** Satu kata yang dipakai seluruh halaman ini untuk ketiadaan angka. */
const TAK_ADA = "Belum ada data";


/* ==================================================================== */

export function OperationDashboard2({ initial }: { initial: OpsDashboardData }) {
  // ┌─ PENGALIH PERIODE DIHILANGKAN, BUKAN DIPERBAIKI LABELNYA ───────────────┐
  // │                                                                        │
  // │ Labelnya di-hardcode "Per Bulan 2026.03" sementara halaman ini selalu   │
  // │ memuat bulan berjalan lewat `ym(new Date())`. Dan `period` tidak pernah │
  // │ dipakai menyaring apa pun — mengubah pilihannya tidak mengubah satu     │
  // │ angka pun.                                                             │
  // │                                                                        │
  // │ Memperbaiki labelnya saja akan meninggalkan kontrol yang terlihat       │
  // │ bekerja padahal tidak, dan itu bentuk lain dari hal yang sama: layar    │
  // │ menjanjikan sesuatu yang tidak terjadi. Filternya belum ada, jadi       │
  // │ kontrolnya juga tidak.                                                 │
  // └────────────────────────────────────────────────────────────────────────┘
  const [cabang, setCabang] = React.useState("all");
  const [ca, setCa] = React.useState("all");

  const kpi = initial.kpi;
  const fin = initial.finance;
  const t = initial.target;
  // Delta hanya ada bila KEDUA harinya terukur dan pembandingnya sah. Tanpa
  // pembanding hasilnya null, bukan 0% — "tidak ada pembanding" dan "tidak ada
  // perubahan" dua hal yang berbeda.
  const nsDelta =
    kpi && kpi.netSales !== null && kpi.netSalesPrev !== null && kpi.netSalesPrev > 0
      ? +(((kpi.netSales - kpi.netSalesPrev) / kpi.netSalesPrev) * 100).toFixed(1)
      : null;
  // Laba Bersih = Net Sales − Pembelian − Beban Operasional (needs both ERP Net Sales & Finance input).
  const laba = kpi && kpi.netSales !== null && fin ? kpi.netSales - fin.purchaseTotal - fin.expenses : null;
  const cabangOptions = [{ v: "all", l: "Semua Cabang" }, ...initial.branches.map((b) => ({ v: b.code, l: b.name }))];

  return (
    <div className="w-full space-y-4">
      {/* Global filter row */}
      <div className="flex flex-wrap items-center gap-2">
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
          <TargetGauge target={t} />
          <ProgressCard
            title="Proyeksi Bulanan"
            live={!!t}
            pct={t && t.targetMonth > 0 ? Math.round((t.proyeksiBulanan / t.targetMonth) * 100) : null}
            actual={t ? t.proyeksiBulanan : null}
            target={t ? t.targetMonth : null}
            sebab="Proyeksi diturunkan dari target bulanan, yang butuh riwayat omzet tiga bulan penuh."
          />
          <ProgressCard
            title="Target Harian"
            live={!!t && t.todayActual !== null}
            pct={t && t.todayActual !== null && t.targetHarian > 0 ? Math.round((t.todayActual / t.targetHarian) * 100) : null}
            actual={t ? t.todayActual : null}
            target={t ? t.targetHarian : null}
            sebab="Penjualan hari ini belum ditarik dari ESB, atau target bulanan belum bisa dihitung."
          />
          <ProdukCard products={initial.products} />
        </div>

        {/* MIDDLE rail — KPI 2×2, charts, table */}
        <div className="min-w-0 space-y-4 lg:col-span-6">
          <div className="grid grid-cols-2 gap-4">
            <KpiTile icon={Coins} label="Net Sales" value={kpi && kpi.netSales !== null ? rp(kpi.netSales) : null} delta={nsDelta} live={!!kpi && kpi.netSales !== null} />
            <KpiTile icon={ShoppingCart} label="Pembelian" value={fin ? rp(fin.purchaseTotal) : null} delta={null} live={!!fin} />
            <KpiTile icon={Wallet} label="Beban Operasional" value={fin ? rp(fin.expenses) : null} delta={null} positiveIsGood={false} live={!!fin} />
            <KpiTile icon={TrendingUp} label="Laba Bersih" value={laba != null ? rp(laba) : null} delta={null} live={laba != null} />
          </div>
          <PenjualanChart hourly={initial.hourly} />
          <PerformaCabang data={initial.branchPerf} />
        </div>

        {/* RIGHT rail — distribusi, kontrol, rencana, aktivitas */}
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <KontrolCard fraud={initial.fraud} control={initial.control} />
          <RencanaPengeluaran fin={fin} netSales={kpi?.netSales ?? null} limits={initial.settings.purchaseLimits} />
          <AktivitasTerkini activity={initial.activity} />
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

/**
 * Satu kalimat jujur, dipakai seluruh panel yang angkanya belum ada.
 *
 * Bukan "—", bukan "0", bukan sel kosong: ketiganya menyuruh pembacanya
 * menebak, dan tebakan yang paling sering diambil adalah nol. `sebab` mengisi
 * bagian yang paling berguna — apa yang harus dikerjakan supaya angkanya ada.
 */
function BelumAdaData({ sebab, className }: { sebab?: string; className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-xl border border-dashed border-border px-3 py-6 text-center", className)}>
      <p className="text-[12px] font-medium text-muted-foreground">{TAK_ADA}</p>
      {sebab && <p className="mt-1 max-w-[22rem] text-[10.5px] leading-relaxed text-muted-foreground/80">{sebab}</p>}
    </div>
  );
}

/* ---------- KPI ---------- */
/**
 * Satu kartu KPI. `value` null berarti angkanya belum ada.
 *
 * `delta` sengaja WAJIB null ketika `value` null. Sebelum Gate R keempat kartu
 * ini jatuh ke Rp 100.000.000 dengan delta +2,45% — dan delta itu bukan sekadar
 * angka contoh, ia klaim tentang perubahan yang tidak pernah dihitung.
 */
function KpiTile({ icon: Icon, label, value, delta, positiveIsGood, live }: { icon: LucideIcon; label: string; value: string | null; delta: number | null; positiveIsGood?: boolean; live?: boolean }) {
  return (
    <div className="card-gradient flex flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border"><Icon className="size-5 text-muted-foreground" /></div>
        {live ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"><span className="size-1 rounded-full bg-emerald-500" />live</span> : <GripDots />}
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{label}</p>
          {value === null ? (
            <p className="truncate text-[13px] font-medium italic text-muted-foreground">{TAK_ADA}</p>
          ) : (
            <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
          )}
          {delta !== null && <p className="text-[10px] text-muted-foreground">vs kemarin</p>}
        </div>
        {delta !== null && <Delta v={delta} positiveIsGood={positiveIsGood} />}
      </div>
    </div>
  );
}

/* ---------- Penjualan (3-line chart) ---------- */
function PenjualanChart({ className, hourly }: { className?: string; hourly: OpsHourly[] | null }) {
  const [mode, setMode] = React.useState("harian");
  // ┌─ DUA MODE YANG BELUM TERSAMBUNG TIDAK LAGI MENGARANG ───────────────────┐
  // │                                                                        │
  // │ Sebelum Gate R, mode Mingguan dan Bulanan SELALU memakai PRNG —         │
  // │ walaupun data ESB lengkap — dan `rand()` berseed tetap, jadi angkanya   │
  // │ identik tiap pemuatan. Kestabilan itu justru yang membuatnya terbaca    │
  // │ sebagai data sungguhan.                                                │
  // │                                                                        │
  // │ Modenya DIPERTAHANKAN dengan keadaan kosong, bukan dihapus: yang        │
  // │ kurang sumbernya, bukan kebutuhannya.                                  │
  // └────────────────────────────────────────────────────────────────────────┘
  const useReal = mode === "harian" && hourly && hourly.length > 0;
  const target = useReal ? Math.round(hourly!.reduce((a, p) => Math.max(a, p.hari), 0) * 0.9) : 0;
  const data = useReal ? hourly!.map((p) => ({ x: p.x, hari: p.hari, kemarin: p.kemarin, target })) : [];
  const total = useReal ? hourly!.reduce((a, p) => a + p.hari, 0) : null;
  const sebab =
    mode === "harian"
      ? "Tren harian butuh penarikan penjualan ESB. Belum ada, atau penarikannya gagal."
      : `Mode ${mode === "mingguan" ? "Mingguan" : "Bulanan"} belum tersambung ke sumber penjualan mana pun.`;
  return (
    <Panel className={className}>
      <Head title="Penjualan" desc={useReal ? "Data ERP · hari ini vs kemarin vs target" : "Hari ini vs kemarin vs target"} right={<PillSelect value={mode} onChange={setMode} options={[{ v: "harian", l: "Harian" }, { v: "mingguan", l: "Mingguan" }, { v: "bulanan", l: "Bulanan" }]} />} />
      {total !== null && (
        <div className="mb-2 flex items-center gap-2"><p className="text-xl font-bold tabular-nums text-foreground">{rp(total)}</p><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span></div>
      )}
      {!useReal && <BelumAdaData className="flex-1" sebab={sebab} />}
      <div className={cn("min-h-[15rem] flex-1", !useReal && "hidden")}>
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

/* ---------- Performa Cabang (executive table, Juknis 2.8) ---------- */
type SortDir = "asc" | "desc";
function PerformaCabang({ className, data }: { className?: string; data: OpsBranchPerf[] }) {
  const [tab, setTab] = React.useState("beli"); // beli (real) | beban (real) | net (butuh omzet/cabang)
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [dir, setDir] = React.useState<SortDir>("desc");
  const per = 8;

  // Non-null, bukan truthy: outlet yang melapor Rp 0 tetap terhitung punya data.
  const hasFinance = data.some(
    (d) => d.pembelianCur !== null || d.bebanCur !== null || d.pembelianPrev !== null || d.bebanPrev !== null,
  );

  const all = React.useMemo(() => {
    // Tab Net Sales belum punya sumber per cabang. Sebelum Gate R ia memakai
    // PRNG 40 cabang palsu — satu-satunya panel yang setidaknya melabelinya
    // "Data contoh". Sekarang labelnya tetap, angkanya tidak.
    if (tab === "net" || !hasFinance) return [];
    return data.map((d, i) => {
      const cur = tab === "beli" ? d.pembelianCur : d.bebanCur;
      const prev = tab === "beli" ? d.pembelianPrev : d.bebanPrev;
      // Tanpa pembanding hasilnya TIDAK DIKETAHUI, bukan 0%. Dulu null berarti
      // "stabil", dan outlet yang belum pernah melapor mengendap di tengah
      // pengurutan seolah tidak bergerak.
      const growth = cur !== null && prev !== null && prev > 0 ? +(((cur - prev) / prev) * 100).toFixed(2) : null;
      return { id: i + 1, name: d.name, area: d.area, prev, cur, growth };
    });
  }, [data, tab, hasFinance]);

  const filtered = React.useMemo(() => {
    const s = all.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    // Yang pertumbuhannya tidak diketahui dikumpulkan di bawah, bukan
    // diperlakukan sebagai 0% lalu tercampur di tengah.
    s.sort((a, b) => {
      if (a.growth === null && b.growth === null) return a.name.localeCompare(b.name, "id");
      if (a.growth === null) return 1;
      if (b.growth === null) return -1;
      return dir === "asc" ? a.growth - b.growth : b.growth - a.growth;
    });
    return s;
  }, [all, q, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * per;
  const rows = filtered.slice(start, start + per);
  const live = tab !== "net" && hasFinance;

  return (
    <Panel className={className}>
      <Head title="Performa Cabang" desc="Perbandingan antar cabang · bulan ini vs lalu" right={
        <div className="flex items-center gap-1.5">
          {live && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>}
          <SegmentedTabs size="sm" value={tab} onChange={(v) => { setTab(v); setPage(1); }} items={[{ value: "beli", label: "Pembelian" }, { value: "beban", label: "Beban" }, { value: "net", label: "Net Sales" }]} />
        </div>
      } />
      {tab === "net" && (
        <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          Net Sales per cabang butuh parameter cabang di API ERP (belum tersedia). Tab <b>Pembelian</b> & <b>Beban</b> memakai data Finance asli.
        </p>
      )}
      {all.length === 0 && (
        <BelumAdaData
          sebab={
            tab === "net"
              ? "Belum ada sumber Net Sales per cabang."
              : "Belum ada satu pun outlet yang mengunggah Pembelian atau Beban bulan ini."
          }
        />
      )}
      <div className="relative mb-3 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari cabang…" className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-3 text-left font-medium">Cabang</th>
              <th className="px-3 py-3 text-right font-medium">Bulan Lalu</th>
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
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{rpAtau(row.prev)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rpAtau(row.cur)}</td>
                <td className="px-3 py-2.5 text-right">
                  {row.growth === null ? (
                    <span className="text-[11px] italic text-muted-foreground/70" title="Bulan lalu tidak punya angka pembanding — pertumbuhannya tidak bisa dihitung.">tanpa pembanding</span>
                  ) : (
                    <span className="inline-flex justify-end"><Delta v={row.growth} /></span>
                  )}
                </td>
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
function KontrolCard({ fraud, control }: { fraud: OpsFraud[] | null; control: OpsControl | null }) {
  const [tab, setTab] = React.useState("fraud");
  // ┌─ TEMUAN PALING BERAT GATE R, DAN KODENYA SUDAH MENYATAKAN NIATNYA ──────┐
  // │                                                                        │
  // │ `ops-dashboard.ts` menetapkan `fraud = null` TANPA SYARAT, dengan       │
  // │ komentar: "leave the dashboard fraud card empty rather than approximate │
  // │ it here". Tapi kartunya tidak kosong — ia jatuh ke Promosi Rp 21 jt,    │
  // │ Kompliment Rp 5,2 jt, Refund Rp 420 rb, Void Rp 420 rb.                │
  // │                                                                        │
  // │ Karena `fraud` selalu null, itu bukan cadangan yang muncul kalau data   │
  // │ tidak ada: itu SATU-SATUNYA keadaan. Seratus persen pemuatan halaman    │
  // │ menampilkan empat angka kebocoran karangan di panel yang berjudul       │
  // │ "Pemantauan potensi kebocoran".                                        │
  // └────────────────────────────────────────────────────────────────────────┘
  const fraudRows = fraud ?? [];
  const complaints = control?.complaints ?? [];
  const hygiene = control?.hygiene ?? null;
  const events = control?.events ?? [];
  return (
    <Panel>
      <Head title="Kontrol" desc="Pemantauan potensi kebocoran" right={fraud && fraud.length > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span> : undefined} />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "fraud", label: "Fraud" }, { value: "complain", label: "Complain" }, { value: "bersih", label: "Kebersihan" }, { value: "event", label: "Event" }]} />
      <div className="mt-3 max-h-72 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {tab === "fraud" && (fraudRows.length === 0 ? (
          <BelumAdaData sebab="Rincian void/cancel dibaca di halaman Fraud, dari ekspor ESB. Dashboard ini belum menariknya." />
        ) : (
          <div className="space-y-2">
            {fraudRows.map((row, i) => (
              <div key={row.name + i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{row.name}</span>
                <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{rp(row.value)}</span>
              </div>
            ))}
          </div>
        ))}
        {tab === "complain" && (
          complaints.length === 0 ? (
            <div className="grid place-items-center py-8 text-center text-[12px] text-muted-foreground"><span className="flex flex-col items-center gap-1.5"><CheckCircle2 className="size-5 text-emerald-500" /> Tidak ada komplain terbuka</span></div>
          ) : (
            <div className="space-y-2">
              {complaints.map((c, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">{c.outlet}</span>
                    <Badge tone={c.status === "Open" ? "danger" : "warning"}>{c.status}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.category} · {c.note}</p>
                </div>
              ))}
            </div>
          )
        )}
        {tab === "bersih" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[12px]">
              <span className="text-muted-foreground">Sudah checklist hari ini</span>
              <span className="font-semibold text-foreground">{hygiene ? `${hygiene.checkedToday} / ${hygiene.totalOutlets} outlet` : "—"}</span>
            </div>
            {(hygiene?.rows ?? []).length === 0 ? (
              <div className="grid place-items-center py-6 text-center text-[12px] text-muted-foreground">Belum ada checklist</div>
            ) : (
              hygiene!.rows.map((x, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[12px]">
                  {x.ok ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" /> : <XCircle className="size-4 shrink-0 text-red-500" />}
                  <span className="min-w-0 flex-1 truncate text-foreground">{x.outlet}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{x.supervisor}</span>
                </div>
              ))
            )}
          </div>
        )}
        {tab === "event" && (
          events.length === 0 ? (
            <div className="grid place-items-center py-8 text-center text-[12px] text-muted-foreground">Belum ada event</div>
          ) : (
            <div className="space-y-2">
              {events.map((e, i) => (
                <div key={e.name + i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[12px]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{e.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{e.count}×</span>
                  {e.up ? <Flame className="size-3.5 shrink-0 text-amber-500" /> : <TrendingDown className="size-3.5 shrink-0 text-slate-400" />}
                </div>
              ))}
            </div>
          )
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
function AktivitasTerkini({ activity }: { activity: OpsActivityFeed | null }) {
  const [tab, setTab] = React.useState("divisi");
  const toActs = (src: OpsActivityFeed["divisi"]): Act[] => src.map((a) => ({ who: a.who, t: a.time, a: a.desc, tone: a.tone }));
  // ┌─ TIDAK ADA PLACEHOLDER DI SINI, DAN ITU KEPUTUSAN ──────────────────────┐
  // │                                                                        │
  // │ Sebelum Gate R, panel ini jatuh ke enam baris karangan yang menyebut    │
  // │ NAMA ORANG NYATA dan NAMA OUTLET NYATA: tiga outlet dituduh lalai       │
  // │ ("SPV belum upload", "Finance belum input"), satu diumumkan turun 12%,  │
  // │ tiga orang dinyatakan mengerjakan sesuatu. Tak satu pun pernah terjadi. │
  // │                                                                        │
  // │ Angka rupiah yang salah bisa dikoreksi. Tuduhan terhadap outlet         │
  // │ tertentu sudah sampai ke orangnya sebelum ada yang memeriksanya, dan    │
  // │ itu biaya yang berbeda jenis.                                          │
  // └────────────────────────────────────────────────────────────────────────┘
  const divisi = activity ? toActs(activity.divisi) : [];
  const outlet = activity ? toActs(activity.outlet) : [];
  const rows = tab === "divisi" ? divisi : outlet;
  const live = !!(activity && (activity.divisi.length > 0 || activity.outlet.length > 0));
  return (
    <Panel>
      <Head title="Aktivitas Terkini" desc="Task Tracker (Divisi) & sistem (Outlet)" right={live ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span> : undefined} />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "outlet", label: "Outlet" }, { value: "divisi", label: "Divisi" }]} />
      <div className="mt-3 flex-1">
        {rows.length === 0 ? (
          <div className="grid place-items-center py-8 text-center text-[12px] text-muted-foreground">Belum ada aktivitas</div>
        ) : (
          <ActTimeline label={tab === "divisi" ? "Task selesai" : "Perlu perhatian"} rows={rows} />
        )}
      </div>
    </Panel>
  );
}

/* ---------- Target Per Bulan (gauge) ---------- */
function TargetGauge({ target }: { target: OpsTarget | null }) {
  // Sebelum Gate R: 95,38% · Rp 12,4 M / Rp 13 M ketika target null. Angka
  // miliaran yang business-realistic untuk GWG, jadi yang membacanya
  // menyimpulkan perusahaan hampir mencapai target — kesimpulan yang tidak
  // pernah diukur.
  if (!target) {
    return (
      <Panel>
        <Head title="Target Per Bulan" desc="Realisasi vs target bulan ini" />
        <BelumAdaData sebab="Target bulanan butuh riwayat omzet tiga bulan penuh dari ESB. Belum cukup, atau penarikannya gagal." />
      </Panel>
    );
  }
  const pct = Math.min(100, target.attainmentPct);
  const mom = target.momPct;
  const realisasi = target.realisasi;
  const tgt = target.targetMonth;
  const R = 52, circ = Math.PI * R;
  const dash = (pct / 100) * circ;
  return (
    <Panel>
      <Head title="Target Per Bulan" desc="Realisasi vs target bulan ini" right={<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>} />
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
          <p className="text-2xl font-bold tabular-nums text-foreground">{target.attainmentPct.toFixed(2)}%</p>
          <p className={cn("text-[10px] font-medium", mom >= 0 ? "text-emerald-500" : "text-red-500")}>{mom >= 0 ? "+" : ""}{mom}% vs bulan lalu</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] font-semibold tabular-nums text-foreground">{rp(realisasi)} <span className="text-muted-foreground">/ {rp(tgt)}</span></p>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blue }} /> Realisasi</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blueLt }} /> Target</span>
      </div>
    </Panel>
  );
}
/**
 * Kartu progres. `actual`/`target` null berarti angkanya belum ada.
 *
 * Sebelum Gate R kartu ini menerima `number` saja, sehingga pemanggilnya WAJIB
 * mengarang angka ketika datanya kosong: Proyeksi Bulanan jatuh ke Rp 300 jt /
 * Rp 600 jt dan Target Harian ke Rp 10 jt / Rp 20 jt, keduanya tepat 50%.
 * Tipe yang menolak null adalah tipe yang memaksa angka palsu.
 */
function ProgressCard({ title, pct, actual, target, live, sebab }: { title: string; pct: number | null; actual: number | null; target: number | null; live?: boolean; sebab?: string }) {
  if (pct === null || actual === null || target === null) {
    return (
      <Panel>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="mt-3"><BelumAdaData sebab={sebab} /></div>
      </Panel>
    );
  }
  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">{title}{live && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>}</h3>
        <span className="text-lg font-bold tabular-nums text-foreground">{pct}%</span>
      </div>
      <p className="mt-3 text-[13px] font-semibold tabular-nums text-foreground">{rp(actual)} <span className="text-muted-foreground">/ {rp(target)}</span></p>
      <div className="mt-2"><Progress value={pct} tone="cyan" /></div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blue }} /> Actual</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: C.blueLt }} /> Target</span>
      </div>
    </Panel>
  );
}
function ProdukCard({ products }: { products: OpsProduct[] | null }) {
  const [tab, setTab] = React.useState("total"); // jumlah | total
  const [groupBy, setGroupBy] = React.useState("kategori"); // kategori | produk
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    // Sebelum Gate R: 16 baris "Kategori A".."Kategori H" dengan qty menurun
    // rapi dan amount berputar 21jt/5,2jt/420rb. Nama kategorinya generik,
    // tapi tabelnya bisa diurut dan dicari seperti tabel sungguhan.
    const base = products ?? [];
    // Group by category or keep per product
    let list: { name: string; qty: number; amount: number }[];
    if (groupBy === "kategori") {
      const map = new Map<string, { name: string; qty: number; amount: number }>();
      for (const p of base) {
        const g = map.get(p.category) ?? { name: p.category, qty: 0, amount: 0 };
        g.qty += p.qty; g.amount += p.amount; map.set(p.category, g);
      }
      list = [...map.values()];
    } else {
      list = base.map((p) => ({ name: p.name, qty: p.qty, amount: p.amount }));
    }
    list.sort((a, b) => (tab === "jumlah" ? b.qty - a.qty : b.amount - a.amount));
    return list;
  }, [products, groupBy, tab]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const live = !!(products && products.length > 0);
  const kosong = !products || products.length === 0;
  return (
    <Panel>
      <Head title="Produk" right={
        <div className="flex items-center gap-1.5">
          {live && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>}
          <PillSelect value={groupBy} onChange={setGroupBy} options={[{ v: "kategori", l: "Kategori" }, { v: "produk", l: "Nama Produk" }]} />
        </div>
      } />
      <SegmentedTabs size="sm" value={tab} onChange={setTab} items={[{ value: "jumlah", label: "Jumlah" }, { value: "total", label: "Total" }]} />
      {kosong && <div className="mt-3"><BelumAdaData sebab="Katalog menu ESB belum tertarik untuk tiga bulan terakhir." /></div>}
      <div className="relative mt-2">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={groupBy === "kategori" ? "Cari kategori" : "Cari produk"} className="w-full rounded-lg border border-border bg-transparent py-1.5 pl-8 pr-2 text-[12px] outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {filtered.map((r, i) => (
          <div key={r.name + i} className="flex items-center gap-2 rounded-lg px-1 py-1">
            <span className="grid size-5 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[10px] font-semibold text-blue-600 dark:text-blue-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{r.name}</span>
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-foreground">{tab === "jumlah" ? `${r.qty.toLocaleString("id-ID")}×` : rp(r.amount)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- Rencana Pengeluaran (Juknis 2.11) ---------- */
function RencanaPengeluaran({ fin, netSales, limits }: { fin: OpsFinance | null; netSales: number | null; limits: { warehouse: number; nonWarehouse: number; total: number } }) {
  const live = !!(fin && netSales && netSales > 0);
  // ┌─ CADANGANNYA DULU MENGARANG PELANGGARAN AMBANG ─────────────────────────┐
  // │                                                                        │
  // │ Baris "Non Warehouse" disetel 6% terhadap batas 5%, sehingga panel      │
  // │ menampilkan lencana merah "Melebihi" beserta bar danger. Itu bukan      │
  // │ angka netral yang kebetulan salah — itu tuduhan pelanggaran ambang yang │
  // │ dikarang, di panel yang tugasnya justru mengawasi ambang.               │
  // └────────────────────────────────────────────────────────────────────────┘
  if (!live) {
    return (
      <Panel>
        <Head title="Rencana Pengeluaran" desc="Pembelian vs omset · ambang batas" />
        <BelumAdaData sebab="Butuh dua-duanya: input Pembelian bulan ini dan omzet hari ini dari ESB." />
      </Panel>
    );
  }
  const pctOf = (v: number) => +((v / netSales!) * 100).toFixed(1);
  const rows = [
    { l: "Warehouse", a: fin!.purchaseWh, t: netSales! * (limits.warehouse / 100), actualPct: pctOf(fin!.purchaseWh), limit: limits.warehouse, icon: Boxes },
    { l: "Non Warehouse", a: fin!.purchaseNonWh, t: netSales! * (limits.nonWarehouse / 100), actualPct: pctOf(fin!.purchaseNonWh), limit: limits.nonWarehouse, icon: PackageSearch },
    { l: "Rasio Total", a: fin!.purchaseTotal, t: netSales! * (limits.total / 100), actualPct: pctOf(fin!.purchaseTotal), limit: limits.total, icon: Layers },
  ];
  return (
    <Panel>
      <Head title="Rencana Pengeluaran" desc="Pembelian vs omset · ambang batas" right={<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>} />
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
