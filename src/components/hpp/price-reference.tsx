"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { cn, formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { syncEsbMenuAction } from "@/lib/actions/hpp";
import type { PriceCompareRow, PriceStatus } from "@/lib/data/price-compare";
import { pesanRingkas } from "@/lib/pesan-galat";

const STATUS: Record<PriceStatus, { label: string; cls: string }> = {
  above: { label: "Harga ESB > HPP", cls: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" },
  below: { label: "Harga ESB < HPP", cls: "bg-red-500/12 text-red-600 dark:text-red-400" },
  match: { label: "Setara HPP", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  no_hpp: { label: "Belum ada HPP", cls: "bg-muted text-muted-foreground" },
  no_esb: { label: "Manual / tak ada di ESB", cls: "bg-muted text-muted-foreground" },
};

const nf = (n: number | null) => (n == null ? "—" : formatIDR(n));
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1).replace(".", ",")}%`);

type SortKey = "menu" | "esbPrice" | "latestHpp" | "hppPct" | "diff" | "qty";

export function PriceReference({ initial, esbSyncedAt, canSync }: { initial: PriceCompareRow[]; esbSyncedAt: string | null; canSync: boolean }) {
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState("all");
  const [cat, setCat] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("diff");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [syncing, startSync] = React.useTransition();

  const brands = React.useMemo(() => [...new Set(initial.map((r) => r.brand).filter(Boolean) as string[])].sort(), [initial]);

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = initial.filter((r) => {
      if (s && !r.menu.toLowerCase().includes(s)) return false;
      if (brand !== "all" && r.brand !== brand) return false;
      if (cat !== "all" && r.category !== cat) return false;
      if (status === "above" && r.status !== "above") return false;
      if (status === "below" && r.status !== "below") return false;
      if (status === "no_hpp" && r.status !== "no_hpp") return false;
      return true;
    });
    const val = (r: PriceCompareRow): string | number => {
      switch (sortKey) {
        case "menu": return r.menu.toLowerCase();
        case "esbPrice": return r.esbPrice ?? -1;
        case "latestHpp": return r.latestHpp ?? -1;
        case "hppPct": return r.hppPct ?? -1;
        case "qty": return r.esbQty30d;
        default: return r.diff ?? Number.NEGATIVE_INFINITY;
      }
    };
    const m = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * m;
    });
  }, [initial, q, brand, cat, status, sortKey, dir]);

  const stats = React.useMemo(() => {
    const withHpp = initial.filter((r) => r.latestHpp != null);
    return {
      total: initial.length,
      below: initial.filter((r) => r.status === "below").length,
      noHpp: initial.filter((r) => r.status === "no_hpp").length,
      withHpp: withHpp.length,
    };
  }, [initial]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setDir(k === "menu" ? "asc" : "desc"); }
  };
  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-2.5 py-2", className)}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground">
        {children}
        {sortKey === k ? (dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );

  const sync = () =>
    startSync(async () => {
      const res = await syncEsbMenuAction();
      if ("error" in res && res.error) { toast.error(pesanRingkas(res.error)); return; }
      const r = res as { menus?: number; complete?: boolean };
      toast.success(`Katalog ESB tersinkron — ${r.menus ?? 0} menu${r.complete === false ? " (sebagian, lanjut otomatis)" : ""}`);
    });

  return (
    <div className="space-y-3">
      {/* Controls — swipeable on mobile */}
      <div className="glass rounded-2xl border border-border p-3.5">
        <div className="flex items-end gap-3 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
          <div className="w-52 shrink-0 sm:w-auto sm:flex-1">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Cari produk</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama menu…" className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring" />
          </div>
          <div className="shrink-0">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Brand</p>
            <Combobox portal matchTriggerWidth searchable={false} value={brand} onChange={setBrand} options={[{ value: "all", label: "Semua brand" }, ...brands.map((b) => ({ value: b, label: b }))]} className="w-36" />
          </div>
          <div className="shrink-0">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Kategori</p>
            <Combobox portal matchTriggerWidth searchable={false} value={cat} onChange={setCat} options={[{ value: "all", label: "Food & Beverage" }, { value: "makanan", label: "Food" }, { value: "minuman", label: "Beverage" }]} className="w-40" />
          </div>
          <div className="shrink-0">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Status</p>
            <Combobox portal matchTriggerWidth searchable={false} value={status} onChange={setStatus} options={[{ value: "all", label: "Semua status" }, { value: "below", label: "ESB < HPP (rugi)" }, { value: "above", label: "ESB > HPP" }, { value: "no_hpp", label: "Belum ada HPP" }]} className="w-40" />
          </div>
          {canSync && (
            <div className="shrink-0">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">&nbsp;</p>
              <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sinkron ESB
              </Button>
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>{stats.total} produk · {stats.withHpp} punya HPP</span>
          {stats.below > 0 && <span className="text-red-600 dark:text-red-400">{stats.below} harga ESB di bawah HPP</span>}
          {stats.noHpp > 0 && <span>{stats.noHpp} belum dikosting</span>}
          {esbSyncedAt && <span className="ml-auto">Katalog ESB: {new Date(esbSyncedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>

      {initial.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl border border-border px-6 py-12 text-center">
          <CheckCircle2 className="size-8 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">Katalog ESB belum tersinkron</p>
          <p className="max-w-md text-sm text-muted-foreground">Data produk ESB diambil otomatis setiap jam. {canSync ? "Atau klik Sinkron ESB untuk menariknya sekarang." : "Hubungi Head R&D untuk menyinkron."}</p>
        </div>
      ) : (
        <div className="glass -mx-4 overflow-hidden border-y border-border sm:mx-0 sm:rounded-2xl sm:border">
          <div className="max-h-[70vh] overflow-auto overscroll-contain">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Th k="menu" className="sticky left-0 top-0 z-30 border-b border-border bg-background text-left">Produk</Th>
                  <th className="sticky top-0 z-20 border-b border-border bg-background px-2.5 py-2 text-left font-medium">Brand · Class</th>
                  <th className="sticky top-0 z-20 border-b border-border bg-background px-2.5 py-2 text-left font-medium">Kat.</th>
                  <Th k="esbPrice" className="sticky top-0 z-20 border-b border-border bg-background text-right">Harga ESB</Th>
                  <Th k="latestHpp" className="sticky top-0 z-20 border-b border-border bg-background text-right">HPP Terbaru</Th>
                  <Th k="hppPct" className="sticky top-0 z-20 border-b border-border bg-background text-right">HPP %</Th>
                  <Th k="diff" className="sticky top-0 z-20 border-b border-border bg-background text-right">Selisih</Th>
                  <Th k="qty" className="sticky top-0 z-20 border-b border-border bg-background text-right">Qty 30h</Th>
                  <th className="sticky top-0 z-20 border-b border-border bg-background px-2.5 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS[r.status];
                  return (
                    <tr key={r.menu} className="border-b border-border/50 transition-colors last:border-0 hover:bg-foreground/[0.03]">
                      <td className="sticky left-0 z-10 max-w-[12rem] truncate bg-background px-2.5 py-1.5 font-medium text-foreground">{r.menu}</td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">{r.brand ?? "—"}{r.className !== "—" ? ` · ${r.className}` : ""}</td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">{r.category === "minuman" ? "Bev" : "Food"}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{nf(r.esbPrice)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{nf(r.latestHpp)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{pct(r.hppPct)}</td>
                      <td className={cn("px-2.5 py-1.5 text-right tabular-nums", r.diff == null ? "text-muted-foreground/40" : r.diff < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                        {r.diff == null ? "—" : `${r.diff >= 0 ? "+" : ""}${formatIDR(r.diff)}`}
                        {r.diffPct != null && <span className="ml-1 text-[10px] opacity-70">({r.diffPct >= 0 ? "+" : ""}{(r.diffPct * 100).toFixed(0)}%)</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{r.esbQty30d.toLocaleString("id-ID")}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", st.cls)}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada produk yang cocok dengan filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Harga ESB = unit price rata-rata (tanpa pajak, sebanding dengan harga jual HPP). <b className="text-red-600 dark:text-red-400">ESB &lt; HPP</b> berarti produk terjual di bawah biaya pokok — perlu evaluasi harga/HPP.
      </p>
    </div>
  );
}
