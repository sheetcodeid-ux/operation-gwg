"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  FileText,
  ImageDown,
  Lightbulb,
  Package,
  Sheet,
  Sparkles,
  Store,
} from "lucide-react";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { ConcentricRings } from "@/components/dashboard/concentric-rings";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { downloadXlsx, exportChartPng } from "./analysis-export";
import type { AlertItem, AnalysisData, CategoryRow, MarginRow, OutletPerfRow, ProductRow } from "@/lib/data/analysis";

/* palette — same as Dashboard Operation (tone.ts) */
const C = { blue: "#3b82f6", slate: "#94a3b8" };
const RING = ["#3b82f6", "#06b6d4", "#14b8a6", "#8b5cf6", "#f59e0b", "#ec4899", "#22c55e", "#ef4444"];
const rp = (n: number) => formatIDR(n);

function Delta({ v, positiveIsGood = true, className }: { v: number | null; positiveIsGood?: boolean; className?: string }) {
  if (v === null || v === undefined) return null;
  const zero = v === 0;
  const good = v >= 0 === positiveIsGood;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", zero ? "bg-muted text-muted-foreground" : good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-red-500/15 text-red-600 dark:text-red-300", className)}>
      {zero ? <ArrowRight className="size-3" /> : v >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(v)}%
    </span>
  );
}
function PillSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[13rem] cursor-pointer appearance-none truncate rounded-lg border border-border bg-card py-1.5 pl-3 pr-7 text-xs font-medium text-foreground outline-none">
        {options.map((o) => <option key={o.v} value={o.v} className="bg-popover text-foreground">{o.l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
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
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-foreground">{money ? rp(Math.abs(Number(p.value))) : formatNumber(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}
/** Contribution cell: bar + %. */
function ShareCell({ pct, tone = C.blue }: { pct: number; tone?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: tone }} /></div>
      <span className="w-10 text-right text-xs tabular-nums text-foreground">{pct}%</span>
    </div>
  );
}

/* ==================================================================== */

export function DataAnalysis({ data, branches, rangeLabel }: { data: AnalysisData; branches: { id: string; name: string }[]; rangeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const outlet = params.get("outlet") ?? "";
  const [salesMode, setSalesMode] = React.useState("harian");
  const salesRef = React.useRef<HTMLDivElement>(null);

  const setOutlet = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("outlet", v);
    else next.delete("outlet");
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };
  const branchName = React.useCallback((id: string) => branches.find((b) => b.id === id)?.name ?? id, [branches]);
  const k = data.kpi;

  const exportExcel = () => {
    const s: { name: string; aoa: (string | number)[][] }[] = [
      { name: "Ringkasan", aoa: [["Metrik", "Nilai"], ["Total Sales (Gross)", k.totalSales], ["Net Sales", k.netSales], ["Growth %", k.growthPct ?? "-"], ["Achievement %", k.achievementPct ?? "-"], ["Rata-rata / Hari", k.avgPerDay], ["Produk Terjual (30h)", k.productsSold], ["Kategori", k.categories], ["Rata-rata Margin %", k.avgMarginPct ?? "-"]] },
    ];
    if (data.trend.length) s.push({ name: "Sales Harian", aoa: [["Tanggal", "Gross", "Net"], ...data.trend.map((t) => [t.day, t.gross, t.net])] });
    if (data.outletPerformance.length) s.push({ name: "Outlet", aoa: [["Outlet", "Net", "Kontribusi %", "Growth %"], ...data.outletPerformance.map((o) => [branchName(o.branch), o.net, o.share, o.growthPct ?? "-"])] });
    if (data.products.length) s.push({ name: "Produk", aoa: [["Produk", "Kategori", "Qty", "Nilai", "Harga", "Kontribusi %"], ...data.products.map((p) => [p.menu, p.category, p.qty, p.amount, p.unitPrice, p.share])] });
    if (data.categoriesRows.length) s.push({ name: "Kategori", aoa: [["Kategori", "Qty", "Nilai", "Kontribusi %"], ...data.categoriesRows.map((c) => [c.category, c.qty, c.amount, c.share])] });
    if (data.margins.length) s.push({ name: "Margin", aoa: [["Produk", "Kategori", "Harga", "HPP", "Margin", "Margin %"], ...data.margins.map((m) => [m.name, m.category, m.price, m.hpp, m.margin, m.marginPct])] });
    downloadXlsx(`data-analysis-${data.from}_${data.to}`, s);
  };

  const outletOptions = [{ v: "", l: "Semua Outlet" }, ...branches.map((b) => ({ v: b.id, l: b.name }))];
  const salesData = salesMode === "bulanan" ? data.byMonth.map((m) => ({ x: m.name, v: m.value })) : salesMode === "hari" ? data.byWeekday.map((d) => ({ x: d.name, v: d.value })) : data.trend.map((t) => ({ x: t.label, v: t.net }));
  const rings = data.categoriesRows.slice(0, 6).map((c, i) => ({ label: c.category, value: c.share, color: RING[i % RING.length] }));

  /* ---- metric ribbon ---- */
  const metrics: { label: string; value: string; delta?: number | null; good?: boolean }[] = [
    { label: "Net Sales", value: rp(k.netSales), delta: k.growthPct },
    { label: "Total Sales", value: rp(k.totalSales), delta: k.growthPct },
    { label: "Growth", value: k.growthPct === null ? "—" : `${k.growthPct > 0 ? "+" : ""}${k.growthPct}%`, delta: k.growthPct },
    { label: "Achievement", value: k.achievementPct === null ? "—" : `${k.achievementPct}%`, delta: k.achievementPct === null ? null : +(k.achievementPct - 100).toFixed(1) },
    { label: "Rata-rata/Hari", value: rp(k.avgPerDay) },
    { label: "Produk Terjual", value: formatNumber(k.productsSold) },
    { label: "Kategori", value: formatNumber(k.categories) },
    { label: "Rata-rata Margin", value: k.avgMarginPct === null ? "—" : `${k.avgMarginPct}%`, delta: k.avgMarginPct, good: true },
  ];

  /* ---- table columns ---- */
  const productCols = React.useMemo<ColumnDef<ProductRow>[]>(() => [
    { accessorKey: "menu", header: "Produk", cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium text-foreground">{row.original.menu}</p><p className="truncate text-[11px] uppercase text-muted-foreground">{row.original.category}</p></div> },
    { accessorKey: "qty", header: "Qty", cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue<number>())}</span> },
    { accessorKey: "amount", header: "Nilai", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{rp(getValue<number>())}</span> },
    { accessorKey: "unitPrice", header: "Harga", cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{rp(getValue<number>())}</span> },
    { accessorKey: "share", header: "Kontribusi", cell: ({ getValue }) => <ShareCell pct={getValue<number>()} /> },
  ], []);
  const outletCols = React.useMemo<ColumnDef<OutletPerfRow>[]>(() => [
    { id: "name", accessorFn: (r) => branchName(r.branch), header: "Outlet", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "net", header: "Net Sales", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{rp(getValue<number>())}</span> },
    { accessorKey: "share", header: "Kontribusi", cell: ({ getValue }) => <ShareCell pct={getValue<number>()} tone="#14b8a6" /> },
    { accessorKey: "growthPct", header: "Growth", cell: ({ getValue }) => <Delta v={getValue<number | null>()} /> },
  ], [branchName]);
  const marginCols = React.useMemo<ColumnDef<MarginRow>[]>(() => [
    { accessorKey: "name", header: "Produk", cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium text-foreground">{row.original.name}</p><p className="truncate text-[11px] uppercase text-muted-foreground">{row.original.category}</p></div> },
    { accessorKey: "price", header: "Harga", cell: ({ getValue }) => <span className="tabular-nums">{rp(getValue<number>())}</span> },
    { accessorKey: "hpp", header: "HPP", cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{rp(getValue<number>())}</span> },
    { accessorKey: "margin", header: "Margin", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{rp(getValue<number>())}</span> },
    { accessorKey: "marginPct", header: "Margin %", cell: ({ getValue }) => { const v = getValue<number>(); return <span className={cn("font-semibold tabular-nums", v < 30 ? "text-red-500" : v < 50 ? "text-amber-500" : "text-emerald-500")}>{v}%</span>; } },
  ], []);
  const catCols = React.useMemo<ColumnDef<CategoryRow>[]>(() => [
    { accessorKey: "category", header: "Kategori", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
    { accessorKey: "qty", header: "Qty", cell: ({ getValue }) => <span className="tabular-nums">{formatNumber(getValue<number>())}</span> },
    { accessorKey: "amount", header: "Nilai", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{rp(getValue<number>())}</span> },
    { accessorKey: "share", header: "Kontribusi", cell: ({ getValue }) => <ShareCell pct={getValue<number>()} tone="#8b5cf6" /> },
  ], []);

  const outletLabel = outlet ? branchName(outlet) : "Semua Outlet";

  return (
    <div className="w-full space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <Store className="size-3.5 text-muted-foreground" />
          <PillSelect value={outlet} onChange={setOutlet} options={outletOptions} />
        </div>
        <Badge tone="brand">{rangeLabel}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportExcel}><Sheet className="size-3.5" /> Excel</Button>
          <Link href={params.toString() ? `${pathname}/report?${params.toString()}` : `${pathname}/report`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"><FileText className="size-3.5" /> Report</Link>
        </div>
      </div>

      {!data.configured ? (
        <Empty title="Integrasi ESB belum aktif" detail="Set kredensial ESB agar data analisis muncul." />
      ) : !data.hasSales && data.products.length === 0 ? (
        <Empty title="Belum ada data" detail={outlet ? `Outlet "${outletLabel}" belum tersinkron (sinkron per-outlet berjalan bertahap). Pilih Semua Outlet untuk data lengkap.` : "Data ESB untuk periode ini belum tersinkron. Coba rentang tanggal lain."} />
      ) : (
        <>
          {/* Metric ribbon — dense, dividers, no wasted space */}
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x lg:grid-cols-8 [&>*]:border-b [&>*]:border-border sm:[&>*]:border-b-0 sm:[&>*:nth-child(-n+4)]:border-b lg:[&>*]:border-b-0">
              {metrics.map((m) => (
                <div key={m.label} className="flex flex-col gap-1 p-3.5">
                  <span className="text-[11px] text-muted-foreground">{m.label}</span>
                  <span className="truncate text-base font-bold tabular-nums text-foreground">{m.value}</span>
                  {m.delta != null ? <Delta v={m.delta} positiveIsGood={m.good ?? true} /> : <span className="h-[18px]" />}
                </div>
              ))}
            </div>
          </Card>

          {/* Hero sales chart */}
          {data.hasSales && (
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">Sales Analysis</h3>
                  <div className="mt-1 flex items-center gap-2"><p className="text-2xl font-bold tabular-nums text-foreground">{rp(k.netSales)}</p><Delta v={k.growthPct} /></div>
                  <p className="text-[11px] text-muted-foreground">Net sales · {outletLabel} · {rangeLabel}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <SegmentedTabs size="sm" value={salesMode} onChange={setSalesMode} items={[{ value: "harian", label: "Harian" }, { value: "bulanan", label: "Bulanan" }, { value: "hari", label: "Hari" }]} />
                  <button type="button" onClick={() => exportChartPng(salesRef.current, "sales")} title="Export PNG" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ImageDown className="size-4" /></button>
                </div>
              </div>
              <div ref={salesRef} className="h-[16rem]">
                <ResponsiveContainer width="100%" height="100%">
                  {salesMode === "harian" ? (
                    <AreaChart data={salesData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity={0.28} /><stop offset="100%" stopColor={C.blue} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                      <XAxis dataKey="x" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                      <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatIDRShort(Number(v))} />
                      <Tooltip cursor={{ stroke: "rgba(148,163,184,0.4)", strokeDasharray: "3 3" }} content={(p) => <ChartTip {...(p as unknown as TipProps)} money />} />
                      <Area type="monotone" dataKey="v" name="Net Sales" stroke={C.blue} strokeWidth={2.5} fill="url(#gA)" dot={false} activeDot={{ r: 5 }} className="chart-glow-blue" />
                    </AreaChart>
                  ) : (
                    <BarChart data={salesData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                      <XAxis dataKey="x" tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: C.slate, fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatIDRShort(Number(v))} />
                      <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={(p) => <ChartTip {...(p as unknown as TipProps)} money />} />
                      <Bar dataKey="v" name={salesMode === "bulanan" ? "Net Sales" : "Rata-rata"} fill={C.blue} radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              {(data.peakDay || data.lowDay) && (
                <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                  {data.peakDay && <span>▲ Tertinggi: <b className="text-foreground">{data.peakDay.label}</b> · {rp(data.peakDay.net)}</span>}
                  {data.lowDay && <span>▼ Terendah: <b className="text-foreground">{data.lowDay.label}</b> · {rp(data.lowDay.net)}</span>}
                </div>
              )}
            </Card>
          )}

          {/* Products — FULL table, all products, searchable/sortable/paginated */}
          {data.products.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Product Analysis" desc={`Semua produk · ${data.products.length} item · katalog ESB 30 hari (semua outlet)`} />
              <DataTable tableId="an-produk" columns={productCols} data={data.products} searchPlaceholder="Cari produk / kategori…" pageSize={12} />
              {data.deadProducts.length > 0 && <p className="mt-2 text-[11px] text-red-600 dark:text-red-400"><b>{data.deadProducts.length}</b> produk mati (tanpa penjualan 30 hari).</p>}
            </Card>
          )}

          {/* Category donut + Outlet table */}
          <div className="grid items-start gap-4 lg:grid-cols-5">
            {rings.length > 0 && (
              <Card className="p-5 lg:col-span-2">
                <SectionTitle title="Category Analysis" desc="Kontribusi kategori" />
                <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-5">
                  <ConcentricRings rings={rings} centerValue={data.categoriesRows[0]?.share ?? 0} centerLabel={data.categoriesRows[0]?.category ?? ""} size={160} />
                  <ul className="min-w-40 flex-1 space-y-2">
                    {data.categoriesRows.slice(0, 8).map((c, i) => (
                      <li key={c.category} className="flex items-center gap-2 text-xs">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: RING[i % RING.length] }} />
                        <span className="min-w-0 flex-1 truncate text-foreground">{c.category}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">{c.share}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}
            {!outlet && (
              <Card className="p-5 lg:col-span-3">
                <SectionTitle title="Outlet Performance" desc="Ranking net sales · periode ini" />
                {data.outletPerformance.length > 0 ? (
                  <DataTable tableId="an-outlet" columns={outletCols} data={data.outletPerformance} searchPlaceholder="Cari outlet…" pageSize={8} />
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">Data per-outlet sedang disinkron bertahap (1 outlet/jam). Tampilan Semua Outlet sudah lengkap.</p>
                )}
              </Card>
            )}
          </div>

          {/* Category table (full) */}
          {data.categoriesRows.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Kategori — Rincian" desc={`${data.categoriesRows.length} kategori`} />
              <DataTable tableId="an-kategori" columns={catCols} data={data.categoriesRows} searchPlaceholder="Cari kategori…" pageSize={8} showExport={false} />
            </Card>
          )}

          {/* Price & Margin — full table */}
          {data.margins.length > 0 && (
            <Card className="p-5">
              <SectionTitle
                title="Price & Margin"
                desc={data.priceStats ? `Rata-rata harga ${rp(data.priceStats.avg)} · ${data.margins.length} produk ber-HPP` : `${data.margins.length} produk`}
              />
              <DataTable tableId="an-margin" columns={marginCols} data={data.margins} searchPlaceholder="Cari produk…" pageSize={10} />
            </Card>
          )}

          {/* Alerts + Insight + Recommendation — compact strip */}
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {data.alerts.length > 0 && (
              <Card className="p-5">
                <SectionTitle title="Alert Center" icon={<AlertTriangle className="size-4 text-amber-500" />} />
                <div className="space-y-2">{data.alerts.map((a, i) => <AlertRow key={i} a={a} />)}</div>
              </Card>
            )}
            {data.insights.length > 0 && (
              <Card className="p-5">
                <SectionTitle title="AI Insight" icon={<Sparkles className="size-4 text-violet-500" />} />
                <div className="space-y-2">{data.insights.map((it, i) => <InfoRow key={i} title={it.title} detail={it.detail} />)}</div>
              </Card>
            )}
            {data.recommendations.length > 0 && (
              <Card className="p-5">
                <SectionTitle title="Rekomendasi" icon={<Lightbulb className="size-4 text-amber-500" />} />
                <div className="space-y-2">{data.recommendations.map((it, i) => <InfoRow key={i} title={it.title} detail={it.detail} />)}</div>
              </Card>
            )}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">Data dihitung otomatis dari cache ESB terbaru · produk/kategori/margin = katalog seluruh outlet · sales & outlet per-outlet mengisi bertahap.</p>
        </>
      )}
    </div>
  );
}

function SectionTitle({ title, desc, icon }: { title: string; desc?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
      </div>
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
function AlertRow({ a }: { a: AlertItem }) {
  const cls = a.level === "high" ? "border-red-500/30 bg-red-500/[0.06] text-red-600 dark:text-red-400" : a.level === "medium" ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400" : "border-sky-500/30 bg-sky-500/[0.06] text-sky-600 dark:text-sky-400";
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs", cls)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div><p className="font-semibold">{a.title}</p><p className="mt-0.5 text-foreground/90">{a.detail}</p></div>
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
