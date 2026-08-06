"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, BellOff, CheckSquare, FileDown, FileUp, Package, Pencil, Plus, Square, TrendingUp, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  saveIngredientAction,
  deleteIngredientAction,
  clearIngredientAlertAction,
  importIngredientsAction,
  bulkDeleteIngredientsAction,
  bulkClearAlertsAction,
} from "@/lib/actions/hpp-ingredients";
import { type HppIngredient } from "@/lib/data/hpp-ingredients";
import { unitPrice } from "@/lib/hpp/units";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useConfirm } from "@/components/ui/confirm";
import { Reveal } from "@/components/hpp/motion";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;

/** Satuan yang selalu tersedia; satuan lain ikut apa yang ada di data/import. */
const BASE_UNITS = ["g", "kg", "ml", "L", "pcs", "dus", "pack", "botol", "sachet"];


export type MenuUse = { id: string; name: string; ingredientIds: string[] };

type Form = {
  id?: string;
  name: string;
  buyPrice: string;
  buyQty: string;
  buyUnit: string;
  contentQty: string;
  contentUnit: string;
  region: string;
};
const empty: Form = { name: "", buyPrice: "", buyQty: "1", buyUnit: "kg", contentQty: "1", contentUnit: "", region: "" };

type ImportRow = {
  id?: string;
  name: string;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  contentQty: number;
  contentUnit: string;
  region: string | null;
};

