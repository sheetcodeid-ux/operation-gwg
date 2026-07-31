"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Link2Off,
  Package,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { foodCostStatus } from "@/lib/hpp/calc";
import { Reveal } from "@/components/hpp/motion";
import { syncSalesAction } from "@/lib/actions/hpp-sales";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const rpShort = (n: number) => {
  const v = Math.round(n || 0);
  if (v >= 1_000_000) return "Rp " + (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1) + "jt";
  if (v >= 1_000) return "Rp " + Math.round(v / 1_000) + "rb";
  return rp(v);
};
const cat = (c: string): "makanan" | "minuman" => (c === "makanan" ? "makanan" : "minuman");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** HPP projection for a menu (subset of the record) used to score actual sales. */
export type SalesMenu = { name: string; brand: string; category: string; hpp: number; price: number; variableCost: number; targetSales: number };
/** One synced sales row from ESB. */
export type SalesRowLite = { name: string; category: string | null; qty: number; amount: number };

type Matched = {
  name: string;
  brand: string;
  category: string;
  qty: number;
  omzet: number;
  target: number; // projected monthly units
  varCost: number; // per-unit variable cost
  hpp: number;
  price: number;
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - +new Date(iso);
  if (diff < 60_000) return "baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return `${Math.floor(diff / 86_400_000)} hari lalu`;
}

