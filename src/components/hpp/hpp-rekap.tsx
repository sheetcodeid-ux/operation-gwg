"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Coffee,
  Download,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Send,
  Square,
  Trash2,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { BRANDS, foodCostPct, foodCostStatus } from "@/lib/hpp/calc";
import { HPP_STATUS_META, STATUS_PILL, type StatusTone } from "@/lib/hpp/status";
import { bulkDeleteHppAction, bulkReviewHppAction, bulkSubmitHppAction, deleteHppAction, reviewHppAction, submitHppAction } from "@/lib/actions/hpp";
import type { HppRecord, HppStatus } from "@/lib/data/hpp";
import { downloadCsv, toCsv } from "@/lib/csv";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const cat = (c: string): "makanan" | "minuman" => (c === "makanan" ? "makanan" : "minuman");
const marginOf = (r: HppRecord) => (r.chosenPrice > 0 ? (r.chosenPrice - r.hpp) / r.chosenPrice : 0);

const BRAND_CHIP: Record<string, string> = {
  Nordu: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400",
  Cattu: "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-400",
  Busari: "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  "Lesung Pipi": "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-400",
};
const fcClass = (t: StatusTone | "good" | "warn" | "bad") =>
  t === "good" ? "text-emerald-600 dark:text-emerald-400" : t === "warn" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
const fcBar = (t: "good" | "warn" | "bad") => (t === "good" ? "bg-emerald-500" : t === "warn" ? "bg-amber-500" : "bg-red-500");

type SortKey = "name" | "brand" | "hpp" | "price" | "margin" | "fc" | "status";
type Row = { r: HppRecord; fc: number; margin: number };
const STATUS_TABS: { key: HppStatus | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Diajukan" },
  { key: "verified", label: "Diverifikasi" },
  { key: "rejected", label: "Ditolak" },
];

