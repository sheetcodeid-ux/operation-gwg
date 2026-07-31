"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Coffee, Info, Lightbulb, Send, TrendingUp, UtensilsCrossed } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BRANDS, BRAND_MARGIN, foodCostPct, foodCostStatus, type Brand } from "@/lib/hpp/calc";
import { KpiCarousel, type Kpi } from "@/components/dashboard/kpi-card";
import { Reveal } from "@/components/hpp/motion";
import { HppSalesPanel, type SalesMenu, type SalesRowLite } from "@/components/hpp/hpp-sales-panel";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const cat = (c: string): "makanan" | "minuman" => (c === "makanan" ? "makanan" : "minuman");
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;

export type DashMenu = { id: string; name: string; brand: string; category: string; status: string; statusLabel: string; statusTone: string; hpp: number; price: number; variableCost: number; createdAt: string; reviewedAt: string | null };
type InsightTone = "bad" | "warn" | "info" | "good";
type Insight = { tone: InsightTone; text: string; href?: string; cta?: string };
const TONE_RANK: Record<InsightTone, number> = { bad: 0, warn: 1, info: 2, good: 3 };
export type DashIngredient = { id: string; name: string; region: string; from: number; to: number; alert: boolean; affected: number };

const STATUS_COLOR: Record<string, string> = { draft: "#94a3b8", submitted: "#3b82f6", verified: "#22c55e", rejected: "#ef4444" };
const STATUS_PILL: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  good: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  bad: "bg-red-500/12 text-red-600 dark:text-red-400",
};
const BUCKETS: { label: string; test: (p: number) => boolean; color: string }[] = [
  { label: "<25%", test: (p) => p > 0 && p < 25, color: "#10b981" },
  { label: "25–35%", test: (p) => p >= 25 && p <= 35, color: "#22c55e" },
  { label: "35–50%", test: (p) => p > 35 && p <= 50, color: "#f59e0b" },
  { label: "50–70%", test: (p) => p > 50 && p <= 70, color: "#f97316" },
  { label: ">70%", test: (p) => p > 70, color: "#ef4444" },
];
const DAY = 86_400_000;
const pctDelta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100));

export type DashSales = { configured: boolean; month: string | null; syncedAt: string | null; menus: SalesMenu[]; rows: SalesRowLite[] };

