"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ClipboardCheck,
  Coffee,
  Layers,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { BRANDS, foodCostPct, foodCostStatus } from "@/lib/hpp/calc";
import { HPP_STATUS_META, STATUS_PILL } from "@/lib/hpp/status";
import { deleteHppAction, reviewHppAction, submitHppAction } from "@/lib/actions/hpp";
import type { HppRecord } from "@/lib/data/hpp";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const cat = (c: string): "makanan" | "minuman" => (c === "makanan" ? "makanan" : "minuman");

const BRAND_CHIP: Record<string, string> = {
  Nordu: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
  Cattu: "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-400",
  Busari: "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  "Lesung Pipi": "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-400",
};

type SortKey = "name" | "brand" | "hpp" | "price" | "margin" | "fc" | "status";
type Row = { r: HppRecord; fc: number; margin: number };

export function HppRekap({ records, canEdit, canVerify }: { records: HppRecord[]; canEdit: boolean; canVerify: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [overOnly, setOverOnly] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [busy, setBusy] = React.useState<string | null>(null);

  const rows = React.useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const filtered = records
      .map((r) => {
        const fc = foodCostPct(r.variableCost, r.chosenPrice);
        const margin = r.chosenPrice > 0 ? (r.chosenPrice - r.hpp) / r.chosenPrice : 0;
        return { r, fc, margin };
      })
      .filter(({ r, fc }) => {
        if (needle && !r.name.toLowerCase().includes(needle)) return false;
        if (brand !== "all" && r.brand !== brand) return false;
        if (category !== "all" && cat(r.category) !== category) return false;
        if (status !== "all" && r.status !== status) return false;
        if (overOnly && fc <= 0.7) return false;
        return true;
      });
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (row: Row): number | string => {
      switch (sortKey) {
        case "name": return row.r.name.toLowerCase();
        case "brand": return row.r.brand;
        case "hpp": return row.r.hpp;
        case "price": return row.r.chosenPrice;
        case "margin": return row.margin;
        case "fc": return row.fc;
        case "status": return row.r.status;
      }
    };
    return filtered.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [records, q, brand, category, status, overOnly, sortKey, sortDir]);

  const stats = React.useMemo(() => {
    let over = 0;
    let ideal = 0;
    let pending = 0;
    for (const r of records) {
      const fc = foodCostPct(r.variableCost, r.chosenPrice);
      if (fc > 0.7) over++;
      else if (fc > 0 && foodCostStatus(fc, cat(r.category)).tone === "good") ideal++;
      if (r.status === "submitted") pending++;
    }
    return { total: records.length, over, ideal, pending };
  }, [records]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" || k === "brand" ? "asc" : "desc");
    }
  };

  async function run(id: string, fn: () => Promise<{ error?: string; ok?: boolean }>, okMsg: string) {
    setBusy(id);
    try {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const submit = (r: HppRecord) => run(r.id, () => submitHppAction(r.id), "Diajukan ke tim F&B");
  const verify = (r: HppRecord) => run(r.id, () => reviewHppAction(r.id, "verified", ""), "Menu diverifikasi");
  const reject = (r: HppRecord) => {
    const note = typeof window !== "undefined" ? window.prompt(`Alasan menolak "${r.name}"?`) : "";
    if (note == null) return;
    if (!note.trim()) return toast.error("Beri catatan alasan penolakan.");
    run(r.id, () => reviewHppAction(r.id, "rejected", note), "Menu ditolak");
  };
  const del = (r: HppRecord) => {
    if (typeof window !== "undefined" && !window.confirm(`Hapus "${r.name}"?`)) return;
    run(r.id, () => deleteHppAction(r.id), "Dihapus");
  };

  const hasFilter = q || brand !== "all" || category !== "all" || status !== "all" || overOnly;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ClipboardCheck} label="Total Menu" value={String(stats.total)} />
        <StatTile icon={CheckCircle2} label="Food Cost Ideal" value={String(stats.ideal)} />
        <StatTile icon={AlertTriangle} label="Over Cost (>70%)" value={String(stats.over)} sub={stats.over > 0 ? "wajib evaluasi" : "aman"} />
        <StatTile icon={Send} label="Menunggu Verifikasi" value={String(stats.pending)} />
      </Reveal>

      {/* Toolbar */}
      <div className="glass space-y-2 rounded-2xl border border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama menu…"
            className="h-9 w-full rounded-lg border border-input bg-background/40 pl-8 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
          />
        </div>
        <div className="scroll-fade-x -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <div className="w-36 shrink-0">
            <Combobox portal searchable={false} matchTriggerWidth value={brand} onChange={setBrand} options={[{ value: "all", label: "Semua Brand" }, ...BRANDS.map((b) => ({ value: b, label: b }))]} />
          </div>
          <div className="w-40 shrink-0">
            <Combobox portal searchable={false} matchTriggerWidth value={category} onChange={setCategory} options={[{ value: "all", label: "Semua Kategori" }, { value: "makanan", label: "Makanan" }, { value: "minuman", label: "Minuman" }]} />
          </div>
          <div className="w-40 shrink-0">
            <Combobox portal searchable={false} matchTriggerWidth value={status} onChange={setStatus} options={[{ value: "all", label: "Semua Status" }, { value: "draft", label: "Draft" }, { value: "submitted", label: "Diajukan" }, { value: "verified", label: "Diverifikasi" }, { value: "rejected", label: "Ditolak" }]} />
          </div>
          <button
            type="button"
            onClick={() => setOverOnly((v) => !v)}
            className={cn(
              "h-9 shrink-0 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors",
              overOnly ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            Over cost saja
          </button>
        </div>
        <div className="flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
          <span>{rows.length} menu{hasFilter ? " (terfilter)" : ""}</span>
          {hasFilter && (
            <button type="button" onClick={() => { setQ(""); setBrand("all"); setCategory("all"); setStatus("all"); setOverOnly(false); }} className="font-medium text-foreground/70 hover:text-foreground">
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <Th label="Menu" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-4" />
                <Th label="Brand" k="brand" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="HPP" k="hpp" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Harga" k="price" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Margin" k="margin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Food Cost" k="fc" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {hasFilter ? "Tidak ada menu yang cocok dengan filter." : "Belum ada menu tersimpan. Buat di Kalkulator HPP."}
                  </td>
                </tr>
              )}
              {rows.map(({ r, fc, margin }) => {
                const fs = foodCostStatus(fc, cat(r.category));
                const meta = HPP_STATUS_META[r.status];
                const pct = Math.min(100, fc * 100);
                return (
                  <tr key={r.id} className="group border-b border-border/60 last:border-0 hover:bg-muted/25">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {r.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imageUrl} alt="" className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-border" />
                        ) : (
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                            {cat(r.category) === "makanan" ? <UtensilsCrossed className="size-4" /> : <Coffee className="size-4" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{r.name || "(tanpa nama)"}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{cat(r.category) === "makanan" ? "Makanan" : "Minuman"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", BRAND_CHIP[r.brand] ?? "bg-muted text-muted-foreground ring-border")}>{r.brand}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(r.hpp)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(r.chosenPrice)}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums font-medium", margin < 0.3 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                      {r.chosenPrice > 0 ? `${(margin * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", fs.tone === "good" && "bg-emerald-500", fs.tone === "warn" && "bg-amber-500", fs.tone === "bad" && "bg-red-500")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn("text-[11px] font-semibold tabular-nums", fs.tone === "good" && "text-emerald-600 dark:text-emerald-400", fs.tone === "warn" && "text-amber-600 dark:text-amber-400", fs.tone === "bad" && "text-red-600 dark:text-red-400")}>
                          {(fc * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_PILL[meta.tone])} title={r.reviewNote ?? undefined}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (r.status === "draft" || r.status === "rejected") && (
                          <IconBtn onClick={() => submit(r)} disabled={busy === r.id} title="Ajukan ke F&B" tone="info"><Send className="size-4" /></IconBtn>
                        )}
                        {canVerify && r.status === "submitted" && (
                          <>
                            <IconBtn onClick={() => verify(r)} disabled={busy === r.id} title="Verifikasi" tone="good"><CheckCircle2 className="size-4" /></IconBtn>
                            <IconBtn onClick={() => reject(r)} disabled={busy === r.id} title="Tolak" tone="bad"><XCircle className="size-4" /></IconBtn>
                          </>
                        )}
                        {canEdit && (
                          <IconBtn onClick={() => del(r)} disabled={busy === r.id} title="Hapus" tone="bad"><Trash2 className="size-4" /></IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <Layers className="size-3.5" /> Alur: R&D menyusun &amp; mengajukan (Draft → Diajukan), tim F&B memverifikasi atau menolak sebelum menu final.
      </p>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const activeSort = sortKey === k;
  return (
    <th className={cn("py-2.5 font-medium", align === "right" ? "px-3 text-right" : "px-3", className)}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground", activeSort && "text-foreground", align === "right" && "flex-row-reverse")}>
        {label}
        {activeSort ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

function IconBtn({ children, onClick, disabled, title, tone }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string; tone: "info" | "good" | "bad" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors disabled:opacity-40",
        tone === "info" && "hover:bg-blue-500/10 hover:text-blue-500",
        tone === "good" && "hover:bg-emerald-500/10 hover:text-emerald-500",
        tone === "bad" && "hover:bg-red-500/10 hover:text-red-500",
      )}
    >
      {children}
    </button>
  );
}
