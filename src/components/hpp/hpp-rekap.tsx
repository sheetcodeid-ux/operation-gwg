"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Coffee, Layers, Search, Send, Trash2, UtensilsCrossed, XCircle } from "lucide-react";
import { toast } from "sonner";
import { foodCostPct, foodCostStatus } from "@/lib/hpp/calc";
import { HPP_STATUS_META, STATUS_PILL } from "@/lib/hpp/status";
import { deleteHppAction, reviewHppAction, submitHppAction } from "@/lib/actions/hpp";
import type { HppRecord } from "@/lib/data/hpp";
import { StatTile } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const cat = (c: string): "makanan" | "minuman" => (c === "makanan" ? "makanan" : "minuman");

export function HppRekap({ records, canEdit, canVerify }: { records: HppRecord[]; canEdit: boolean; canVerify: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [brand, setBrand] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [overOnly, setOverOnly] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records
      .map((r) => ({ r, fc: foodCostPct(r.variableCost, r.chosenPrice) }))
      .filter(({ r, fc }) => {
        if (needle && !r.name.toLowerCase().includes(needle)) return false;
        if (brand !== "all" && r.brand !== brand) return false;
        if (category !== "all" && cat(r.category) !== category) return false;
        if (status !== "all" && r.status !== status) return false;
        if (overOnly && fc <= 0.7) return false;
        return true;
      });
  }, [records, q, brand, category, status, overOnly]);

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

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ClipboardCheck} label="Total Menu" value={String(stats.total)} />
        <StatTile icon={CheckCircle2} label="Food Cost Ideal" value={String(stats.ideal)} />
        <StatTile icon={AlertTriangle} label="Over Cost (>70%)" value={String(stats.over)} sub={stats.over > 0 ? "wajib evaluasi" : "aman"} />
        <StatTile icon={Send} label="Menunggu Verifikasi" value={String(stats.pending)} />
      </div>

      {/* Filters */}
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3">
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama menu…"
            className="h-9 w-full rounded-lg border border-input bg-background/40 pl-8 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
          />
        </div>
        <Select value={brand} onChange={setBrand} options={[["all", "Semua Brand"], ["Nordu", "Nordu"], ["Cattu", "Cattu"], ["Busari", "Busari"]]} />
        <Select value={category} onChange={setCategory} options={[["all", "Semua Kategori"], ["makanan", "Makanan"], ["minuman", "Minuman"]]} />
        <Select
          value={status}
          onChange={setStatus}
          options={[["all", "Semua Status"], ["draft", "Draft"], ["submitted", "Diajukan"], ["verified", "Diverifikasi"], ["rejected", "Ditolak"]]}
        />
        <button
          type="button"
          onClick={() => setOverOnly((v) => !v)}
          className={cn(
            "h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors",
            overOnly ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Over cost saja
        </button>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Menu</th>
                <th className="px-3 py-2.5 text-right font-medium">HPP</th>
                <th className="px-3 py-2.5 text-right font-medium">Harga</th>
                <th className="px-3 py-2.5 text-right font-medium">Food Cost</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Belum ada menu yang cocok dengan filter.
                  </td>
                </tr>
              )}
              {rows.map(({ r, fc }) => {
                const fs = foodCostStatus(fc, cat(r.category));
                const meta = HPP_STATUS_META[r.status];
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
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
                          <p className="truncate text-[11px] text-muted-foreground">
                            {r.brand} · {cat(r.category) === "makanan" ? "Makanan" : "Minuman"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(r.hpp)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{rp(r.chosenPrice)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          fs.tone === "good" && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
                          fs.tone === "warn" && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                          fs.tone === "bad" && "bg-red-500/12 text-red-600 dark:text-red-400",
                        )}
                      >
                        {(fc * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_PILL[meta.tone])} title={r.reviewNote ?? undefined}>
                        {meta.label}
                      </span>
                      {r.status === "rejected" && r.reviewNote && <p className="mt-0.5 max-w-[12rem] truncate text-[10px] text-red-500" title={r.reviewNote}>{r.reviewNote}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (r.status === "draft" || r.status === "rejected") && (
                          <IconBtn onClick={() => submit(r)} disabled={busy === r.id} title="Ajukan ke F&B" tone="info">
                            <Send className="size-4" />
                          </IconBtn>
                        )}
                        {canVerify && r.status === "submitted" && (
                          <>
                            <IconBtn onClick={() => verify(r)} disabled={busy === r.id} title="Verifikasi" tone="good">
                              <CheckCircle2 className="size-4" />
                            </IconBtn>
                            <IconBtn onClick={() => reject(r)} disabled={busy === r.id} title="Tolak" tone="bad">
                              <XCircle className="size-4" />
                            </IconBtn>
                          </>
                        )}
                        {canEdit && (
                          <IconBtn onClick={() => del(r)} disabled={busy === r.id} title="Hapus" tone="bad">
                            <Trash2 className="size-4" />
                          </IconBtn>
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

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 shrink-0 rounded-lg border border-input bg-background/40 px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
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
