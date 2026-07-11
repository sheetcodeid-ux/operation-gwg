"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Coffee, Send, TrendingUp, UtensilsCrossed } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

export type DashData = {
  dist: { label: string; jumlah: number; color: string }[];
  byBrand: { brand: string; jumlah: number; avgHpp: number }[];
  status: { label: string; value: number; color: string; key: string }[];
  pending: { id: string; name: string; brand: string; category: string }[];
  alerts: { id: string; name: string; region: string; from: number; to: number; affected: number }[];
  recent: { id: string; name: string; brand: string; category: string; hpp: number; price: number; statusLabel: string; statusTone: string }[];
  overCount: number;
  pricedCount: number;
};

const STATUS_PILL: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  good: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  bad: "bg-red-500/12 text-red-600 dark:text-red-400",
};

export function HppDashboard({ data }: { data: DashData }) {
  const statusTotal = data.status.reduce((s, x) => s + x.value, 0);
  return (
    <div className="space-y-4">
      {/* Row 1: food cost distribution + status donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="glass rounded-2xl border border-border p-5 lg:col-span-2">
          <CardTitle icon={BarChart3} title="Distribusi Food Cost" sub={`${data.pricedCount} menu berharga · ${data.overCount} over cost (>70%)`} />
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dist} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.1)" }} contentStyle={tip} formatter={(v) => [`${v} menu`, "Jumlah"]} />
                <Bar dataKey="jumlah" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="jumlah" position="top" fill="#94a3b8" fontSize={11} />
                  {data.dist.map((d) => <Cell key={d.label} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={0.06} className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={ClipboardCheck} title="Status Menu" sub="Alur verifikasi" />
          <div className="relative mx-auto mt-2 h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.status} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">
                  {data.status.map((s) => <Cell key={s.key} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={tip} formatter={(v, n) => [`${v} menu`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{statusTotal}</p>
                <p className="text-[10px] text-muted-foreground">total menu</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {data.status.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Row 2: per-brand HPP + pending verification */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="glass rounded-2xl border border-border p-5 lg:col-span-2">
          <CardTitle icon={TrendingUp} title="Rata-rata HPP per Brand" sub="HPP per produk di tiap brand" />
          <div className="mt-3 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byBrand} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
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
          <div className="flex items-center justify-between">
            <CardTitle icon={Send} title="Antrian Verifikasi" sub={`${data.pending.length} menu menunggu`} />
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {data.pending.length === 0 ? (
              <div className="grid h-full min-h-[8rem] place-items-center text-center text-[13px] text-muted-foreground">
                <span className="flex flex-col items-center gap-1.5"><CheckCircle2 className="size-5 text-emerald-500" /> Tidak ada antrian</span>
              </div>
            ) : (
              data.pending.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                  {r.category === "makanan" ? <UtensilsCrossed className="size-3.5 shrink-0 text-muted-foreground" /> : <Coffee className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{r.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{r.brand}</span>
                </div>
              ))
            )}
          </div>
          <Link href="/rnd/hpp/rekap" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
            Buka Database HPP <ArrowRight className="size-3.5" />
          </Link>
        </Reveal>
      </div>

      {/* Row 3: ingredient alerts + recent menus */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={AlertTriangle} title="Bahan Baku Naik >5%" sub={`${data.alerts.length} bahan perlu perhatian`} />
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {data.alerts.length === 0 ? (
              <div className="grid h-full min-h-[6rem] place-items-center text-center text-[13px] text-muted-foreground">
                <span className="flex flex-col items-center gap-1.5"><CheckCircle2 className="size-5 text-emerald-500" /> Harga bahan stabil</span>
              </div>
            ) : (
              data.alerts.slice(0, 6).map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
                  <TrendingUp className="size-3.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{i.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{i.region || "—"} · {rp(i.from)} → {rp(i.to)}</p>
                  </div>
                  {i.affected > 0 && <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">{i.affected} menu</span>}
                </div>
              ))
            )}
          </div>
          <Link href="/rnd/hpp/bahan" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
            Master Bahan Baku <ArrowRight className="size-3.5" />
          </Link>
        </Reveal>

        <Reveal delay={0.06} className="glass flex flex-col rounded-2xl border border-border p-5">
          <CardTitle icon={ClipboardCheck} title="Menu Terbaru" sub="Perhitungan terakhir" />
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {data.recent.length === 0 ? (
              <div className="grid h-full min-h-[6rem] place-items-center text-center text-[13px] text-muted-foreground">Belum ada menu</div>
            ) : (
              data.recent.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                  {r.category === "makanan" ? <UtensilsCrossed className="size-3.5 shrink-0 text-muted-foreground" /> : <Coffee className="size-3.5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{r.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{r.brand} · HPP {rp(r.hpp)} · {rp(r.price)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_PILL[r.statusTone] ?? STATUS_PILL.muted)}>{r.statusLabel}</span>
                </div>
              ))
            )}
          </div>
          <Link href="/rnd/hpp" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
            Kalkulator HPP <ArrowRight className="size-3.5" />
          </Link>
        </Reveal>
      </div>
    </div>
  );
}

const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;

function CardTitle({ icon: Icon, title, sub }: { icon: React.ComponentType<{ className?: string }>; title: string; sub?: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-muted-foreground" /> {title}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