export function HppIngredients({
  ingredients,
  menus,
  canEdit,
}: {
  ingredients: HppIngredient[];
  menus: MenuUse[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();

  const [region, setRegion] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [form, setForm] = React.useState<Form>(empty);
  const [formOpen, setFormOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [importText, setImportText] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [excel, setExcel] = React.useState<{ name: string; rows: ImportRow[] } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const usage = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const menu of menus) for (const ing of menu.ingredientIds) m.set(ing, [...(m.get(ing) ?? []), menu.name]);
    return m;
  }, [menus]);

  const regions = React.useMemo(
    () => [...new Set(ingredients.map((i) => i.region).filter((x): x is string => !!x))].sort(),
    [ingredients],
  );

  /**
   * Pilihan satuan mengikuti data yang benar-benar ada — kalau Excel memakai
   * "dus" atau "renceng", satuan itu langsung muncul di dropdown alih-alih
   * dipaksa jadi "kg" seperti versi sebelumnya.
   */
  const units = React.useMemo(() => {
    const found = ingredients.flatMap((i) => [i.buyUnit, i.contentUnit]).filter(Boolean);
    const extra = excel?.rows.flatMap((r) => [r.buyUnit, r.contentUnit]).filter(Boolean) ?? [];
    return [...new Set([...BASE_UNITS, ...found, ...extra])];
  }, [ingredients, excel]);
  const unitOptions = React.useMemo(() => units.map((u) => ({ value: u, label: u })), [units]);

  const alerts = React.useMemo(() => ingredients.filter((i) => i.alert), [ingredients]);
  const affectedMenus = new Set(alerts.flatMap((i) => usage.get(i.id) ?? [])).size;

  const rows = React.useMemo(
    () =>
      ingredients.filter((i) => {
        if (region !== "all" && (i.region ?? "") !== region) return false;
        if (status === "alert" && !i.alert) return false;
        if (status === "stable" && i.alert) return false;
        return true;
      }),
    [ingredients, region, status],
  );

  // ---- selection ----
  const toggleRow = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShownSelected = rows.length > 0 && rows.every((i) => selected.has(i.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allShownSelected) rows.forEach((i) => n.delete(i.id));
      else rows.forEach((i) => n.add(i.id));
      return n;
    });
  const selectedAlertIds = [...selected].filter((id) => ingredients.find((i) => i.id === id)?.alert);

  // ---- mutations ----
  async function act(fn: () => Promise<{ error?: string }>, ok: string) {
    const res = await fn();
    if (res?.error) toast.error(res.error);
    else {
      toast.success(ok);
      router.refresh();
    }
  }

  async function bulk(fn: () => Promise<{ error?: string; count?: number }>, okMsg: (n: number) => string) {
    setBulkBusy(true);
    try {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        toast.success(okMsg(res.count ?? 0));
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBulkBusy(false);
    }
  }

  function openAdd() {
    setForm(empty);
    setFormOpen(true);
  }

  function openEdit(i: HppIngredient) {
    setForm({
      id: i.id,
      name: i.name,
      buyPrice: String(i.buyPrice),
      buyQty: String(i.buyQty),
      buyUnit: i.buyUnit,
      contentQty: String(i.contentQty || 1),
      contentUnit: i.contentUnit || i.buyUnit,
      region: i.region ?? "",
    });
    setFormOpen(true);
  }

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
        contentQty: num(form.contentQty) || 1,
        contentUnit: form.contentUnit.trim() || form.buyUnit,
        region: form.region.trim() || null,
      });
      if (res?.error) return toast.error(res.error);
      if (res.priceJump) toast.warning("Harga naik >5% — menu terkait ditandai perlu update HPP.");
      else toast.success(form.id ? "Bahan diperbarui" : "Bahan ditambahkan");
      setForm(empty);
      setFormOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeOne(i: HppIngredient) {
    const used = usage.get(i.id) ?? [];
    if (
      !(await confirm({
        title: `Hapus "${i.name}"?`,
        description: used.length
          ? `Bahan ini dipakai ${used.length} menu — HPP-nya akan kehilangan tautan harga.`
          : "Bahan akan dihapus dari master.",
        confirmLabel: "Hapus",
        tone: "danger",
      }))
    )
      return;
    act(() => deleteIngredientAction(i.id), "Dihapus");
  }

  async function bulkDelete() {
    if (
      !(await confirm({
        title: `Hapus ${selected.size} bahan terpilih?`,
        description: "Tindakan ini tidak bisa dibatalkan.",
        confirmLabel: "Hapus semua",
        tone: "danger",
      }))
    )
      return;
    bulk(() => bulkDeleteIngredientsAction([...selected]), (n) => `${n} bahan dihapus`);
  }

  // ---- import ----
  const parsedImport = React.useMemo<ImportRow[]>(() => {
    return importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, price, qty, unit, isi, isiUnit, reg] = line.split(/[\t,;]/).map((s) => s.trim());
        const buyUnit = unit || "kg";
        return {
          name: name ?? "",
          buyPrice: num(price ?? "0"),
          buyQty: num(qty ?? "1") || 1,
          buyUnit,
          contentQty: num(isi ?? "1") || 1,
          contentUnit: isiUnit || buyUnit,
          region: reg || null,
        };
      })
      .filter((r) => r.name);
  }, [importText]);

  async function doImport(list: ImportRow[]) {
    if (list.length === 0) return toast.error("Belum ada baris valid untuk diimpor.");
    setImporting(true);
    try {
      const res = await importIngredientsAction(list);
      if (res?.error) return toast.error(res.error);
      toast.success(`${res.count} bahan diproses${res.jumps ? ` · ${res.jumps} naik >5%` : ""}`);
      setImportText("");
      setExcel(null);
      setShowImport(false);
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const src = ingredients.length
      ? ingredients
      : ([
          {
            id: "",
            name: "Contoh: Susu UHT",
            buyPrice: 120000,
            buyQty: 1,
            buyUnit: "dus",
            contentQty: 24,
            contentUnit: "pcs",
            region: "Umum",
          },
        ] as HppIngredient[]);
    const data = src.map((i) => ({
      ID: i.id,
      "Nama Bahan": i.name,
      "Harga Beli": Math.round(i.buyPrice),
      Qty: i.buyQty,
      Satuan: i.buyUnit,
      Isi: i.contentQty || 1,
      "Satuan Pakai": i.contentUnit || i.buyUnit,
      Wilayah: i.region ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 26 }, { wch: 26 }, { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bahan Baku");
    XLSX.writeFile(wb, "template-bahan-baku.xlsx");
    toast.success("Template Excel diunduh");
  }

  async function onExcelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) if (r[k] != null && r[k] !== "") return String(r[k]);
        return "";
      };
      const rows: ImportRow[] = json
        .map((r) => {
          // Satuan dipakai apa adanya. Versi lama memaksa satuan di luar daftar
          // bawaan menjadi "kg", sehingga "dus" di Excel muncul "kg" di tabel.
          const buyUnit = pick(r, "Satuan", "Unit").trim() || "kg";
          const contentUnit = pick(r, "Satuan Pakai", "Satuan Isi", "Base Unit").trim();
          return {
            id: pick(r, "ID", "Id", "id") || undefined,
            name: pick(r, "Nama Bahan", "Nama", "Name").trim(),
            buyPrice: num(pick(r, "Harga Beli", "Harga", "Price")),
            buyQty: num(pick(r, "Qty", "Jumlah")) || 1,
            buyUnit,
            contentQty: num(pick(r, "Isi", "Isi per Dus", "Content")) || 1,
            contentUnit: contentUnit || buyUnit,
            region: pick(r, "Wilayah", "Region").trim() || null,
          };
        })
        .filter((r) => r.name);
      if (rows.length === 0) return toast.error("File tidak berisi baris valid. Pakai template yang disediakan.");
      setExcel({ name: file.name, rows });
    } catch {
      toast.error("Gagal membaca file. Pastikan format .xlsx dari template.");
    }
  }

  // ---- table ----
  const columns = React.useMemo<ColumnDef<HppIngredient>[]>(() => {
    const cols: ColumnDef<HppIngredient>[] = [];
    if (canEdit) {
      cols.push({
        id: "select",
        enableSorting: false,
        header: () => (
          <button type="button" onClick={toggleAll} title="Pilih semua" className="grid place-items-center text-muted-foreground hover:text-foreground">
            {allShownSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
          </button>
        ),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => toggleRow(row.original.id)}
            className="grid place-items-center text-muted-foreground hover:text-foreground"
          >
            {selected.has(row.original.id) ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
          </button>
        ),
      });
    }
    cols.push(
      {
        accessorKey: "name",
        header: "Bahan",
        cell: ({ row }) => {
          const i = row.original;
          return (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-medium text-foreground">{i.name}</p>
                {i.alert && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    <TrendingUp className="size-3" /> naik &gt;5%
                  </span>
                )}
              </div>
              {i.alert && i.prevPrice != null && <p className="text-[10px] text-muted-foreground">dari {rp(i.prevPrice)}</p>}
            </div>
          );
        },
      },
      {
        accessorKey: "region",
        header: "Wilayah",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue<string>() || "—"}</span>,
      },
      {
        id: "buy",
        header: "Harga Beli",
        accessorFn: (i) => i.buyPrice,
        cell: ({ row }) => {
          const i = row.original;
          return (
            <div className="whitespace-nowrap text-right">
              <p className="tabular-nums text-foreground">
                {rp(i.buyPrice)} <span className="text-[11px] text-muted-foreground">/ {i.buyQty} {i.buyUnit}</span>
              </p>
              {i.contentQty > 1 && (
                <p className="text-[10px] text-muted-foreground">
                  isi {i.contentQty} {i.contentUnit}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "unitPrice",
        header: "Harga/Satuan Pakai",
        accessorFn: (i) => Math.round(unitPrice(i)),
        cell: ({ row }) => {
          const i = row.original;
          return (
            <p className="whitespace-nowrap text-right font-medium tabular-nums text-foreground">
              {rp(unitPrice(i))}
              <span className="text-[11px] font-normal text-muted-foreground">/{i.contentUnit || i.buyUnit}</span>
            </p>
          );
        },
      },
      {
        id: "usage",
        header: "Menu Pakai",
        accessorFn: (i) => (usage.get(i.id) ?? []).length,
        cell: ({ row }) => {
          const used = usage.get(row.original.id) ?? [];
          return used.length > 0 ? (
            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title={used.join(", ")}>
              {used.length} menu
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          );
        },
      },
    );
    if (canEdit) {
      cols.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const i = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {i.alert && (
                <button
                  type="button"
                  onClick={() => act(() => clearIngredientAlertAction(i.id), "Tanda selesai")}
                  title="Tandai sudah update"
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                >
                  <BellOff className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => openEdit(i)}
                title="Edit"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-blue-500/10 hover:text-blue-500"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => removeOne(i)}
                title="Hapus"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        },
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, selected, allShownSelected, usage]);

  const preview = form.buyPrice ? unitPrice({ buyPrice: num(form.buyPrice), buyQty: num(form.buyQty) || 1, contentQty: num(form.contentQty) || 1 }) : 0;

  return (
    <div className="space-y-4">
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Package} label="Total Bahan" value={String(ingredients.length)} />
        <StatTile icon={AlertTriangle} label="Naik >5%" value={String(alerts.length)} sub={alerts.length ? "perlu update HPP" : "stabil"} />
        <StatTile icon={AlertTriangle} label="Menu Terdampak" value={String(affectedMenus)} />
        <StatTile icon={Package} label="Wilayah" value={String(regions.length)} />
      </Reveal>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Tambah Bahan
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="size-4" /> Import massal
          </Button>
          {selected.size > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{selected.size} dipilih</span>
              {selectedAlertIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulk(() => bulkClearAlertsAction(selectedAlertIds), (n) => `${n} tanda selesai`)}
                  disabled={bulkBusy}
                >
                  <BellOff className="size-4" /> Tandai selesai ({selectedAlertIds.length})
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={bulkDelete} disabled={bulkBusy} className="text-red-500 hover:text-red-600">
                <Trash2 className="size-4" /> Hapus ({selected.size})
              </Button>
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                Batal
              </button>
            </div>
          )}
        </div>
      )}

      <DataTable
        columns={columns as ColumnDef<HppIngredient, unknown>[]}
        data={rows}
        tableId="hpp-bahan"
        pageSize={15}
        searchPlaceholder="Cari bahan…"
        toolbar={
          <>
            <div className="w-44 shrink-0">
              <Combobox
                portal
                matchTriggerWidth
                searchable={regions.length > 6}
                value={region}
                onChange={setRegion}
                options={[{ value: "all", label: "Semua Wilayah" }, ...regions.map((r) => ({ value: r, label: r }))]}
              />
            </div>
            <div className="w-40 shrink-0">
              <Combobox
                portal
                matchTriggerWidth
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "Semua Status" },
                  { value: "alert", label: `Naik >5% (${alerts.length})` },
                  { value: "stable", label: "Stabil" },
                ]}
              />
            </div>
          </>
        }
      />

      {/* Form add/edit — drawer, jadi tombol Edit di baris mana pun langsung
          membuka form tanpa harus scroll ke atas halaman. */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent
          title={form.id ? "Edit Bahan Baku" : "Tambah Bahan Baku"}
          description="Harga beli dicatat apa adanya; isi kemasan dipakai untuk menghitung harga per satuan pakai."
        >
          <div className="space-y-4">
            <Field label="Nama Bahan">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Susu UHT" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga Beli">
                <Input value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} placeholder="Rp" inputMode="numeric" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Qty">
                  <Input value={form.buyQty} onChange={(e) => setForm({ ...form, buyQty: e.target.value })} placeholder="1" inputMode="numeric" />
                </Field>
                <div>
                  <Label>Satuan</Label>
                  <div className="mt-1.5">
                    <Combobox
                      portal
                      matchTriggerWidth
                      searchable
                      value={form.buyUnit}
                      onChange={(v) => setForm({ ...form, buyUnit: v })}
                      options={unitOptions}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">
                <b className="text-foreground">Isi kemasan.</b> Barang datang per dus tapi resep memakai pcs — isi 1 dus berapa pcs?
                Barang satuan cukup diisi <b>1</b>.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Isi per kemasan">
                  <Input value={form.contentQty} onChange={(e) => setForm({ ...form, contentQty: e.target.value })} placeholder="24" inputMode="numeric" />
                </Field>
                <div>
                  <Label>Satuan pakai</Label>
                  <div className="mt-1.5">
                    <Combobox
                      portal
                      matchTriggerWidth
                      searchable
                      value={form.contentUnit || form.buyUnit}
                      onChange={(v) => setForm({ ...form, contentUnit: v })}
                      options={unitOptions}
                    />
                  </div>
                </div>
              </div>
              {preview > 0 && (
                <p className="mt-2 text-xs text-foreground">
                  Harga per satuan pakai: <b className="tabular-nums">{rp(preview)}</b>
                  <span className="text-muted-foreground">/{form.contentUnit || form.buyUnit}</span>
                </p>
              )}
            </div>

            <Field label="Wilayah (harga tertinggi)">
              <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="mis. Kalimantan" />
            </Field>

            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="flex-1">
                {saving ? "Menyimpan…" : form.id ? "Simpan Perubahan" : "Tambah Bahan"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                <X className="size-4" /> Batal
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Import massal */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent title="Import Bahan Baku" description="Lewat template Excel, atau tempel manual." className="max-w-xl">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] text-muted-foreground">
                <b className="text-foreground">Cara Excel:</b> unduh template (berisi semua bahan saat ini), ubah harganya di Excel, lalu import kembali —
                data langsung terupdate & harga naik &gt;5% otomatis ditandai. <b>Kolom ID jangan diubah.</b> Kolom <b>Isi</b> dan <b>Satuan Pakai</b> untuk
                barang yang dibeli per dus.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <FileDown className="size-4" /> Download Template Excel
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onExcelFile} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileUp className="size-4" /> Pilih File Excel
                </Button>
              </div>
              {excel && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/[0.05] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                    {excel.name} · <b>{excel.rows.length}</b> baris siap
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" onClick={() => doImport(excel.rows)} disabled={importing}>
                      <Upload className="size-4" /> Import {excel.rows.length}
                    </Button>
                    <button type="button" onClick={() => setExcel(null)} className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> atau tempel manual <span className="h-px flex-1 bg-border" />
            </div>

            <div>
              <p className="text-[11px] text-muted-foreground">
                Satu bahan per baris: <b>Nama, Harga, Qty, Satuan, Isi, Satuan Pakai, Wilayah</b>. Contoh:{" "}
                <code className="rounded bg-muted px-1">Susu UHT, 120000, 1, dus, 24, pcs, Kalimantan</code>
              </p>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                placeholder={"Susu UHT, 120000, 1, dus, 24, pcs, Kalimantan\nKopi Arabica, 150000, 1, kg, 1, kg, Umum"}
                className="mt-2"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{parsedImport.length} baris terbaca</span>
                <Button onClick={() => doImport(parsedImport)} disabled={importing || parsedImport.length === 0} size="sm" variant="outline">
                  <Upload className="size-4" /> Import {parsedImport.length || ""}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}

