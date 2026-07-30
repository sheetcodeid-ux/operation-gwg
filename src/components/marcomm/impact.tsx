"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Crown, Info, TrendingDown, Wallet } from "lucide-react";
import {
  fmtRupiah,
  MC_TYPE_META,
  VERDICT_META,
  type EventImpact,
} from "@/lib/marcomm-shared";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export function ImpactView({ impacts }: { impacts: EventImpact[] }) {
  if (impacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        Belum ada event yang disetujui & diklasifikasi. ACC event dulu di tab “ACC &amp; Klasifikasi”, lalu analisis dampaknya muncul di sini.
      </div>
    );
  }

  const totalBudget = impacts.reduce((s, e) => s + e.budget, 0);
  const totalUplift = impacts.reduce((s, e) => s + e.uplift, 0);
  const totalNet = impacts.reduce((s, e) => s + e.net, 0);
  const impactful = impacts.filter((e) => e.verdict === "impactful").length;

  const best = impacts[0];
  const worst = impacts[impacts.length - 1];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Wallet} label="Total Budget" value={fmtRupiah(totalBudget)} sub={`${impacts.length} event`} />
        <StatTile icon={ArrowUpRight} label="Total Uplift Omzet" value={fmtRupiah(totalUplift)} sub="vs baseline" />
        <StatTile icon={TrendingDown} label="Dampak Bersih" value={fmtRupiah(totalNet)} sub="uplift − budget" />
        <StatTile icon={Crown} label="Event Berdampak" value={`${impactful}/${impacts.length}`} sub="ROI positif" />
      </div>

      {/* Best / worst highlight */}
      {impacts.length > 1 && (best.uplift !== 0 || worst.uplift !== 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Highlight tone="good" title="Paling Berdampak" e={best} />
          <Highlight tone="bad" title="Kurang Berdampak" e={worst} />
        </div>
      )}

      <p className="text-sm font-semibold text-foreground">Peringkat Dampak Event</p>
      <div className="space-y-2.5">
        {impacts.map((e, i) => (
          <ImpactCard key={e.eventId} e={e} rank={i + 1} />
        ))}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Dampak diukur dari omzet selama periode event dibanding periode setara sebelumnya (baseline). Event outlet memakai omzet harian; promo memakai penjualan produk bulanan. ROI = uplift ÷ budget.
      </p>
    </div>
  );
}

function Highlight({ tone, title, e }: { tone: "good" | "bad"; title: string; e: EventImpact }) {
  return (
    <div className={cn("card-gradient rounded-xl p-4 ring-1", tone === "good" ? "ring-brand-500/25" : "ring-red-500/20")}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {tone === "good" ? <Crown className="size-3.5 text-amber-500" /> : <TrendingDown className="size-3.5 text-red-500" />} {title}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{e.name}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", e.uplift >= 0 ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400")}>
        {e.uplift >= 0 ? "+" : ""}{fmtRupiah(e.uplift)}
      </p>
      <p className="text-[11px] text-muted-foreground">uplift omzet · ROI {e.roi}× · budget {fmtRupiah(e.budget)}</p>
    </div>
  );
}

function ImpactCard({ e, rank }: { e: EventImpact; rank: number }) {
  const [open, setOpen] = React.useState(false);
  const v = VERDICT_META[e.verdict];
  const up = e.uplift >= 0;
  const max = Math.max(e.windowOmzet, e.baselineOmzet, 1);

  return (
    <div className="card-gradient rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-bold text-foreground ring-1 ring-border">{rank}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={MC_TYPE_META[e.type].tone}>{MC_TYPE_META[e.type].label}</Badge>
              <Badge tone={v.tone}>{v.label}</Badge>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">{e.name}</p>
            <p className="text-[11px] text-muted-foreground">{fmtDate(e.measureStart)} – {fmtDate(e.measureEnd)} · {e.days} hari · {e.omzetScope === "outlet" ? "omzet outlet" : e.type === "promo" ? "penjualan produk" : "omzet seluruh outlet"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold tabular-nums", up ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400")}>
            <span className="inline-flex items-center gap-0.5">{up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{up ? "+" : ""}{fmtRupiah(e.uplift)}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">ROI {e.roi}× · net {fmtRupiah(e.net)}</p>
        </div>
      </div>

      {/* window vs baseline bars */}
      <div className="mt-3 space-y-1.5">
        <Bar label="Periode Event" value={e.windowOmzet} max={max} tone="brand" />
        <Bar label="Baseline (sebelum)" value={e.baselineOmzet} max={max} tone="muted" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Budget: <span className="font-medium text-foreground">{fmtRupiah(e.budget)}</span></span>
        {e.baselineOmzet > 0 && <span>Pertumbuhan: <span className={cn("font-medium", up ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400")}>{up ? "+" : ""}{e.upliftPct}%</span></span>}
        {e.productBreakdown.length > 0 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium text-brand-600 hover:underline dark:text-brand-400">
            {open ? "Sembunyikan" : "Rincian produk"} ({e.productBreakdown.length})
          </button>
        )}
      </div>

      {open && e.productBreakdown.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border/60 pt-2">
          {e.productBreakdown.map((p) => (
            <div key={p.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">{p.name}</span>
              <span className={cn("shrink-0 tabular-nums", p.uplift >= 0 ? "text-brand-600 dark:text-brand-400" : "text-red-600 dark:text-red-400")}>
                {p.uplift >= 0 ? "+" : ""}{fmtRupiah(p.uplift)} <span className="text-muted-foreground">({fmtRupiah(p.windowOmzet)} vs {fmtRupiah(p.baselineOmzet)})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {e.note && <p className="mt-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">{e.note}</p>}
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "brand" | "muted" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone === "brand" ? "bg-brand-500" : "bg-muted-foreground/40")} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-foreground">{fmtRupiah(value)}</span>
    </div>
  );
}