export function HppSalesPanel({
  configured,
  month,
  syncedAt,
  brand,
  menus,
  sales,
}: {
  configured: boolean;
  month: string | null;
  syncedAt: string | null;
  brand: string;
  menus: SalesMenu[];
  sales: SalesRowLite[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const sync = React.useCallback(
    (silent = false) => {
      if (!silent) {
        setMsg(null);
        setErr(null);
      }
      start(async () => {
        const r = await syncSalesAction(month ?? undefined);
        if (r?.error) {
          if (!silent) setErr(r.error);
        } else {
          if (!silent) setMsg(`Tersinkron ${r?.count ?? 0} menu untuk ${r?.month ? monthLabel(r.month) : "bulan ini"}.`);
          router.refresh(); // re-fetch the server component so the synced rows show
        }
      });
    },
    [month, router],
  );

  // Near-real-time: auto-pull from the ERP when the panel opens (if stale) and
  // every 3 min while the tab is visible. True push isn't possible (external ERP),
  // so we poll from the open dashboard — enough to feel live for the R&D team.
  const AUTO_MS = 3 * 60_000;
  React.useEffect(() => {
    if (!configured) return;
    const stale = !syncedAt || Date.now() - +new Date(syncedAt) > AUTO_MS;
    // Defer the first pull so the page paints before the network call.
    const kick = stale ? setTimeout(() => sync(true), 400) : undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") sync(true);
    }, AUTO_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (kick) clearTimeout(kick);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, sync]);

  const d = React.useMemo(() => {
    const byName = new Map<string, SalesMenu>();
    for (const m of menus) byName.set(norm(m.name), m);

    const matched: Matched[] = [];
    const unmatched: { name: string; qty: number; omzet: number }[] = [];
    let omzetTotal = 0;
    let unitTotal = 0;

    for (const s of sales) {
      omzetTotal += s.amount;
      unitTotal += s.qty;
      const m = byName.get(norm(s.name));
      if (m && (brand === "all" || m.brand === brand)) {
        matched.push({ name: m.name, brand: m.brand, category: m.category, qty: s.qty, omzet: s.amount, target: m.targetSales, varCost: m.variableCost, hpp: m.hpp, price: m.price });
      } else if (!m) {
        unmatched.push({ name: s.name, qty: s.qty, omzet: s.amount });
      }
    }

    // Actual food-cost & margin computed on matched menus (we know their cost).
    const matchedOmzet = matched.reduce((a, x) => a + x.omzet, 0);
    const matchedVar = matched.reduce((a, x) => a + x.varCost * x.qty, 0);
    const matchedHppCost = matched.reduce((a, x) => a + x.hpp * x.qty, 0);
    const matchedUnits = matched.reduce((a, x) => a + x.qty, 0);
    const targetUnits = matched.reduce((a, x) => a + x.target, 0);
    const fcActual = matchedOmzet > 0 ? matchedVar / matchedOmzet : 0;
    const marginActual = matchedOmzet > 0 ? (matchedOmzet - matchedHppCost) / matchedOmzet : 0;
    const labaKotor = matchedOmzet - matchedHppCost;

    const top = [...matched].sort((a, b) => b.omzet - a.omzet).slice(0, 8);
    unmatched.sort((a, b) => b.omzet - a.omzet);

    return { matched, unmatched, omzetTotal, unitTotal, matchedOmzet, matchedUnits, targetUnits, fcActual, marginActual, labaKotor, top };
  }, [menus, sales, brand]);

  const attainment = d.targetUnits > 0 ? d.matchedUnits / d.targetUnits : 0;
  const hasMatch = d.matched.length > 0;

  return (
    <Reveal className="glass rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShoppingBag className="size-4 text-muted-foreground" /> Penjualan Aktual vs Proyeksi
            {configured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {configured ? (
              month ? (
                <>Data ERP ESB · {monthLabel(month)}{syncedAt && ` · disinkron ${relTime(syncedAt)}`}</>
              ) : (
                <>Terhubung ke ESB — belum ada data, klik Sync.</>
              )
            ) : (
              <>Belum tersambung ke ERP ESB.</>
            )}
          </p>
        </div>
        {configured && (
          <button
            type="button"
            onClick={() => sync()}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", pending && "animate-spin")} /> {pending ? "Menyinkron…" : "Sync sekarang"}
          </button>
        )}
      </div>

      {(msg || err) && (
        <p className={cn("mt-3 rounded-lg border px-3 py-2 text-[12px]", err ? "border-red-500/30 bg-red-500/[0.06] text-red-600 dark:text-red-400" : "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-600 dark:text-emerald-400")}>
          {err ?? msg}
        </p>
      )}

      {!configured ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
          <Link2Off className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-[13px] font-medium text-foreground">Integrasi ERP belum aktif</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
            Setel <code className="rounded bg-muted px-1 py-0.5 text-[11px]">ESB_USERNAME</code> dan{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">ESB_PASSWORD</code> di Environment Variables Vercel (pakai akun layanan khusus),
            lalu redeploy. Setelah itu penjualan aktual dari ESB akan muncul di sini untuk dibandingkan dengan proyeksi HPP.
          </p>
        </div>
      ) : d.matched.length === 0 && d.unmatched.length === 0 ? (
        <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-[13px] text-muted-foreground">
          <span className="flex flex-col items-center gap-1.5">
            <Package className="size-5" /> Belum ada data penjualan. Klik <span className="font-medium text-foreground">Sync sekarang</span> untuk menarik dari ESB.
          </span>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat icon={Coins} label="Omzet Aktual" value={rpShort(d.omzetTotal)} sub={`${d.unitTotal.toLocaleString("id-ID")} unit · seluruh ERP`} tone="brand" />
            <Stat
              icon={TrendingUp}
              label="Margin Aktual"
              value={hasMatch ? `${(d.marginActual * 100).toFixed(0)}%` : "—"}
              sub={hasMatch ? `laba kotor ${rpShort(d.labaKotor)}` : "butuh menu ber-HPP"}
              tone={!hasMatch ? "brand" : d.marginActual >= 0.3 ? "good" : "warn"}
            />
            <Stat
              icon={AlertTriangle}
              label="Food Cost Aktual"
              value={hasMatch ? `${(d.fcActual * 100).toFixed(1)}%` : "—"}
              sub={hasMatch ? (d.fcActual <= 0.35 ? "ideal ≤35%" : "di atas 35%") : `${d.matched.length} dari HPP`}
              tone={!hasMatch ? "brand" : d.fcActual > 0 && d.fcActual <= 0.35 ? "good" : d.fcActual > 0.5 ? "bad" : "warn"}
            />
            <Stat icon={Package} label="Capaian Target" value={d.targetUnits > 0 ? `${(attainment * 100).toFixed(0)}%` : "—"} sub={d.targetUnits > 0 ? `${d.matchedUnits}/${d.targetUnits} unit` : "target belum diisi"} tone={d.targetUnits === 0 ? "brand" : attainment >= 1 ? "good" : attainment >= 0.7 ? "warn" : "bad"} />
          </div>

          {/* Top sellers — actual vs projected */}
          {d.top.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                <Trophy className="size-3.5 text-amber-500" /> Menu Terlaris — Aktual vs Proyeksi
              </p>
              <div className="space-y-1.5">
                {d.top.map((m) => {
                  const fc = m.price > 0 ? m.varCost / m.price : 0;
                  const st = foodCostStatus(fc, cat(m.category));
                  const att = m.target > 0 ? m.qty / m.target : 0;
                  return (
                    <div key={m.name} className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{m.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{m.brand}</span>
                        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">{rpShort(m.omzet)}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {m.target > 0 ? (
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", att >= 1 ? "bg-emerald-500" : att >= 0.7 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.min(100, att * 100)}%` }} />
                          </div>
                        ) : (
                          <div className="h-1.5 min-w-0 flex-1 rounded-full bg-muted" />
                        )}
                        <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                          {m.qty} {m.target > 0 ? `/ ${m.target}` : ""} unit
                        </span>
                        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", st.tone === "good" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : st.tone === "bad" ? "bg-red-500/12 text-red-600 dark:text-red-400" : "bg-amber-500/12 text-amber-600 dark:text-amber-400")}>
                          FC {(fc * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Menus sold in ERP without an HPP record */}
          {d.unmatched.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5" /> {d.unmatched.length} menu terjual tanpa HPP
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Menu ini ada penjualan di ERP tapi belum punya perhitungan HPP: {d.unmatched.slice(0, 6).map((u) => u.name).join(", ")}
                {d.unmatched.length > 6 && `, +${d.unmatched.length - 6} lain`}. Buat HPP-nya agar bisa dinilai food cost & marginnya.
              </p>
              <Link href="/rnd/hpp" className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                Buat HPP <ArrowRight className="size-3.5" />
              </Link>
            </div>
          )}

          {d.matched.length === 0 && d.unmatched.length > 0 && (
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <CheckCircle2 className="size-3.5" /> Belum ada menu terjual yang cocok dengan HPP{brand !== "all" ? ` brand ${brand}` : ""}.
            </p>
          )}
        </div>
      )}
    </Reveal>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; tone: "brand" | "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-red-600 dark:text-red-400",
          tone === "brand" && "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
