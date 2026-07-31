"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BadgePercent,
  Box,
  CircleDollarSign,
  Lightbulb,
  FileText,
  Package,
  Sheet,
  Sparkles,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn, formatIDR, formatIDRShort, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { ChartFrame } from "./chart-frame";
import { downloadXlsx } from "./analysis-export";
import type { AlertItem, AnalysisData } from "@/lib/data/analysis";

const NET = "#6366f1";
const GROSS = "#a5b4fc";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const AXIS = "var(--muted-foreground)";
const rp = (n: number) => formatIDR(n);

function Section({ title, desc, icon: Icon, children }: { title: string; desc?: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </CardTitle>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Vibrant categorical palette for donut/series (aniq-style). */
const PALETTE = ["#3b82f6", "#06b6d4", "#14b8a6", "#8b5cf6", "#f59e0b", "#ec4899", "#22c55e", "#ef4444", "#0ea5e9", "#a855f7"];

/** Premium KPI card: icon chip + big value + trend badge + faint watermark icon. */
function KpiCard({ icon: Icon, label, value, accent, delta, up }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent: string; delta?: string | null; up?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-4 shadow-sm transition-shadow hover:shadow-md">
      <span aria-hidden className="pointer-events-none absolute -right-3 -top-3 size-24 rounded-full opacity-[0.10] blur-2xl" style={{ background: accent }} />
      <Icon aria-hidden className="pointer-events-none absolute -bottom-3 -right-2 size-20 opacity-[0.05]" />
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}1f`, color: accent }}>
          <Icon className="size-4" />
        </span>
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="truncate text-xl font-bold tracking-tight text-foreground">{value}</p>
        {delta != null && (
          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-red-500/12 text-red-600 dark:text-red-400")}>
            {up ? "▲" : "▼"} {delta}
          </span>
        )}
      </div>
    </div>
  );
}

function DonutTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <span className="size-2 rounded-full" style={{ background: p.payload.fill }} /> {p.name}
      </p>
      <p className="mt-0.5 text-muted-foreground">Qty: <span className="font-medium text-foreground">{formatNumber(p.value)}</span></p>
    </div>
  );
}

function ChartTip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-medium text-foreground">{money ? rp(p.value) : formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const ALERT_TONE: Record<AlertItem["level"], string> = {
  high: "border-red-500/30 bg-red-500/[0.06] text-red-600 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400",
  low: "border-sky-500/30 bg-sky-500/[0.06] text-sky-600 dark:text-sky-400",
};

export function DataAnalysis({ data, branches, rangeLabel }: { data: AnalysisData; branches: { id: string; name: string }[]; rangeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const outlet = params.get("outlet") ?? "";

  const setOutlet = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("outlet", v);
    else next.delete("outlet");
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
  };

  const outletOptions = [{ value: "", label: "Semua Outlet" }, ...branches.map((b) => ({ value: b.id, label: b.name }))];
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const k = data.kpi;

  const exportExcel = () => {
    const s: { name: string; aoa: (string | number)[][] }[] = [
      {
        name: "Ringkasan",
        aoa: [
          ["Metrik", "Nilai"],
          ["Total Sales (Gross)", k.totalSales],
          ["Net Sales", k.netSales],
          ["Growth %", k.growthPct ?? "-"],
          ["Achievement %", k.achievementPct ?? "-"],
          ["Rata-rata / Hari", k.avgPerDay],
          ["Produk Terjual (30h)", k.productsSold],
          ["Kategori", k.categories],
          ["Rata-rata Margin %", k.avgMarginPct ?? "-"],
        ],
      },
    ];
    if (data.trend.length) s.push({ name: "Sales Harian", aoa: [["Tanggal", "Gross", "Net"], ...data.trend.map((t) => [t.day, t.gross, t.net])] });
    if (data.byMonth.length) s.push({ name: "Sales per Bulan", aoa: [["Bulan", "Net"], ...data.byMonth.map((m) => [m.name, m.value])] });
    if (data.outletPerformance.length) s.push({ name: "Outlet", aoa: [["Outlet", "Net", "Kontribusi %", "Growth %"], ...data.outletPerformance.map((o) => [branchName(o.branch), o.net, o.share, o.growthPct ?? "-"])] });
    if (data.products.length) s.push({ name: "Produk", aoa: [["Produk", "Kategori", "Qty", "Amount", "Harga", "Kontribusi %"], ...data.products.map((p) => [p.menu, p.category, p.qty, p.amount, p.unitPrice, p.share])] });
    if (data.categoriesRows.length) s.push({ name: "Kategori", aoa: [["Kategori", "Qty", "Amount", "Kontribusi %"], ...data.categoriesRows.map((c) => [c.category, c.qty, c.amount, c.share])] });
    if (data.margins.length) s.push({ name: "Margin", aoa: [["Produk", "Kategori", "Harga", "HPP", "Margin", "Margin %"], ...data.margins.map((m) => [m.name, m.category, m.price, m.hpp, m.margin, m.marginPct])] });
    downloadXlsx(`data-analysis-${data.from}_${data.to}`, s);
  };

  return (
    <div>
      {/* Global filter bar — outlet search + the SAME date picker as Ops Dashboard */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-2.5">
        <span className="flex shrink-0 items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <Store className="size-3.5" /> Outlet
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <Combobox portal value={outlet} onChange={setOutlet} options={outletOptions} placeholder="Cari outlet…" searchPlaceholder="Cari outlet…" />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Badge tone="brand">{rangeLabel}</Badge>
          <DateRangePicker />
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Sheet className="size-3.5" /> Excel
          </button>
          <Link
            href={params.toString() ? `${pathname}/report?${params.toString()}` : `${pathname}/report`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <FileText className="size-3.5" /> Generate Report
          </Link>
        </div>
      </div>

      {!data.configured ? (
        <EmptyState title="Integrasi ESB belum aktif" detail="Set kredensial ESB agar data analisis muncul." />
      ) : !data.hasSales && data.products.length === 0 ? (
        <EmptyState title="Belum ada data" detail="Data ESB untuk periode/outlet ini belum tersinkron. Coba rentang tanggal lain, atau tunggu sinkronisasi otomatis." />
      ) : (
        <>
          {/* KPI Summary — premium cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={Wallet} label="Total Sales" value={rp(k.totalSales)} accent="#3b82f6" delta={k.growthPct === null ? null : `${Math.abs(k.growthPct)}%`} up={(k.growthPct ?? 0) >= 0} />
            <KpiCard icon={CircleDollarSign} label="Net Sales" value={rp(k.netSales)} accent="#06b6d4" delta={k.growthPct === null ? null : `${Math.abs(k.growthPct)}%`} up={(k.growthPct ?? 0) >= 0} />
            <KpiCard icon={Target} label="Achievement" value={k.achievementPct === null ? "—" : `${k.achievementPct}%`} accent="#8b5cf6" delta={k.achievementPct === null ? null : `${Math.abs(+(k.achievementPct - 100).toFixed(1))}%`} up={(k.achievementPct ?? 0) >= 100} />
            <KpiCard icon={(k.growthPct ?? 0) < 0 ? TrendingDown : TrendingUp} label="Growth" value={k.growthPct === null ? "—" : `${k.growthPct > 0 ? "+" : ""}${k.growthPct}%`} accent="#14b8a6" />
            <KpiCard icon={CircleDollarSign} label="Rata-rata / Hari" value={rp(k.avgPerDay)} accent="#0ea5e9" />
            <KpiCard icon={Package} label="Produk Terjual" value={formatNumber(k.productsSold)} accent="#22c55e" />
            <KpiCard icon={Box} label="Kategori" value={formatNumber(k.categories)} accent="#f59e0b" />
            <KpiCard icon={BadgePercent} label="Rata-rata Margin" value={k.avgMarginPct === null ? "—" : `${k.avgMarginPct}%`} accent="#ec4899" delta={k.avgMarginPct === null ? null : `${k.avgMarginPct}%`} up={(k.avgMarginPct ?? 0) >= 30} />
          </div>

          {/* Alerts */}
          {data.alerts.length > 0 && (
            <Section title="Alert Center" desc="Peringatan otomatis berdasarkan data terbaru" icon={AlertTriangle}>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.alerts.map((a, i) => (
                  <div key={i} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs", ALERT_TONE[a.level])}>
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-0.5 opacity-90">{a.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Sales Analysis */}
          {data.hasSales && (
            <Section title="Sales Analysis" desc="Tren penjualan harian, bulanan & pola hari (data ESB)" icon={TrendingUp}>
              <ChartFrame title="Tren Net Sales Harian" filename="sales-trend" height={256}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NET} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={NET} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS }} interval="preserveStartEnd" minTickGap={28} />
                    <YAxis tick={{ fontSize: 10, fill: AXIS }} tickFormatter={(v) => formatIDRShort(v)} width={54} />
                    <Tooltip content={<ChartTip money />} cursor={{ stroke: NET, strokeWidth: 1.5, strokeDasharray: "4 4" }} />
                    <Area type="monotone" dataKey="net" name="Net Sales" stroke={NET} strokeWidth={2.5} fill="url(#gNet)" activeDot={{ r: 5, fill: NET, stroke: "var(--background)", strokeWidth: 2 }} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartFrame>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Net Sales per Bulan</p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byMonth} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: AXIS }} />
                        <YAxis tick={{ fontSize: 10, fill: AXIS }} tickFormatter={(v) => formatIDRShort(v)} width={54} />
                        <Tooltip content={<ChartTip money />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                        <Bar dataKey="value" name="Net Sales" fill={NET} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Rata-rata per Hari (dalam Minggu)</p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.byWeekday} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: AXIS }} />
                        <YAxis tick={{ fontSize: 10, fill: AXIS }} tickFormatter={(v) => formatIDRShort(v)} width={54} />
                        <Tooltip content={<ChartTip money />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                        <Bar dataKey="value" name="Rata-rata" fill={EMERALD} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {data.peakDay && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-xs">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">Hari Tertinggi</p>
                    <p className="mt-0.5 text-foreground">{data.peakDay.label} · {rp(data.peakDay.net)}</p>
                  </div>
                )}
                {data.lowDay && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-xs">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">Hari Terendah</p>
                    <p className="mt-0.5 text-foreground">{data.lowDay.label} · {rp(data.lowDay.net)}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Outlet Performance (all-outlets view) */}
          {!outlet && (
            <Section title="Outlet Performance" desc="Ranking outlet berdasarkan net sales periode ini" icon={Store}>
              {data.outletPerformance.length > 0 ? (
                <>
                  <ChartFrame title="Outlet Performance" filename="outlet-performance" height={224}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.outletPerformance.slice(0, 12).map((o) => ({ name: branchName(o.branch), net: o.net }))} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: AXIS }} tickFormatter={(v) => formatIDRShort(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: AXIS }} width={120} />
                        <Tooltip content={<ChartTip money />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                        <Bar dataKey="net" name="Net Sales" radius={[0, 4, 4, 0]}>
                          {data.outletPerformance.slice(0, 12).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? EMERALD : NET} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartFrame>
                  <div className="mt-3">
                    <RankTable
                      title=""
                      tone="emerald"
                      rows={data.outletPerformance.slice(0, 15).map((o) => ({ name: branchName(o.branch), sub: `Kontribusi ${o.share}%${o.growthPct !== null ? ` · growth ${o.growthPct > 0 ? "+" : ""}${o.growthPct}%` : ""}`, value: rp(o.net) }))}
                    />
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  Data per-outlet sedang disinkron bertahap dari ESB (satu outlet per jam). Ranking akan terisi otomatis — untuk sekarang gunakan tampilan Semua Outlet.
                </p>
              )}
            </Section>
          )}

          {/* Product Analysis */}
          {data.products.length > 0 && (
            <Section title="Product Analysis" desc="Best/worst seller & kontribusi (katalog ESB 30 hari)" icon={Package}>
              <div className="grid gap-4 lg:grid-cols-2">
                <RankTable title="Best Seller" rows={data.bestSellers.map((p) => ({ name: p.menu, sub: p.category, value: `${formatNumber(p.qty)} · ${p.share}%` }))} tone="emerald" />
                <RankTable title="Slow Moving" rows={data.worstSellers.map((p) => ({ name: p.menu, sub: p.category, value: `${formatNumber(p.qty)} terjual` }))} tone="amber" />
              </div>
              {data.deadProducts.length > 0 && (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  <span className="font-semibold">{data.deadProducts.length} produk mati</span> — tanpa penjualan dalam 30 hari terakhir.
                </p>
              )}
            </Section>
          )}

          {/* Category Analysis */}
          {data.categoriesRows.length > 0 && (
            <Section title="Category Analysis" desc="Kontribusi & performa kategori" icon={Box}>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
                <ChartFrame title="Kontribusi Kategori" filename="kategori" height={240}>
                  <div className="relative h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.categoriesRows.slice(0, 8)} dataKey="qty" nameKey="category" cx="50%" cy="50%" innerRadius="60%" outerRadius="84%" paddingAngle={2} stroke="none">
                          {data.categoriesRows.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<DonutTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center">
                      <div className="text-center">
                        <p className="text-2xl font-bold tracking-tight text-foreground">{data.categoriesRows[0]?.share ?? 0}%</p>
                        <p className="max-w-[8rem] truncate text-[10px] text-muted-foreground">{data.categoriesRows[0]?.category}</p>
                      </div>
                    </div>
                  </div>
                </ChartFrame>
                <div className="space-y-1.5">
                  {data.categoriesRows.slice(0, 8).map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="min-w-0 flex-1 truncate text-foreground">{c.category}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(c.qty)}</span>
                      <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-foreground">{c.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Price & Margin Analysis */}
          {(data.priceStats || data.margins.length > 0) && (
            <Section title="Price & Margin Analysis" desc="Harga jual & margin (harga ESB vs HPP)" icon={CircleDollarSign}>
              {data.priceStats && (
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Rata-rata Harga" value={rp(data.priceStats.avg)} />
                  <MiniStat label="Tertinggi" value={data.priceStats.highest ? `${rp(data.priceStats.highest.unitPrice)}` : "—"} sub={data.priceStats.highest?.menu} />
                  <MiniStat label="Terendah" value={data.priceStats.lowest ? `${rp(data.priceStats.lowest.unitPrice)}` : "—"} sub={data.priceStats.lowest?.menu} />
                </div>
              )}
              {data.lowMargins.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Margin Tipis (&lt; 30%)</p>
                  <RankTable
                    title=""
                    tone="red"
                    rows={data.lowMargins.map((m) => ({ name: m.name, sub: `${m.category} · ${rp(m.price)}`, value: `${m.marginPct}%` }))}
                  />
                </div>
              )}
            </Section>
          )}

          {/* AI Insight + Recommendation (rule-based) */}
          {(data.insights.length > 0 || data.recommendations.length > 0) && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-violet-500" /> AI Insight</CardTitle>
                  <p className="text-xs text-muted-foreground">Analisis otomatis dari data</p>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {data.insights.map((it, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-foreground">{it.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p>
                    </div>
                  ))}
                  {data.insights.length === 0 && <p className="text-xs text-muted-foreground">Belum cukup data untuk insight.</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="size-4 text-amber-500" /> Rekomendasi</CardTitle>
                  <p className="text-xs text-muted-foreground">Tindakan yang disarankan</p>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {data.recommendations.map((it, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-foreground">{it.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p>
                    </div>
                  ))}
                  {data.recommendations.length === 0 && <p className="text-xs text-muted-foreground">Belum ada rekomendasi.</p>}
                </CardContent>
              </Card>
            </div>
          )}

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Data dihitung otomatis dari cache ESB terbaru. Analisis per-outlet & per-jam, export PDF/Excel akan hadir di fase berikutnya.
          </p>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
      <Package className="size-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RankTable({ title, rows, tone }: { title: string; tone: "emerald" | "amber" | "red"; rows: { name: string; sub: string; value: string }[] }) {
  const dot = tone === "emerald" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      {title && <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>}
      <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <span className="w-4 shrink-0 text-center text-[11px] font-medium tabular-nums text-muted-foreground">{i + 1}</span>
            <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{r.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{r.sub}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{r.value}</span>
          </div>
        ))}
        {rows.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Tidak ada data.</p>}
      </div>
    </div>
  );
}