export function HppDashboard({ menus, ingredients, sales }: { menus: DashMenu[]; ingredients: DashIngredient[]; sales: DashSales }) {
  const [brand, setBrand] = React.useState<string>("all");
  const [now] = React.useState(() => Date.now());

  const brandsPresent = React.useMemo(() => BRANDS.filter((b) => menus.some((m) => m.brand === b)), [menus]);
  const fm = React.useMemo(() => (brand === "all" ? menus : menus.filter((m) => m.brand === brand)), [menus, brand]);

  const d = React.useMemo(() => {
    const priced = fm.filter((m) => m.price > 0);
    const fcOf = (m: DashMenu) => foodCostPct(m.variableCost, m.price);
    const marginOf = (m: DashMenu) => (m.price > 0 ? (m.price - m.hpp) / m.price : 0);
    const byStatus = (s: string) => fm.filter((m) => m.status === s).length;

    // 30d window vs previous 30d (creation & verification flow).
    const createdIn = (a: number, b: number) => fm.filter((m) => { const t = +new Date(m.createdAt); return t >= a && t < b; }).length;
    const verifiedIn = (a: number, b: number) => fm.filter((m) => m.status === "verified" && m.reviewedAt && (() => { const t = +new Date(m.reviewedAt!); return t >= a && t < b; })()).length;
    const newCur = createdIn(now - 30 * DAY, now + DAY), newPrev = createdIn(now - 60 * DAY, now - 30 * DAY);
    const verCur = verifiedIn(now - 30 * DAY, now + DAY), verPrev = verifiedIn(now - 60 * DAY, now - 30 * DAY);

    const overCount = priced.filter((m) => fcOf(m) > 0.7).length;
    const idealCount = priced.filter((m) => fcOf(m) > 0 && foodCostStatus(fcOf(m), cat(m.category)).tone === "good").length;
    const avgFc = priced.length ? priced.reduce((a, m) => a + fcOf(m), 0) / priced.length : 0;
    const avgMargin = priced.length ? priced.reduce((a, m) => a + marginOf(m), 0) / priced.length : 0;
    const alertsCount = ingredients.filter((i) => i.alert).length;

    // 6-month trend (created vs verified).
    const months: { label: string; dibuat: number; diverifikasi: number }[] = [];
    const base = new Date(now);
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const start = dt.getTime();
      const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 1).getTime();
      months.push({
        label: dt.toLocaleDateString("id-ID", { month: "short" }),
        dibuat: fm.filter((m) => { const t = +new Date(m.createdAt); return t >= start && t < end; }).length,
        diverifikasi: fm.filter((m) => m.status === "verified" && m.reviewedAt && (() => { const t = +new Date(m.reviewedAt!); return t >= start && t < end; })()).length,
      });
    }

    // Composite R&D health (0–100): verified rate · food-cost ideal rate · ingredient stability.
    const verifiedRate = fm.length ? byStatus("verified") / fm.length : 0;
    const fcHealth = priced.length ? idealCount / priced.length : 1;
    const stockHealth = ingredients.length ? (ingredients.length - alertsCount) / ingredients.length : 1;
    const health = Math.round((verifiedRate * 0.4 + fcHealth * 0.4 + stockHealth * 0.2) * 100);

    const kpis: Kpi[] = [
      { label: "Total Menu", value: String(fm.length), icon: "Calculator", tone: "brand", sub: "tersimpan", delta: { value: pctDelta(newCur, newPrev) } },
      { label: "Diverifikasi", value: String(byStatus("verified")), icon: "CheckCircle2", tone: "success", sub: `${verCur} bulan ini`, delta: { value: pctDelta(verCur, verPrev) } },
      { label: "Menunggu Verifikasi", value: String(byStatus("submitted")), icon: "Send", tone: "warning", sub: "perlu ditinjau" },
      { label: "Over Cost (>70%)", value: String(overCount), icon: "AlertTriangle", tone: "danger", sub: "wajib evaluasi" },
      { label: "Rata-rata Food Cost", value: `${(avgFc * 100).toFixed(1)}%`, icon: "Coins", tone: "cyan", sub: "menu berharga" },
      { label: "Rata-rata Margin", value: `${(avgMargin * 100).toFixed(0)}%`, icon: "TrendingUp", tone: "brand", sub: "kontribusi" },
      { label: "Total Bahan Baku", value: String(ingredients.length), icon: "Package", tone: "cyan", sub: "di master" },
      { label: "Bahan Naik >5%", value: String(alertsCount), icon: "AlertTriangle", tone: "amber", sub: alertsCount ? "perlu update HPP" : "stabil" },
    ];

    const dist = BUCKETS.map((b) => ({ label: b.label, color: b.color, jumlah: priced.filter((m) => b.test(fcOf(m) * 100)).length }));
    const byBrand = BRANDS.map((br) => {
      const rows = fm.filter((m) => m.brand === br);
      return { brand: br, jumlah: rows.length, avgHpp: rows.length ? Math.round(rows.reduce((a, m) => a + m.hpp, 0) / rows.length) : 0 };
    }).filter((b) => b.jumlah > 0);
    const status = (["draft", "submitted", "verified", "rejected"] as const).map((k) => ({ key: k, label: fm.find((m) => m.status === k)?.statusLabel ?? k, value: byStatus(k), color: STATUS_COLOR[k] }));
    const pending = fm.filter((m) => m.status === "submitted");
    const recent = [...fm].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

    // ---- Smart insights (deterministic, prioritised) ----
    const insights: Insight[] = [];
    if (overCount > 0) insights.push({ tone: "bad", text: `${overCount} menu over cost (>70%) — wajib dievaluasi harga jual atau biaya bahan.`, href: "/rnd/hpp/rekap", cta: "Tinjau" });
    const rejected = byStatus("rejected");
    if (rejected > 0) insights.push({ tone: "warn", text: `${rejected} menu ditolak F&B — perbaiki lalu ajukan ulang.`, href: "/rnd/hpp/rekap", cta: "Perbaiki" });
    if (alertsCount > 0) {
      const affected = ingredients.filter((i) => i.alert).reduce((a, i) => a + i.affected, 0);
      insights.push({ tone: "warn", text: `${alertsCount} bahan baku naik >5%${affected > 0 ? ` — memengaruhi ${affected} menu` : ""}. Hitung ulang HPP terkait.`, href: "/rnd/hpp/bahan", cta: "Update" });
    }
    for (const br of BRANDS) {
      const rows = priced.filter((m) => m.brand === br);
      if (!rows.length) continue;
      const m = rows.reduce((a, x) => a + marginOf(x), 0) / rows.length;
      const min = BRAND_MARGIN[br as Brand].min;
      if (m < min) insights.push({ tone: "warn", text: `Margin ${br} rata-rata ${(m * 100).toFixed(0)}% — di bawah minimum ${(min * 100).toFixed(0)}%.` });
    }
    if (priced.length && avgFc > 0.35) insights.push({ tone: "warn", text: `Rata-rata food cost ${(avgFc * 100).toFixed(1)}% di atas ideal 35%.` });
    const subCount = byStatus("submitted");
    if (subCount > 0) insights.push({ tone: "info", text: `${subCount} menu menunggu verifikasi tim F&B.`, href: "/rnd/hpp/rekap", cta: "Verifikasi" });
    if (fm.length === 0) insights.push({ tone: "info", text: "Belum ada menu. Mulai hitung di Kalkulator HPP.", href: "/rnd/hpp", cta: "Mulai" });
    if (insights.length === 0) insights.push({ tone: "good", text: "Semua indikator R&D sehat — tidak ada yang perlu ditindaklanjuti saat ini." });
    insights.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

    return { kpis, dist, byBrand, status, pending, recent, months, health, overCount, pricedCount: priced.length, insights };
  }, [fm, ingredients, now]);

  const statusTotal = d.status.reduce((s, x) => s + x.value, 0);
  const healthTone = d.health >= 75 ? "#22c55e" : d.health >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-4">
      {/* Brand filter */}
      <div className="scroll-fade-x -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
        {["all", ...brandsPresent].map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrand(b)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              brand === b ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {b === "all" ? "Semua Brand" : b}
          </button>
        ))}
      </div>

      <KpiCarousel items={d.kpis} />

      {/* Actual sales from ERP (ESB) vs HPP projection */}
      <HppSalesPanel configured={sales.configured} month={sales.month} syncedAt={sales.syncedAt} brand={brand} menus={sales.menus} sales={sales.rows} />

      {/* Smart insights & recommendations */}
      <Reveal className="glass rounded-2xl border border-border p-5">
        <CardTitle icon={Lightbulb} title="Insight & Rekomendasi" sub="Analisis otomatis — tindakan prioritas" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {d.insights.map((it, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3",
                it.tone === "bad" && "border-red-500/30 bg-red-500/[0.06]",
                it.tone === "warn" && "border-amber-500/30 bg-amber-500/[0.06]",
                it.tone === "info" && "border-blue-500/30 bg-blue-500/[0.06]",
                it.tone === "good" && "border-emerald-500/30 bg-emerald-500/[0.06]",
              )}
            >
              {it.tone === "good" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              ) : it.tone === "info" ? (
                <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
              ) : (
                <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", it.tone === "bad" ? "text-red-500" : "text-amber-500")} />
              )}
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
                {it.text}
                {it.href && (
                  <Link href={it.href} className="ml-1.5 inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-primary hover:underline">
                    {it.cta ?? "Buka"} <ArrowRight className="size-3" />
                  </Link>
                )}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Row: health gauge + trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={Activity} title="R&D Health Index" sub="Verifikasi · food cost · stok" />
          <div className="relative mx-auto mt-2 grid size-44 place-items-center">
            <svg viewBox="0 0 120 120" className="size-44 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--muted)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={healthTone} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(d.health / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`} className="transition-all duration-700" />
            </svg>
            <div className="absolute text-center">
              <p className="text-4xl font-bold tabular-nums text-foreground">{d.health}</p>
              <p className="text-[11px] text-muted-foreground">/ 100</p>
            </div>
          </div>
          <p className="mt-2 text-center text-[12px] font-medium" style={{ color: healthTone }}>
            {d.health >= 75 ? "Sehat" : d.health >= 50 ? "Perlu perhatian" : "Kritis"}
          </p>
        </Reveal>

        <Reveal delay={0.06} className="glass rounded-2xl border border-border p-5 lg:col-span-2">
          <CardTitle icon={TrendingUp} title="Tren 6 Bulan" sub="Menu dibuat vs diverifikasi" />
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.months} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDibuat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gVerif" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="dibuat" name="Dibuat" stroke="#8b5cf6" strokeWidth={2} fill="url(#gDibuat)" />
                <Area type="monotone" dataKey="diverifikasi" name="Diverifikasi" stroke="#22c55e" strokeWidth={2} fill="url(#gVerif)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </div>

      {/* Row: food cost dist + status donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="glass rounded-2xl border border-border p-5 lg:col-span-2">
          <CardTitle icon={BarChart3} title="Distribusi Food Cost" sub={`${d.pricedCount} menu berharga · ${d.overCount} over cost (>70%)`} />
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.dist} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tip} formatter={(v) => [`${v} menu`, "Jumlah"]} />
                <Bar dataKey="jumlah" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="jumlah" position="top" fill="#94a3b8" fontSize={11} />
                  {d.dist.map((x) => <Cell key={x.label} fill={x.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={ClipboardCheck} title="Status Menu" sub="Alur verifikasi" />
          <div className="relative mx-auto mt-2 h-36 w-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.status} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                  {d.status.map((s) => <Cell key={s.key} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={tip} formatter={(v, n) => [`${v} menu`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center"><p className="text-2xl font-bold tabular-nums text-foreground">{statusTotal}</p><p className="text-[10px] text-muted-foreground">total</p></div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {d.status.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Row: per-brand + pending queue */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="glass rounded-2xl border border-border p-5 lg:col-span-2">
          <CardTitle icon={TrendingUp} title="Rata-rata HPP per Brand" sub="HPP per produk di tiap brand" />
          <div className="mt-3 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byBrand} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="brand" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tip} formatter={(v, _n, p) => [`${rp(Number(v))} · ${p?.payload?.jumlah ?? 0} menu`, "Rata-rata HPP"]} />
                <Bar dataKey="avgHpp" radius={[6, 6, 0, 0]} fill="#8b5cf6">
                  <LabelList dataKey="avgHpp" position="top" fill="#94a3b8" fontSize={11} formatter={(v) => (Number(v) ? rp(Number(v)) : "")} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={Send} title="Antrian Verifikasi" sub={`${d.pending.length} menu menunggu`} />
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {d.pending.length === 0 ? (
              <div className="grid h-full min-h-[8rem] place-items-center text-center text-[13px] text-muted-foreground"><span className="flex flex-col items-center gap-1.5"><CheckCircle2 className="size-5 text-emerald-500" /> Tidak ada antrian</span></div>
            ) : d.pending.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                {cat(r.category) === "makanan" ? <UtensilsCrossed className="size-3.5 shrink-0 text-muted-foreground" /> : <Coffee className="size-3.5 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{r.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{r.brand}</span>
              </div>
            ))}
          </div>
          <Link href="/rnd/hpp/rekap" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Buka Database HPP <ArrowRight className="size-3.5" /></Link>
        </Reveal>
      </div>

      {/* Row: alerts + recent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={AlertTriangle} title="Bahan Baku Naik >5%" sub={`${ingredients.filter((i) => i.alert).length} bahan perlu perhatian`} />
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {ingredients.filter((i) => i.alert).length === 0 ? (
              <div className="grid h-full min-h-[6rem] place-items-center text-center text-[13px] text-muted-foreground"><span className="flex flex-col items-center gap-1.5"><CheckCircle2 className="size-5 text-emerald-500" /> Harga bahan stabil</span></div>
            ) : ingredients.filter((i) => i.alert).slice(0, 6).map((i) => (
              <div key={i.id} className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
                <TrendingUp className="size-3.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-foreground">{i.name}</p><p className="truncate text-[11px] text-muted-foreground">{i.region || "—"} · {rp(i.from)} → {rp(i.to)}</p></div>
                {i.affected > 0 && <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">{i.affected} menu</span>}
              </div>
            ))}
          </div>
          <Link href="/rnd/hpp/bahan" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Master Bahan Baku <ArrowRight className="size-3.5" /></Link>
        </Reveal>

        <Reveal delay={0.06} className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={ClipboardCheck} title="Menu Terbaru" sub="Perhitungan terakhir" />
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {d.recent.length === 0 ? (
              <div className="grid h-full min-h-[6rem] place-items-center text-center text-[13px] text-muted-foreground">Belum ada menu</div>
            ) : d.recent.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                {cat(r.category) === "makanan" ? <UtensilsCrossed className="size-3.5 shrink-0 text-muted-foreground" /> : <Coffee className="size-3.5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium text-foreground">{r.name}</p><p className="truncate text-[11px] text-muted-foreground">{r.brand} · HPP {rp(r.hpp)} · {rp(r.price)}</p></div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_PILL[r.statusTone] ?? STATUS_PILL.muted)}>{r.statusLabel}</span>
              </div>
            ))}
          </div>
          <Link href="/rnd/hpp" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">Kalkulator HPP <ArrowRight className="size-3.5" /></Link>
        </Reveal>
      </div>
    </div>
  );
}

function CardTitle({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="size-4 text-muted-foreground" /> {title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