export function HppRekap({ records, canEdit, canVerify }: { records: HppRecord[]; canEdit: boolean; canVerify: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [statusTab, setStatusTab] = React.useState<HppStatus | "all">("all");
  const [overOnly, setOverOnly] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [view, setView] = React.useState<"table" | "cards">("table");
  const [detail, setDetail] = React.useState<HppRecord | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Filtered by everything EXCEPT status (so the status tabs can show counts).
  const baseFiltered = React.useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    return records
      .map((r) => ({ r, fc: foodCostPct(r.variableCost, r.chosenPrice), margin: marginOf(r) }))
      .filter(({ r, fc }) => {
        if (needle && !r.name.toLowerCase().includes(needle)) return false;
        if (brand !== "all" && r.brand !== brand) return false;
        if (category !== "all" && cat(r.category) !== category) return false;
        if (overOnly && fc <= 0.7) return false;
        return true;
      });
  }, [records, q, brand, category, overOnly]);

  const statusCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: baseFiltered.length, draft: 0, submitted: 0, verified: 0, rejected: 0 };
    for (const { r } of baseFiltered) c[r.status]++;
    return c;
  }, [baseFiltered]);

  const rows = React.useMemo<Row[]>(() => {
    const filtered = statusTab === "all" ? baseFiltered : baseFiltered.filter(({ r }) => r.status === statusTab);
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
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [baseFiltered, statusTab, sortKey, sortDir]);

  const stats = React.useMemo(() => {
    let over = 0, ideal = 0, pending = 0;
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
    else { setSortKey(k); setSortDir(k === "name" || k === "brand" ? "asc" : "desc"); }
  };

  async function run(id: string, fn: () => Promise<{ error?: string; ok?: boolean }>, okMsg: string) {
    setBusy(id);
    try {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else { toast.success(okMsg); setDetail(null); router.refresh(); }
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

  // ---- bulk selection ----
  const byId = React.useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const toggleRow = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = rows.length > 0 && rows.every(({ r }) => selected.has(r.id));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allShownSelected) rows.forEach(({ r }) => n.delete(r.id));
    else rows.forEach(({ r }) => n.add(r.id));
    return n;
  });
  const selArr = React.useMemo(() => [...selected].map((id) => byId.get(id)).filter((r): r is HppRecord => !!r), [selected, byId]);
  const selDraft = selArr.filter((r) => r.status === "draft" || r.status === "rejected").map((r) => r.id);
  const selSubmitted = selArr.filter((r) => r.status === "submitted").map((r) => r.id);

  async function bulk(fn: () => Promise<{ error?: string; count?: number }>, okMsg: (n: number) => string) {
    setBulkBusy(true);
    try {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else { toast.success(okMsg(res.count ?? 0)); setSelected(new Set()); router.refresh(); }
    } finally {
      setBulkBusy(false);
    }
  }
  const bulkSubmit = () => bulk(() => bulkSubmitHppAction(selDraft), (n) => `${n} menu diajukan ke F&B`);
  const bulkVerify = () => bulk(() => bulkReviewHppAction(selSubmitted, "verified", ""), (n) => `${n} menu diverifikasi`);
  const bulkReject = () => {
    const note = typeof window !== "undefined" ? window.prompt(`Alasan menolak ${selSubmitted.length} menu?`) : "";
    if (note == null) return;
    if (!note.trim()) return toast.error("Beri catatan alasan penolakan.");
    bulk(() => bulkReviewHppAction(selSubmitted, "rejected", note), (n) => `${n} menu ditolak`);
  };
  const bulkDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Hapus ${selArr.length} menu terpilih?`)) return;
    bulk(() => bulkDeleteHppAction(selArr.map((r) => r.id)), (n) => `${n} menu dihapus`);
  };

  function exportCsv() {
    const headers = ["Menu", "Brand", "Kategori", "Status", "HPP", "Harga", "Margin %", "Food Cost %"];
    const data = rows.map(({ r, fc, margin }) => [
      r.name, r.brand, cat(r.category) === "makanan" ? "Makanan" : "Minuman", HPP_STATUS_META[r.status].label,
      Math.round(r.hpp), Math.round(r.chosenPrice), r.chosenPrice > 0 ? (margin * 100).toFixed(0) : "-", (fc * 100).toFixed(1),
    ]);
    downloadCsv("database-hpp", toCsv(headers, data));
  }

  const hasFilter = q || brand !== "all" || category !== "all" || overOnly;

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
      <div className="glass space-y-2.5 rounded-2xl border border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama menu…"
              className="h-9 w-full rounded-lg border border-input bg-background/40 pl-8 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
            />
          </div>
          <div className="flex shrink-0 items-center rounded-lg border border-border p-0.5">
            <ViewBtn active={view === "table"} onClick={() => setView("table")} title="Tabel"><List className="size-4" /></ViewBtn>
            <ViewBtn active={view === "cards"} onClick={() => setView("cards")} title="Kartu"><LayoutGrid className="size-4" /></ViewBtn>
          </div>
          <button type="button" onClick={exportCsv} title="Export CSV" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground">
            <Download className="size-4" />
          </button>
        </div>

        {/* Status tabs with counts */}
        <div className="scroll-fade-x -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusTab === t.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t.label}
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{statusCounts[t.key]}</span>
            </button>
          ))}
        </div>

        <div className="scroll-fade-x -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <div className="w-36 shrink-0">
            <Combobox portal searchable={false} matchTriggerWidth value={brand} onChange={setBrand} options={[{ value: "all", label: "Semua Brand" }, ...BRANDS.map((b) => ({ value: b, label: b }))]} />
          </div>
          <div className="w-40 shrink-0">
            <Combobox portal searchable={false} matchTriggerWidth value={category} onChange={setCategory} options={[{ value: "all", label: "Semua Kategori" }, { value: "makanan", label: "Makanan" }, { value: "minuman", label: "Minuman" }]} />
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
          {hasFilter && (
            <button type="button" onClick={() => { setQ(""); setBrand("all"); setCategory("all"); setOverOnly(false); }} className="h-9 shrink-0 whitespace-nowrap rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="glass sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 p-3 shadow-lg">
          <span className="text-sm font-semibold text-foreground">{selArr.length} dipilih</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canEdit && selDraft.length > 0 && <Button size="sm" onClick={bulkSubmit} disabled={bulkBusy}><Send className="size-4" /> Ajukan ({selDraft.length})</Button>}
            {canVerify && selSubmitted.length > 0 && (
              <>
                <Button size="sm" onClick={bulkVerify} disabled={bulkBusy}><CheckCircle2 className="size-4" /> Verifikasi ({selSubmitted.length})</Button>
                <Button size="sm" variant="outline" onClick={bulkReject} disabled={bulkBusy}><XCircle className="size-4" /> Tolak</Button>
              </>
            )}
            {canEdit && <Button size="sm" variant="outline" onClick={bulkDelete} disabled={bulkBusy} className="text-red-500 hover:text-red-600"><Trash2 className="size-4" /> Hapus ({selArr.length})</Button>}
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">Batal</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="glass rounded-2xl border border-border px-4 py-12 text-center text-sm text-muted-foreground">
          {hasFilter || statusTab !== "all" ? "Tidak ada menu yang cocok dengan filter." : "Belum ada menu tersimpan. Buat di Kalkulator HPP."}
        </div>
      ) : view === "cards" ? (
        /* ---------- CARD / GALLERY VIEW ---------- */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ r, fc, margin }) => {
            const fs = foodCostStatus(fc, cat(r.category));
            const meta = HPP_STATUS_META[r.status];
            return (
              <button key={r.id} type="button" onClick={() => setDetail(r)} className="glass group flex flex-col overflow-hidden rounded-2xl border border-border text-left transition-colors hover:border-primary/40">
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      {cat(r.category) === "makanan" ? <UtensilsCrossed className="size-8" /> : <Coffee className="size-8" />}
                    </div>
                  )}
                  <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", BRAND_CHIP[r.brand] ?? "bg-muted text-muted-foreground ring-border")}>{r.brand}</span>
                  <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_PILL[meta.tone])}>{meta.label}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="truncate font-semibold text-foreground">{r.name || "(tanpa nama)"}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">HPP</span>
                    <span className="tabular-nums text-foreground">{rp(r.hpp)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Harga</span>
                    <span className="font-semibold tabular-nums text-foreground">{rp(r.chosenPrice)}</span>
                  </div>
                  <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", fcBar(fs.tone))} style={{ width: `${Math.min(100, fc * 100)}%` }} />
                    </div>
                    <span className={cn("text-[11px] font-semibold tabular-nums", fcClass(fs.tone))}>FC {(fc * 100).toFixed(0)}%</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">· M {r.chosenPrice > 0 ? `${(margin * 100).toFixed(0)}%` : "—"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ---------- TABLE VIEW ---------- */
        <div className="glass overflow-hidden rounded-2xl border border-border">
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <button type="button" onClick={toggleAll} title="Pilih semua" className="grid place-items-center text-muted-foreground hover:text-foreground">
                      {allShownSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>
                  </th>
                  <Th label="Menu" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-1" />
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
                {rows.map(({ r, fc, margin }) => {
                  const fs = foodCostStatus(fc, cat(r.category));
                  const meta = HPP_STATUS_META[r.status];
                  return (
                    <tr key={r.id} className={cn("group cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/25", selected.has(r.id) && "bg-primary/[0.06]")} onClick={() => setDetail(r)}>
                      <td className="w-10 px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => toggleRow(r.id)} className="grid place-items-center text-muted-foreground hover:text-foreground">
                          {selected.has(r.id) ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                        </button>
                      </td>
                      <td className="px-1 py-2.5">
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
                      <td className="px-3 py-2.5"><span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", BRAND_CHIP[r.brand] ?? "bg-muted text-muted-foreground ring-border")}>{r.brand}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(r.hpp)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(r.chosenPrice)}</td>
                      <td className={cn("px-3 py-2.5 text-right font-medium tabular-nums", margin < 0.3 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{r.chosenPrice > 0 ? `${(margin * 100).toFixed(0)}%` : "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", fcBar(fs.tone))} style={{ width: `${Math.min(100, fc * 100)}%` }} /></div>
                          <span className={cn("text-[11px] font-semibold tabular-nums", fcClass(fs.tone))}>{(fc * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_PILL[meta.tone])} title={r.reviewNote ?? undefined}>{meta.label}</span></td>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
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
                          {canEdit && <IconBtn onClick={() => del(r)} disabled={busy === r.id} title="Hapus" tone="bad"><Trash2 className="size-4" /></IconBtn>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        {detail && (
          <SheetContent title={detail.name || "(tanpa nama)"} description={`${detail.brand} · ${cat(detail.category) === "makanan" ? "Makanan" : "Minuman"}`}>
            <DetailBody r={detail} canEdit={canEdit} canVerify={canVerify} busy={busy === detail.id} onEdit={() => router.push(`/rnd/hpp?edit=${detail.id}`)} onSubmit={() => submit(detail)} onVerify={() => verify(detail)} onReject={() => reject(detail)} onDelete={() => del(detail)} />
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

function DetailBody({ r, canEdit, canVerify, busy, onEdit, onSubmit, onVerify, onReject, onDelete }: { r: HppRecord; canEdit: boolean; canVerify: boolean; busy: boolean; onEdit: () => void; onSubmit: () => void; onVerify: () => void; onReject: () => void; onDelete: () => void }) {
  const fc = foodCostPct(r.variableCost, r.chosenPrice);
  const fs = foodCostStatus(fc, cat(r.category));
  const margin = marginOf(r);
  const meta = HPP_STATUS_META[r.status];
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5" data-lenis-prevent>
        {r.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.imageUrl} alt="" className="aspect-video w-full rounded-xl object-cover ring-1 ring-border" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_PILL[meta.tone])}>{meta.label}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", fc > 0.7 ? "bg-red-500/12 " + fcClass("bad") : fs.tone === "good" ? "bg-emerald-500/12 " + fcClass("good") : "bg-amber-500/12 " + fcClass("warn"))}>Food cost {(fc * 100).toFixed(1)}% · {fs.label}</span>
        </div>
        {r.status === "rejected" && r.reviewNote && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-600 dark:text-red-400">
            <p className="font-semibold">Catatan penolakan F&B</p>
            <p className="mt-0.5">{r.reviewNote}</p>
          </div>
        )}
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <DRow label="Total HPP / produk" value={rp(r.hpp)} strong />
          <DRow label="Biaya Variabel Efektif" value={rp(r.variableCost)} />
          <DRow label={`Waste`} value={`${r.wastePct}%`} />
          <DRow label="BTKL / bulan (dapur/bar)" value={rp(r.btkl)} />
          <DRow label="Target penjualan / bulan" value={`${r.targetSales.toLocaleString("id-ID")} unit`} />
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <DRow label="Harga jual (tanpa pajak)" value={rp(r.chosenPrice)} strong />
          <DRow label="Margin" value={r.chosenPrice > 0 ? `${(margin * 100).toFixed(1)}%` : "—"} />
          <DRow label="Harga after-tax (referensi, PBJT 10%)" value={rp(r.chosenPrice * 1.1)} />
          <DRow label="Target laba bersih / bulan" value={rp(r.targetProfit)} />
        </div>
        <p className="text-[11px] text-muted-foreground">Dibuat {new Date(r.createdAt).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      {(canEdit || canVerify) && (
        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {canEdit && (
            <Button variant="outline" onClick={onEdit} disabled={busy} className="flex-1"><Pencil className="size-4" /> Edit di Kalkulator</Button>
          )}
          {canEdit && (r.status === "draft" || r.status === "rejected") && (
            <Button onClick={onSubmit} disabled={busy} className="flex-1"><Send className="size-4" /> Ajukan ke F&B</Button>
          )}
          {canVerify && r.status === "submitted" && (
            <>
              <Button onClick={onVerify} disabled={busy} className="flex-1"><CheckCircle2 className="size-4" /> Verifikasi</Button>
              <Button variant="outline" onClick={onReject} disabled={busy}><XCircle className="size-4" /> Tolak</Button>
            </>
          )}
          {canEdit && (
            <Button variant="outline" onClick={onDelete} disabled={busy} className="text-red-500 hover:text-red-600"><Trash2 className="size-4" /> Hapus</Button>
          )}
        </div>
      )}
    </>
  );
}

function DRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("shrink-0 tabular-nums", strong ? "font-bold text-foreground" : "text-foreground")}>{value}</span>
    </div>
  );
}

function ViewBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} className={cn("grid size-8 place-items-center rounded-md transition-colors", active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}

function Th({ label, k, sortKey, sortDir, onSort, align = "left", className }: { label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc"; onSort: (k: SortKey) => void; align?: "left" | "right"; className?: string }) {
  const activeSort = sortKey === k;
  return (
    <th className={cn("py-2.5 font-medium", align === "right" ? "px-3 text-right" : "px-3", className)}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onSort(k); }} className={cn("inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground", activeSort && "text-foreground", align === "right" && "flex-row-reverse")}>
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
