"use client";

import * as React from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import type { CompetitorInsight } from "@/lib/data/hpp-competitors";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 } as const;

const POSITION_COLOR = { mahal: "#ef4444", kompetitif: "#22c55e", murah: "#3b82f6" } as const;
const POSITION_LABEL = { mahal: "Di atas pasar", kompetitif: "Kompetitif", murah: "Di bawah pasar" } as const;

/**
 * Analytics tingkat lanjut — untuk membaca posisi harga sebagai portofolio,
 * bukan menu per menu.
 *
 * Tiga pertanyaan yang dijawab di sini:
 *  1. Sebaran posisi harga kita — banyak yang kemahalan, atau justru kemurahan?
 *  2. Menu mana yang paling jauh menyimpang, ke dua arah?
 *  3. Berapa uang yang tertinggal di meja karena menu dijual di bawah pasar?
 */
export function HppCompetitorAnalytics({ insights }: { insights: CompetitorInsight[] }) {
  const tracked = React.useMemo(() => insights.filter((i) => i.samples > 0 && i.ourPrice > 0), [insights]);

  const d = React.useMemo(() => {
    const buckets = { mahal: 0, kompetitif: 0, murah: 0 };
    for (const i of tracked) if (i.position in buckets) buckets[i.position as keyof typeof buckets]++;
    const donut = (Object.keys(buckets) as (keyof typeof buckets)[])
      .map((k) => ({ key: k, name: POSITION_LABEL[k], value: buckets[k], color: POSITION_COLOR[k] }))
      .filter((x) => x.value > 0);

    // Simpangan terbesar ke dua arah — ini yang paling mendesak ditinjau.
    const sorted = [...tracked].sort((a, b) => b.gapPct - a.gapPct);
    const top = sorted.slice(0, 5);
    const bottom = sorted.slice(-5).reverse();
    const deviation = [...top, ...bottom]
      .filter((v, idx, arr) => arr.findIndex((x) => x.menuName === v.menuName) === idx)
      .map((i) => ({ name: i.menuName.length > 22 ? `${i.menuName.slice(0, 21)}…` : i.menuName, gap: Math.round(i.gapPct * 1000) / 10 }))
      .sort((a, b) => b.gap - a.gap);

    // Potensi kenaikan: selisih ke rata-rata pasar untuk menu yang kemurahan.
    const upside = tracked.filter((i) => i.position === "murah").reduce((sum, i) => sum + (i.avg - i.ourPrice), 0);
    // Risiko: menu kemahalan yang TIDAK bisa ikut pasar tanpa jadi over cost.
    const stuck = tracked.filter((i) => i.position === "mahal" && i.hpp > 0 && !i.canMatchMarket);
    const avgGap = tracked.length ? tracked.reduce((a, b) => a + b.gapPct, 0) / tracked.length : 0;
    // Menu yang punya usulan harga aman dan berbeda dari harga sekarang.
    const actionable = tracked.filter((i) => i.recommended && i.recommended.price !== Math.round(i.ourPrice));

    return { donut, deviation, upside, stuck, avgGap, actionable };
  }, [tracked]);

  if (tracked.length === 0) {
    return (
      <div className="glass rounded-2xl border border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Analytics muncul setelah ada menu yang punya harga kita <i>dan</i> minimal satu pembanding.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Reveal className="grid gap-3 lg:grid-cols-3">
        {/* Sebaran posisi harga */}
        <div className="glass rounded-2xl border border-border p-5">
          <p className="text-sm font-semibold text-foreground">Sebaran Posisi Harga</p>
          <p className="mb-2 text-[11px] text-muted-foreground">{tracked.length} menu dipantau terhadap pasar</p>
          <div className="relative h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.donut} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                  {d.donut.map((x) => (
                    <Cell key={x.key} fill={x.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tip} formatter={(v, n) => [`${v} menu`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-semibold tabular-nums text-foreground">{tracked.length}</p>
                <p className="text-[10px] text-muted-foreground">menu</p>
              </div>
            </div>
          </div>
          <div className="mt-1 space-y-1">
            {d.donut.map((x) => (
              <div key={x.key} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: x.color }} />
                  <span className="truncate text-muted-foreground">{x.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {x.value} · {Math.round((x.value / tracked.length) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Simpangan terbesar */}
        <div className="glass rounded-2xl border border-border p-5 lg:col-span-2">
          <p className="text-sm font-semibold text-foreground">Simpangan Terbesar dari Pasar</p>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Positif = lebih mahal dari pasar · negatif = lebih murah. Ambang wajar ±10%.
          </p>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.deviation} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tip} formatter={(v) => [`${v}%`, "Selisih vs pasar"]} />
                <Bar dataKey="gap" radius={[0, 4, 4, 0]}>
                  {d.deviation.map((x) => (
                    <Cell key={x.name} fill={x.gap > 10 ? POSITION_COLOR.mahal : x.gap < -10 ? POSITION_COLOR.murah : POSITION_COLOR.kompetitif} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Reveal>

      <Reveal className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Insight
          icon={TrendingUp}
          tone={Math.abs(d.avgGap) > 0.1 ? "warn" : "good"}
          label="Posisi rata-rata"
          value={pct(d.avgGap)}
          note={
            Math.abs(d.avgGap) <= 0.1
              ? "Secara keseluruhan sejajar pasar"
              : d.avgGap > 0
                ? "Rata-rata harga kita di atas pasar"
                : "Rata-rata harga kita di bawah pasar"
          }
        />
        <Insight
          icon={TrendingDown}
          tone={d.upside > 0 ? "info" : "good"}
          label="Potensi kenaikan"
          value={rp(d.upside)}
          note={
            d.upside > 0
              ? "Selisih ke rata-rata pasar dari menu yang dijual kemurahan (per satu porsi terjual)"
              : "Tidak ada menu yang tertinggal di bawah pasar"
          }
        />
        <Insight
          icon={AlertTriangle}
          tone={d.stuck.length > 0 ? "bad" : "good"}
          label="Terkunci biaya"
          value={String(d.stuck.length)}
          note={
            d.stuck.length > 0
              ? "Kemahalan tapi tidak bisa turun — HPP-nya akan jadi over cost. Tekan biaya bahan dulu."
              : "Semua menu kemahalan masih bisa diturunkan dengan aman"
          }
        />
        <Insight
          icon={TrendingUp}
          tone={d.actionable.length > 0 ? "warn" : "good"}
          label="Perlu penyesuaian"
          value={String(d.actionable.length)}
          note={d.actionable.length > 0 ? "Menu dengan usulan harga aman yang berbeda dari harga sekarang" : "Semua harga sudah pada posisi yang disarankan"}
        />
      </Reveal>

      {d.actionable.length > 0 && (
        <div className="glass overflow-hidden rounded-2xl border border-border">
          <div className="border-b border-border p-4">
            <p className="text-sm font-semibold text-foreground">Daftar Penyesuaian Harga</p>
            <p className="text-[11px] text-muted-foreground">
              Usulan yang sudah lolos uji HPP — margin tetap di atas minimum dan HPP tidak menembus batas merah.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Menu</th>
                  <th className="px-3 py-2.5 text-right font-medium">Harga kita</th>
                  <th className="px-3 py-2.5 text-right font-medium">Pasar</th>
                  <th className="px-3 py-2.5 text-right font-medium">Usulan</th>
                  <th className="px-3 py-2.5 text-right font-medium">Perubahan</th>
                  <th className="px-3 py-2.5 font-medium">Dasar</th>
                </tr>
              </thead>
              <tbody>
                {d.actionable.map((i) => {
                  const rec = i.recommended!;
                  const naik = rec.price > i.ourPrice;
                  return (
                    <tr key={i.menuId ?? i.menuName} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{i.menuName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {i.brand} · {POSITION_LABEL[i.position as keyof typeof POSITION_LABEL] ?? "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{rp(i.ourPrice)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{rp(i.avg)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{rp(rec.price)}</td>
                      <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", naik ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                        {naik ? "+" : "−"}
                        {rp(Math.abs(rec.price - i.ourPrice))}
                        <span className="block text-[10px] font-normal opacity-80">{pct(rec.price / i.ourPrice - 1)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                        {rec.label} · HPP {(rec.hppPct * 100).toFixed(0)}% · margin {(rec.margin * 100).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Insight({
  icon: Icon,
  tone,
  label,
  value,
  note,
}: {
  icon: typeof TrendingUp;
  tone: "good" | "warn" | "bad" | "info";
  label: string;
  value: string;
  note: string;
}) {
  const color =
    tone === "bad"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "info"
          ? "text-blue-600 dark:text-blue-400"
          : "text-emerald-600 dark:text-emerald-400";
  return (
    <div className="card-gradient flex h-full flex-col rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
          <Icon className={cn("size-4", color)} />
        </div>
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{label}</span>
      </div>
      <p className={cn("mt-3 text-2xl font-semibold tabular-nums", color)}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}
