"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Box,
  ChevronDown,
  CircleDollarSign,
  Coins,
  FileText,
  ImageDown,
  Lightbulb,
  Package,
  Sheet,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { ConcentricRings } from "@/components/dashboard/concentric-rings";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { downloadXlsx, exportChartPng } from "./analysis-export";
import type { AlertItem, AnalysisData } from "@/lib/data/analysis";

/* palette — identical to Dashboard Operation (tone.ts) */
const C = { blue: "#3b82f6", blueLt: "#93c5fd", green: "#22c55e", amber: "#f59e0b", red: "#ef4444", slate: "#94a3b8" };
const RING = ["#3b82f6", "#06b6d4", "#14b8a6", "#8b5cf6", "#f59e0b", "#ec4899", "#22c55e", "#ef4444"];
const rp = (n: number) => formatIDR(n);

/* ---------- shared primitives (mirrors operation-dashboard-2) ---------- */
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
function Delta({ v, positiveIsGood = true }: { v: number | null; positiveIsGood?: boolean }) {
  if (v === null) return null;
  const zero = v === 0;
  const good = v >= 0 === positiveIsGood;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", zero ? "bg-muted text-muted-foreground" : good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-red-500/15 text-red-600 dark:text-red-300")}>
      {zero ? <ArrowRight className="size-3" /> : v >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(v)}%
    </span>
  );
}
function PillSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[11rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-card py-1.5 pl-3 pr-7 text-xs font-medium text-foreground outline-none">
        {options.map((o) => <option key={o.v} value={o.v} className="bg-popover text-foreground">{o.l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </div>
  );
}
function KpiTile({ icon: Icon, label, value, delta, positiveIsGood, sub }: { icon: LucideIcon; label: string; value: string; delta?: number | null; positiveIsGood?: boolean; sub?: string }) {
  return (
    <div className="card-gradient flex flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border"><Icon className="size-5 text-muted-foreground" /></div>
        <Delta v={delta ?? null} positiveIsGood={positiveIsGood} />
      </div>
      <div className="mt-4 min-w-0">
        <p className="text-[12px] text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
type TipPayload = { name?: string; value?: number; color?: string };
type TipProps = { active?: boolean; label?: React.ReactNode; payload?: TipPayload[]; money?: boolean };
function ChartTip({ active, label, payload, money }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="mb-1.5 font-medium text-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.filter((p) => p.value != null).map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">{money ? rp(Math.abs(Number(p.value))) : formatNumber(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
/** Small "export PNG" icon button for a chart panel. */
function PngBtn({ target, name }: { target: React.RefObject<HTMLDivElement | null>; name: string }) {
  return (
    <button type="button" onClick={() => exportChartPng(target.current, name)} title="Export PNG" className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <ImageDown className="size-4" />
    </button>
  );
}

/* ==================================================================== */

export function DataAnalysis({ data, branches, rangeLabel }: { data: AnalysisData; branches: { id: string; name: string }[]; rangeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const outlet = params.get("outlet") ?? "";
  const [salesMode, setSalesMode] = React.useState("harian");

  const setOutlet = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("outlet", v);
    else next.delete("outlet");
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const k = data.kpi;

  const trendRef = React.useRef<HTMLDivElement>(null);
  const salesRef = React.useRef<HTMLDivElement>(null);

  const exportExcel = () => {
    const s: { name: string; aoa: (string | number)[][] }[] = [
      { name: "Ringkasan", aoa: [["Metrik", "Nilai"], ["Total Sales (Gross)", k.totalSales], ["Net Sales", k.netSales], ["Growth %", k.growthPct ?? "-"], ["Achievement %", k.achievementPct ?? "-"], ["Rata-rata / Hari", k.avgPerDay], ["Produk Terjual (30h)", k.productsSold], ["Kategori", k.categories], ["Rata-rata Margin %", k.avgMarginPct ?? "-"]] },
    ];
    if (data.trend.length) s.push({ name: "Sales Harian", aoa: [["Tanggal", "Gross", "Net"], ...data.trend.map((t) => [t.day, t.gross, t.net])] });
    if (data.byMonth.length) s.push({ name: "Sales per Bulan", aoa: [["Bulan", "Net"], ...data.byMonth.map((m) => [m.name, m.value])] });
    if (data.outletPerformance.length) s.push({ name: "Outlet", aoa: [["Outlet", "Net", "Kontribusi %", "Growth %"], ...data.outletPerformance.map((o) => [branchName(o.branch), o.net, o.share, o.growthPct ?? "-"])] });
    if (data.products.length) s.push({ name: "Produk", aoa: [["Produk", "Kategori", "Qty", "Amount", "Harga", "Kontribusi %"], ...data.products.map((p) => [p.menu, p.category, p.qty, p.amount, p.unitPrice, p.share])] });
    if (data.categoriesRows.length) s.push({ name: "Kategori", aoa: [["Kategori", "Qty", "Amount", "Kontribusi %"], ...data.categoriesRows.map((c) => [c.category, c.qty, c.amount, c.share])] });
    if (data.margins.length) s.push({ name: "Margin", aoa: [["Produk", "Kategori", "Harga", "HPP", "Margin", "Margin %"], ...data.margins.map((m) => [m.name, m.category, m.price, m.hpp, m.margin, m.marginPct])] });
    downloadXlsx(`data-analysis-${data.from}_${data.to}`, s);
  };

  const outletOptions = [{ v: "", l: "Semua Outlet" }, ...branches.map((b) => ({ v: b.id, l: b.name }))];
  const salesData = salesMode === "bulanan" ? data.byMonth.map((m) => ({ x: m.name, v: m.value })) : salesMode === "harian-minggu" ? data.byWeekday.map((d) => ({ x: d.name, v: d.value })) : data.trend.map((t) => ({ x: t.label, v: t.net }));
  const rings = data.categoriesRows.slice(0, 6).map((c, i) => ({ label: c.category, value: c.share, color: RING[i % RING.length] }));

  return (
    <div className="w-full space-y-4">
      {/* Filter row — clean, like Dashboard/Analytics */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <Store className="size-3.5 text-muted-foreground" />
          <PillSelect value={outlet} onChange={setOutlet} options={outletOptions} />
        </div>
        <Badge tone="brand">{rangeLabel}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportExcel}><Sheet className="size-3.5" /> Excel</Button>
          <Link href={params.toString() ? `${pathname}/report?${params.toString()}` : `${pathname}/report`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <FileText className="size-3.5" /> Report
          </Link>
        </div>
      </div>

      {!data.configured ? (
        <Empty title="Integrasi ESB belum aktif" detail="Set kredensial ESB agar data analisis muncul." />
      ) : !data.hasSales && data.products.length === 0 ? (
        <Empty title="Belum ada data" detail="Data ESB untuk periode/outlet ini belum tersinkron. Coba rentang tanggal lain atau tunggu sinkronisasi otomatis." />
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiTile icon={Wallet} label="Total Sales" value={rp(k.totalSales)} delta={k.growthPct} sub="gross · vs periode lalu" />
            <KpiTile icon={Coins} label="Net Sales" value={rp(k.netSales)} delta={k.growthPct} sub="vs periode lalu" />
            <KpiTile icon={Target} label="Achievement" value={k.achievementPct === null ? "—" : `${k.achievementPct}%`} delta={k.achievementPct === null ? null : +(k.achievementPct - 100).toFixed(1)} sub="dari target" />
            <KpiTile icon={CircleDollarSign} label="Rata-rata / Hari" value={rp(k.avgPerDay)} sub={`${k.days} hari aktif`} />
            <KpiTile icon={Package} label="Produk Terjual" value={formatNumber(k.productsSold)} sub="30 hari" />
            <KpiTile icon={Box} label="Kategori" value={formatNumber(k.categories)} sub="jenis" />
            <KpiTile icon={CircleDollarSign} label="Rata-rata Harga" value={rp(k.avgPrice)} sub="per produk" />
            <KpiTile icon={BadgePercent} label="Rata-rata Margin" value={k.avgMarginPct === null ? "—" : `${k.avgMarginPct}%`} delta={k.avgMarginPct} positiveIsGood sub="harga vs HPP" />
          </div>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <Panel>
              <Head title="Alert Center" desc="Peringatan otomatis dari data terbaru" />
              <div className="grid gap-2 sm:grid-cols-2">
                {data.alerts.map((a, i) => <AlertRow key={i} a={a} />)}
              </div>
            </Panel>
          )}

          {/* Sales Analysis */}
          {data.hasSales && (
            <Panel>
              <Head
                title="Sales Analysis"
                desc="Tren penjualan · data ESB"
                right={
                  <div className="flex items-center gap-1.5">
                    <SegmentedTabs size="sm" value={salesMode} onChange={setSalesMode} items={[{ value: "harian", label: "Harian" }, { value: "bulanan", label: "Bulanan" }, { value: "harian-minggu", label: "Hari" }]} />
                    <PngBtn target={salesRef} name="sales" />
                  </div>
                }
              />
              <div className="mb-2 flex items-center gap-2"><p className="text-xl font-bold tabular-nums text-foreground">{rp(k.netSales)}</p><Delta v={k.growthPct} /></div>
              <div ref={salesRef} className="min-h-[15rem] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  {salesMode === "harian" ? (
                    <AreaChart data={salesData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity={0.3} /><stop offset="100%" stopColor={C.blue} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                      <XAxis dataKey="x" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                      <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => formatIDRShort(Number(v))} />
                      <Tooltip cursor={{ stroke: "rgba(148,163,184,0.4)", strokeDasharray: "3 3" }} content={(p) => <ChartTip {...(p as unknown as TipProps)} money />} />
                      <Area type="monotone" dataKey="v" name="Net Sales" stroke={C.blue} strokeWidth={2.5} fill="url(#gArea)" dot={false} activeDot={{ r: 5 }} className="chart-glow-blue" />
                    </AreaChart>
                  ) : (
                    <BarChart data={salesData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                      <XAxis dataKey="x" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => formatIDRShort(Number(v))} />
                      <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={(p) => <ChartTip {...(p as unknown as TipProps)} money />} />
                      <Bar dataKey="v" name={salesMode === "bulanan" ? "Net Sales" : "Rata-rata"} fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {data.peakDay && <Callout tone="green" title="Hari Tertinggi" body={`${data.peakDay.label} · ${rp(data.peakDay.net)}`} />}
                {data.lowDay && <Callout tone="amber" title="Hari Terendah" body={`${data.lowDay.label} · ${rp(data.lowDay.net)}`} />}
              </div>
            </Panel>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* Outlet Performance */}
            {!outlet && (
              <Panel>
                <Head title="Outlet Performance" desc="Ranking net sales · periode ini" />
                {data.outletPerformance.length > 0 ? (
                  <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {data.outletPerformance.slice(0, 20).map((o, i) => (
                      <div key={o.branch} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
                        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-blue-500/12 text-[11px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">{i + 1}</span>
                        <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-foreground">{branchName(o.branch)}</p><p className="text-[10px] text-muted-foreground">Kontribusi {o.share}%</p></div>
                        <Delta v={o.growthPct} />
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">{rp(o.net)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">Data per-outlet sedang disinkron bertahap (1 outlet/jam). Gunakan tampilan Semua Outlet dulu.</p>
                )}
              </Panel>
            )}

            {/* Product Analysis */}
            {data.products.length > 0 && (
              <Panel>
                <Head title="Product Analysis" desc="Best seller · katalog ESB 30 hari" />
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {data.bestSellers.map((p, i) => (
                    <div key={p.menu} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-500/12 text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{i + 1}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-foreground">{p.menu}</p><p className="text-[10px] uppercase text-muted-foreground">{p.category}</p></div>
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">{formatNumber(p.qty)} · {p.share}%</span>
                    </div>
                  ))}
                </div>
                {data.deadProducts.length > 0 && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400"><b>{data.deadProducts.length}</b> produk mati (tanpa penjualan 30 hari).</p>}
              </Panel>
            )}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* Category donut (ConcentricRings, like the dashboard) */}
            {rings.length > 0 && (
              <Panel>
                <Head title="Category Analysis" desc="Kontribusi kategori" />
                <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-5">
                  <ConcentricRings rings={rings} centerValue={data.categoriesRows[0]?.share ?? 0} centerLabel={data.categoriesRows[0]?.category ?? ""} size={168} />
                  <ul className="min-w-44 flex-1 space-y-2">
                    {data.categoriesRows.slice(0, 8).map((c, i) => (
                      <li key={c.category} className="flex items-center gap-2 text-xs">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: RING[i % RING.length] }} />
                        <span className="min-w-0 flex-1 truncate text-foreground">{c.category}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">{c.share}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            )}

            {/* Price & Margin */}
            {(data.priceStats || data.lowMargins.length > 0) && (
              <Panel>
                <Head title="Price & Margin" desc="Harga jual & margin (ESB vs HPP)" />
                {data.priceStats && (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <Mini label="Rata-rata" value={rp(data.priceStats.avg)} />
                    <Mini label="Tertinggi" value={data.priceStats.highest ? rp(data.priceStats.highest.unitPrice) : "—"} sub={data.priceStats.highest?.menu} />
                    <Mini label="Terendah" value={data.priceStats.lowest ? rp(data.priceStats.lowest.unitPrice) : "—"} sub={data.priceStats.lowest?.menu} />
                  </div>
                )}
                {data.lowMargins.length > 0 && (
                  <>
                    <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">Margin Tipis (&lt; 30%)</p>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                      {data.lowMargins.map((m) => (
                        <div key={m.name} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[12px]">
                          <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                          <span className="shrink-0 text-muted-foreground">{rp(m.price)}</span>
                          <span className="shrink-0 font-semibold text-red-600 dark:text-red-400">{m.marginPct}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Panel>
            )}
          </div>

          {/* Insight + Recommendation */}
          {(data.insights.length > 0 || data.recommendations.length > 0) && (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Panel>
                <Head title="AI Insight" desc="Analisis otomatis dari data" right={<Sparkles className="size-4 text-violet-500" />} />
                <div className="space-y-2">
                  {data.insights.map((it, i) => <InfoRow key={i} title={it.title} detail={it.detail} />)}
                  {data.insights.length === 0 && <p className="text-xs text-muted-foreground">Belum cukup data.</p>}
                </div>
              </Panel>
              <Panel>
                <Head title="Rekomendasi" desc="Tindakan yang disarankan" right={<Lightbulb className="size-4 text-amber-500" />} />
                <div className="space-y-2">
                  {data.recommendations.map((it, i) => <InfoRow key={i} title={it.title} detail={it.detail} />)}
                  {data.recommendations.length === 0 && <p className="text-xs text-muted-foreground">Belum ada rekomendasi.</p>}
                </div>
              </Panel>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">Data dihitung otomatis dari cache ESB terbaru · analisis per-outlet mengisi bertahap.</p>
          <span ref={trendRef} className="hidden" />
        </>
      )}
    </div>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
      <Package className="size-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
function Callout({ tone, title, body }: { tone: "green" | "amber"; title: string; body: string }) {
  const cls = tone === "green" ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-600 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400";
  return (
    <div className={cn("rounded-xl border px-3 py-2.5 text-xs", cls)}>
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-foreground">{body}</p>
    </div>
  );
}
function AlertRow({ a }: { a: AlertItem }) {
  const cls = a.level === "high" ? "border-red-500/30 bg-red-500/[0.06] text-red-600 dark:text-red-400" : a.level === "medium" ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400" : "border-sky-500/30 bg-sky-500/[0.06] text-sky-600 dark:text-sky-400";
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs", cls)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div><p className="font-semibold">{a.title}</p><p className="mt-0.5 text-foreground/90">{a.detail}</p></div>
    </div>
  );
}
function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function InfoRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
