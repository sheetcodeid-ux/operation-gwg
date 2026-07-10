"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { foodCostPct } from "@/lib/hpp/calc";
import type { HppRecord } from "@/lib/data/hpp";
import { Reveal } from "@/components/hpp/motion";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

const BUCKETS: { label: string; test: (pct: number) => boolean; color: string }[] = [
  { label: "<25%", test: (p) => p > 0 && p < 25, color: "#10b981" },
  { label: "25–35%", test: (p) => p >= 25 && p <= 35, color: "#22c55e" },
  { label: "35–50%", test: (p) => p > 35 && p <= 50, color: "#f59e0b" },
  { label: "50–70%", test: (p) => p > 50 && p <= 70, color: "#f97316" },
  { label: ">70%", test: (p) => p > 70, color: "#ef4444" },
];

export function HppAnalytics({ records }: { records: HppRecord[] }) {
  const priced = React.useMemo(() => records.filter((r) => r.chosenPrice > 0), [records]);

  const dist = React.useMemo(() => {
    return BUCKETS.map((b) => ({
      label: b.label,
      color: b.color,
      jumlah: priced.filter((r) => b.test(foodCostPct(r.variableCost, r.chosenPrice) * 100)).length,
    }));
  }, [priced]);

  const byBrand = React.useMemo(() => {
    return (["Nordu", "Cattu", "Busari"] as const).map((brand) => {
      const rows = records.filter((r) => r.brand === brand);
      const avgHpp = rows.length ? Math.round(rows.reduce((s, r) => s + r.hpp, 0) / rows.length) : 0;
      return { brand, avgHpp, jumlah: rows.length };
    });
  }, [records]);

  const overCount = priced.filter((r) => foodCostPct(r.variableCost, r.chosenPrice) > 0.7).length;

  if (records.length === 0) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Reveal className="glass rounded-2xl border border-border p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 text-muted-foreground" /> Distribusi Food Cost
        </p>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {priced.length} menu berharga · {overCount} over cost (&gt;70%). Ideal makanan ≤35%, minuman 25–35%.
        </p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dist} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.1)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v) => [`${v} menu`, "Jumlah"]}
              />
              <Bar dataKey="jumlah" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="jumlah" position="top" fill="#94a3b8" fontSize={11} />
                {dist.map((d) => (
                  <Cell key={d.label} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="glass rounded-2xl border border-border p-5">
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="size-4 text-muted-foreground" /> Rata-rata HPP per Brand
        </p>
        <p className="mb-3 text-[11px] text-muted-foreground">Rata-rata Harga Pokok Produksi per produk di tiap brand.</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byBrand} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="brand" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.1)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v, _n, p) => [`${rp(Number(v))} · ${p?.payload?.jumlah ?? 0} menu`, "Rata-rata HPP"]}
              />
              <Bar dataKey="avgHpp" radius={[6, 6, 0, 0]} fill="#8b5cf6">
                <LabelList dataKey="avgHpp" position="top" fill="#94a3b8" fontSize={11} formatter={(v) => (Number(v) ? rp(Number(v)) : "")} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Reveal>
    </div>
  );
}
