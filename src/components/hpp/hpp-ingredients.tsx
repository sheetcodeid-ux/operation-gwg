"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellOff, Check, Package, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { saveIngredientAction, deleteIngredientAction, clearIngredientAlertAction, importIngredientsAction } from "@/lib/actions/hpp-ingredients";
import type { HppIngredient } from "@/lib/data/hpp-ingredients";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { Reveal } from "@/components/hpp/motion";
import { cn } from "@/lib/utils";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;
const UNITS = ["g", "kg", "ml", "L", "pcs"];

export type MenuUse = { id: string; name: string; ingredientIds: string[] };

type Form = { id?: string; name: string; buyPrice: string; buyQty: string; buyUnit: string; region: string };
const empty: Form = { name: "", buyPrice: "", buyQty: "1", buyUnit: "kg", region: "" };

export function HppIngredients({ ingredients, menus, canEdit }: { ingredients: HppIngredient[]; menus: MenuUse[]; canEdit: boolean }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
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

  const alerts = ingredients.filter((i) => i.alert);
  const affectedMenus = new Set(alerts.flatMap((i) => usage.get(i.id) ?? [])).size;

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ingredients.filter((i) => !needle || i.name.toLowerCase().includes(needle) || (i.region ?? "").toLowerCase().includes(needle));
  }, [ingredients, q]);

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
        const [name, price, qty, unit, region] = line.split(/[\t,;]/).map((s) => s.trim());
        return { name: name ?? "", buyPrice: num(price ?? "0"), buyQty: num(qty ?? "1") || 1, buyUnit: UNITS.includes(unit) ? unit : "kg", region: region || null };
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

  async function act(fn: () => Promise<{ error?: string }>, ok: string) {
    const res = await fn();
    if (res?.error) toast.error(res.error);
    else {
      toast.success(ok);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Package} label="Total Bahan" value={String(ingredients.length)} />
        <StatTile icon={AlertTriangle} label="Naik >5%" value={String(alerts.length)} sub={alerts.length ? "perlu update HPP" : "stabil"} />
        <StatTile icon={AlertTriangle} label="Menu Terdampak" value={String(affectedMenus)} />
        <StatTile icon={Package} label="Wilayah" value={String(new Set(ingredients.map((i) => i.region).filter(Boolean)).size)} />
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
                <Input value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} placeholder="Rp" inputMode="numeric" className="flex-1" />
                <Input value={form.buyQty} onChange={(e) => setForm({ ...form, buyQty: e.target.value })} placeholder="1" inputMode="numeric" className="w-14" />
                <select
                  value={form.buyUnit}
                  onChange={(e) => setForm({ ...form, buyUnit: e.target.value })}
                  className="h-9 w-20 shrink-0 rounded-lg border border-input bg-background/40 px-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
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

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari bahan atau wilayah…"
          className="h-10 w-full rounded-xl border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
        />
      </div>

      {/* Table */}
      <div className="glass overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Bahan</th>
                <th className="px-3 py-2.5 font-medium">Wilayah</th>
                <th className="px-3 py-2.5 text-right font-medium">Harga Beli</th>
                <th className="px-3 py-2.5 font-medium">Menu Pakai</th>
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Belum ada bahan baku. Tambahkan lewat form di atas.
                  </td>
                </tr>
              )}
              {rows.map((i) => {
                const used = usage.get(i.id) ?? [];
                return (
                  <tr key={i.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{i.name}</p>
                        {i.alert && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3" /> naik &gt;5%
                          </span>
                        )}
                      </div>
                      {i.prevPrice != null && i.alert && <p className="text-[10px] text-muted-foreground">dari {rp(i.prevPrice)}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{i.region || "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                      {rp(i.buyPrice)}
                      <span className="text-[11px] text-muted-foreground"> / {i.buyQty} {i.buyUnit}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {used.length > 0 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title={used.join(", ")}>
                          {used.length} menu
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && i.alert && (
                          <button
                            type="button"
                            onClick={() => act(() => clearIngredientAlertAction(i.id), "Tanda selesai")}
                            title="Tandai sudah update"
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                          >
                            <BellOff className="size-4" />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm({ id: i.id, name: i.name, buyPrice: String(i.buyPrice), buyQty: String(i.buyQty), buyUnit: i.buyUnit, region: i.region ?? "" })
                            }
                            title="Edit"
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-blue-500/10 hover:text-blue-500"
                          >
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
