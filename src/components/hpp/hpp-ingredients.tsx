"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BellOff, Check, CheckSquare, Download, Package, Pencil, Plus, Search, Square, TrendingUp, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { saveIngredientAction, deleteIngredientAction, clearIngredientAlertAction, importIngredientsAction, bulkDeleteIngredientsAction, bulkClearAlertsAction } from "@/lib/actions/hpp-ingredients";
import type { HppIngredient } from "@/lib/data/hpp-ingredients";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
const UNITS = ["g", "kg", "ml", "L", "pcs"];
const perUnit = (i: { buyPrice: number; buyQty: number }) => (i.buyQty ? i.buyPrice / i.buyQty : i.buyPrice);

export type MenuUse = { id: string; name: string; ingredientIds: string[] };

type Form = { id?: string; name: string; buyPrice: string; buyQty: string; buyUnit: string; region: string };
const empty: Form = { name: "", buyPrice: "", buyQty: "1", buyUnit: "kg", region: "" };

type SortKey = "name" | "region" | "price" | "usage";

export function HppIngredients({ ingredients, menus, canEdit }: { ingredients: HppIngredient[]; menus: MenuUse[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [region, setRegion] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [form, setForm] = React.useState<Form>(empty);
  const [saving, setSaving] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [importing, setImporting] = React.useState(false);

  const usage = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const menu of menus) for (const ing of menu.ingredientIds) m.set(ing, [...(m.get(ing) ?? []), menu.name]);
    return m;
  }, [menus]);

  const regions = React.useMemo(() => [...new Set(ingredients.map((i) => i.region).filter((x): x is string => !!x))].sort(), [ingredients]);
  const alerts = ingredients.filter((i) => i.alert);
  const affectedMenus = new Set(alerts.flatMap((i) => usage.get(i.id) ?? [])).size;

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = ingredients.filter((i) => {
      if (region !== "all" && (i.region ?? "") !== region) return false;
      if (needle && !i.name.toLowerCase().includes(needle) && !(i.region ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (i: HppIngredient): number | string => {
      switch (sortKey) {
        case "name": return i.name.toLowerCase();
        case "region": return (i.region ?? "").toLowerCase();
        case "price": return perUnit(i);
        case "usage": return (usage.get(i.id) ?? []).length;
      }
    };
    return filtered.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [ingredients, q, region, sortKey, sortDir, usage]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "price" || k === "usage" ? "desc" : "asc");
    }
  };

  async function save() {
    if (!form.name.trim()) return toast.error("Isi nama bahan dulu.");
    setSaving(true);
    try {
      const res = await saveIngredientAction({
        id: form.id,
        name: form.name.trim(),
        buyPrice: num(form.buyPrice),
        buyQty: num(form.buyQty) || 1,
        buyUnit: form.buyUnit,
        region: form.region.trim() || null,
      });
      if (res?.error) return toast.error(res.error);
      if (res.priceJump) toast.warning("Harga naik >5% — menu terkait ditandai perlu update HPP.");
      else toast.success(form.id ? "Bahan diperbarui" : "Bahan ditambahkan");
      setForm(empty);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const parsedImport = React.useMemo(() => {
    return importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, price, qty, unit, reg] = line.split(/[\t,;]/).map((s) => s.trim());
        return { name: name ?? "", buyPrice: num(price ?? "0"), buyQty: num(qty ?? "1") || 1, buyUnit: UNITS.includes(unit) ? unit : "kg", region: reg || null };
      })
      .filter((r) => r.name);
  }, [importText]);

  async function runImport() {
    if (parsedImport.length === 0) return toast.error("Belum ada baris valid untuk diimpor.");
    setImporting(true);
    try {
      const res = await importIngredientsAction(parsedImport);
      if (res?.error) return toast.error(res.error);
      toast.success(`${res.count} bahan diimpor`);
      setImportText("");
      setShowImport(false);
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  function exportCsv() {
    const headers = ["Bahan", "Wilayah", "Harga Beli", "Qty", "Satuan", "Harga/Satuan", "Menu Pakai", "Status"];
    const data = rows.map((i) => [i.name, i.region ?? "", Math.round(i.buyPrice), i.buyQty, i.buyUnit, Math.round(perUnit(i)), (usage.get(i.id) ?? []).length, i.alert ? "naik >5%" : "stabil"]);
    downloadCsv("master-bahan-baku", toCsv(headers, data));
  }

  async function act(fn: () => Promise<{ error?: string }>, ok: string) {
    const res = await fn();
    if (res?.error) toast.error(res.error);
    else {
      toast.success(ok);
      router.refresh();
    }
  }

  // ---- bulk selection ----
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const toggleRow = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allShownSelected = rows.length > 0 && rows.every((i) => selected.has(i.id));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    if (allShownSelected) rows.forEach((i) => n.delete(i.id));
    else rows.forEach((i) => n.add(i.id));
    return n;
  });
  const selectedAlertIds = [...selected].filter((id) => ingredients.find((i) => i.id === id)?.alert);
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
  const bulkDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Hapus ${selected.size} bahan terpilih?`)) return;
    bulk(() => bulkDeleteIngredientsAction([...selected]), (n) => `${n} bahan dihapus`);
  };
  const bulkClear = () => bulk(() => bulkClearAlertsAction(selectedAlertIds), (n) => `${n} tanda selesai`);

  const hasFilter = q || region !== "all";

  return (
    <div className="space-y-4">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Package} label="Total Bahan" value={String(ingredients.length)} />
        <StatTile icon={AlertTriangle} label="Naik >5%" value={String(alerts.length)} sub={alerts.length ? "perlu update HPP" : "stabil"} />
        <StatTile icon={AlertTriangle} label="Menu Terdampak" value={String(affectedMenus)} />
        <StatTile icon={Package} label="Wilayah" value={String(regions.length)} />
      </Reveal>

      {alerts.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">{alerts.length} bahan baku naik &gt;5%</span> — {affectedMenus} menu perlu dihitung ulang HPP-nya. Buka menu terkait di Kalkulator HPP, lalu tandai selesai dengan tombol lonceng.
          </p>
        </div>
      )}

      {/* Add / edit form */}
      {canEdit && (
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Plus className="size-4 text-muted-foreground" /> {form.id ? "Edit Bahan Baku" : "Tambah Bahan Baku"}
            </p>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Upload className="size-3.5" /> Import massal
            </button>
          </div>

          {showImport && (
            <div className="mb-3 rounded-xl border border-dashed border-border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                Tempel satu bahan per baris, pisahkan dengan koma: <b>Nama, Harga, Qty, Satuan, Wilayah</b>. Contoh: <code className="rounded bg-muted px-1">Susu UHT, 18000, 1, L, Kalimantan</code>
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={5}
                placeholder={"Susu UHT, 18000, 1, L, Kalimantan\nKopi Arabica, 150000, 1, kg, Umum"}
                className="mt-2 w-full rounded-lg border border-input bg-background/40 p-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{parsedImport.length} baris terbaca</span>
                <Button onClick={runImport} disabled={importing || parsedImport.length === 0} size="sm">
                  <Upload className="size-4" /> Import {parsedImport.length || ""}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nama Bahan" className="sm:col-span-2 lg:col-span-1">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Susu UHT" />
            </Field>
            <div>
              <Label>Harga Beli / Jumlah</Label>
              <div className="mt-1.5 flex gap-1.5">
                <Input value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} placeholder="Rp" inputMode="numeric" className="min-w-0 flex-1" />
                <Input value={form.buyQty} onChange={(e) => setForm({ ...form, buyQty: e.target.value })} placeholder="1" inputMode="numeric" className="w-12 shrink-0" />
                <select
                  value={form.buyUnit}
                  onChange={(e) => setForm({ ...form, buyUnit: e.target.value })}
                  className="h-9 w-16 shrink-0 rounded-lg border border-input bg-background/40 px-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <Field label="Wilayah (harga tertinggi)">
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="mis. Kalimantan" />
            </Field>
            <div className="flex items-end gap-2">
              <Button onClick={save} disabled={saving} className="flex-1">
                {form.id ? <Check className="size-4" /> : <Plus className="size-4" />} {form.id ? "Simpan" : "Tambah"}
              </Button>
              {form.id && (
                <Button variant="outline" onClick={() => setForm(empty)}>
                  <X className="size-4" /> Batal
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="glass space-y-2 rounded-2xl border border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari bahan atau wilayah…"
              className="h-9 w-full rounded-lg border border-input bg-background/40 pl-8 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
            />
          </div>
          <button type="button" onClick={exportCsv} title="Export CSV" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground">
            <Download className="size-4" />
          </button>
        </div>
        <div className="scroll-fade-x -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5">
          <div className="w-44 shrink-0">
            <Combobox portal searchable={regions.length > 6} matchTriggerWidth value={region} onChange={setRegion} options={[{ value: "all", label: "Semua Wilayah" }, ...regions.map((r) => ({ value: r, label: r }))]} />
          </div>
          <span className="shrink-0 whitespace-nowrap px-1 text-[11px] text-muted-foreground">{rows.length} bahan{hasFilter ? " (terfilter)" : ""}</span>
          {hasFilter && (
            <button type="button" onClick={() => { setQ(""); setRegion("all"); }} className="shrink-0 whitespace-nowrap rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {canEdit && selected.size > 0 && (
        <div className="glass sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 p-3 shadow-lg">
          <span className="text-sm font-semibold text-foreground">{selected.size} dipilih</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {selectedAlertIds.length > 0 && <Button size="sm" variant="outline" onClick={bulkClear} disabled={bulkBusy}><BellOff className="size-4" /> Tandai selesai ({selectedAlertIds.length})</Button>}
            <Button size="sm" variant="outline" onClick={bulkDelete} disabled={bulkBusy} className="text-red-500 hover:text-red-600"><Trash2 className="size-4" /> Hapus ({selected.size})</Button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">Batal</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                {canEdit && (
                  <th className="w-10 px-4 py-2.5">
                    <button type="button" onClick={toggleAll} title="Pilih semua" className="grid place-items-center text-muted-foreground hover:text-foreground">
                      {allShownSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>
                  </th>
                )}
                <Th label="Bahan" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className={canEdit ? "px-1" : "px-4"} />
                <Th label="Wilayah" k="region" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th label="Harga Beli" k="price" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <Th label="Menu Pakai" k="usage" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {hasFilter ? "Tidak ada bahan yang cocok." : "Belum ada bahan baku. Tambahkan lewat form di atas."}
                  </td>
                </tr>
              )}
              {rows.map((i) => {
                const used = usage.get(i.id) ?? [];
                return (
                  <tr key={i.id} className={cn("border-b border-border/60 last:border-0 hover:bg-muted/25", selected.has(i.id) && "bg-primary/[0.06]")}>
                    {canEdit && (
                      <td className="w-10 px-4 py-2.5">
                        <button type="button" onClick={() => toggleRow(i.id)} className="grid place-items-center text-muted-foreground hover:text-foreground">
                          {selected.has(i.id) ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                        </button>
                      </td>
                    )}
                    <td className={cn("py-2.5", canEdit ? "px-1" : "px-4")}>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{i.name}</p>
                        {i.alert && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <TrendingUp className="size-3" /> naik &gt;5%
                          </span>
                        )}
                      </div>
                      {i.alert && i.prevPrice != null && <p className="text-[10px] text-muted-foreground">dari {rp(i.prevPrice)}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{i.region || "—"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <p className="tabular-nums text-foreground">{rp(i.buyPrice)} <span className="text-[11px] text-muted-foreground">/ {i.buyQty} {i.buyUnit}</span></p>
                      <p className="text-[10px] text-muted-foreground">≈ {rp(perUnit(i))}/{i.buyUnit}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      {used.length > 0 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title={used.join(", ")}>{used.length} menu</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && i.alert && (
                          <button type="button" onClick={() => act(() => clearIngredientAlertAction(i.id), "Tanda selesai")} title="Tandai sudah update" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-500">
                            <BellOff className="size-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" onClick={() => setForm({ id: i.id, name: i.name, buyPrice: String(i.buyPrice), buyQty: String(i.buyQty), buyUnit: i.buyUnit, region: i.region ?? "" })} title="Edit" className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-blue-500/10 hover:text-blue-500">
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined" && !window.confirm(`Hapus bahan "${i.name}"?`)) return;
                              act(() => deleteIngredientAction(i.id), "Dihapus");
                            }}
                            title="Hapus"
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 className="size-4" />
                          </button>
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
