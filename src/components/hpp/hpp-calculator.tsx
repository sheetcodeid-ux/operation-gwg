"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Calculator,
  Check,
  ChevronsUpDown,
  Coffee,
  History,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BRAND_MARGIN,
  BRANDS,
  UNITS,
  bepSeries,
  calcHpp,
  foodCostPct,
  foodCostStatus,
  itemSubtotal,
  priceTiers,
  projection,
  roundPrice,
  sensitivity,
  wasteCost,
  type AllocMode,
  type Brand,
  type FixedItem,
  type VariableItem,
} from "@/lib/hpp/calc";
import { saveHppAction, deleteHppAction } from "@/lib/actions/hpp";
import type { HppRecord } from "@/lib/data/hpp";
import { HPP_STATUS_META, STATUS_PILL } from "@/lib/hpp/status";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;

const MASS = ["g", "kg"];
const VOL = ["ml", "L"];
const COUNT = ["pcs"];
const ALL_UNITS = [...MASS, ...VOL, ...COUNT];

const emptyVar = (): VariableItem => ({ id: uid(), name: "", takaran: 0, takaranUnit: "g", buyPrice: 0, buyQty: 1, buyUnit: "kg" });
const emptyFixed = (): FixedItem => ({ id: uid(), name: "", monthly: 0 });

/** Small inline unit select (native-styled, matches inputs). */
function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-input bg-background/40 pl-2.5 pr-7 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25 dark:bg-input/30"
      >
        {ALL_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function NumInput({ value, onChange, className, placeholder }: { value: number; onChange: (n: number) => void; className?: string; placeholder?: string }) {
  const [text, setText] = React.useState(value ? String(value) : "");
  React.useEffect(() => setText(value ? String(value) : ""), [value]);
  return (
    <Input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(num(e.target.value));
      }}
      className={className}
    />
  );
}

export type IngredientOption = { id: string; name: string; buyPrice: number; buyQty: number; buyUnit: string };

export function HppCalculator({
  initialHistory,
  canEdit,
  ingredients = [],
}: {
  initialHistory: HppRecord[];
  canEdit: boolean;
  ingredients?: IngredientOption[];
}) {
  const router = useRouter();
  const [saving, startSave] = React.useTransition();

  const [name, setName] = React.useState("");
  const [image, setImage] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<"makanan" | "minuman">("minuman");
  const [brand, setBrand] = React.useState<Brand>("Nordu");
  const [mode, setMode] = React.useState<"per_pcs" | "per_resep">("per_pcs");
  const [yieldPcs, setYieldPcs] = React.useState(1); // pcs per resep (per_resep only)
  const [variables, setVariables] = React.useState<VariableItem[]>([]);
  const [allocMode, setAllocMode] = React.useState<AllocMode>("product");
  const [targetSales, setTargetSales] = React.useState(1000);
  const [totalUnitsAll, setTotalUnitsAll] = React.useState(1000);
  const [wastePct, setWastePct] = React.useState(5); // waste normal ≤5% (GWG)
  const [btkl, setBtkl] = React.useState(0); // BTKL dapur/bar / bulan
  const [fixed, setFixed] = React.useState<FixedItem[]>([]);
  const [useClass, setUseClass] = React.useState(false); // Sistem Class Nordu

  const [sensPct, setSensPct] = React.useState(0);
  const [chosenPrice, setChosenPrice] = React.useState(0);
  const [targetProfit, setTargetProfit] = React.useState(10_000_000);
  const [chartView, setChartView] = React.useState<"grafik" | "tabel">("grafik");
  const fileRef = React.useRef<HTMLInputElement>(null);

  // ---- derived ----
  // BTKL (kitchen/bar labour) is a monthly cost allocated per product like any
  // other fixed cost, so we fold it into the fixed pool before allocation.
  const fixedAll = React.useMemo(
    () => (btkl > 0 ? [...fixed, { id: "__btkl", name: "BTKL (dapur/bar)", monthly: btkl }] : fixed),
    [fixed, btkl],
  );
  const base = React.useMemo(
    () => calcHpp({ variables, fixed: fixedAll, allocMode, targetSales, totalUnitsAllProducts: totalUnitsAll }),
    [variables, fixedAll, allocMode, targetSales, totalUnitsAll],
  );
  // Per resep: variable cost is per batch → divide by yield to get per-pcs.
  const divisor = mode === "per_resep" ? Math.max(1, yieldPcs) : 1;
  const rawVariable = base.variableCost / divisor; // bahan baku + packing / produk
  const waste = wasteCost(rawVariable, wastePct); // waste 5% dari bahan baku
  const variableCost = rawVariable + waste; // biaya variabel efektif (incl. waste)
  const fixedAlloc = base.fixedAlloc;
  const hpp = variableCost + fixedAlloc;

  const tiers = React.useMemo(() => priceTiers(hpp, brand), [hpp, brand]);
  const brandBand = BRAND_MARGIN[brand];
  const price = chosenPrice || tiers[1]?.price || 0; // default: Standar
  const sens = React.useMemo(() => sensitivity(variableCost, fixedAlloc, sensPct / 100, price), [variableCost, fixedAlloc, sensPct, price]);
  const proj = React.useMemo(() => projection(variableCost, base.totalFixed, price, targetProfit), [variableCost, base.totalFixed, price, targetProfit]);
  const fc = foodCostPct(variableCost, price);
  const fcStatus = foodCostStatus(fc, category);
  const series = React.useMemo(
    () => bepSeries(price, variableCost, base.totalFixed, Math.max(proj.targetUnit, proj.bepUnit) * 1.05 || 100),
    [price, variableCost, base.totalFixed, proj.targetUnit, proj.bepUnit],
  );

  const setVar = (id: string, patch: Partial<VariableItem>) => setVariables((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const pickIngredient = (vid: string, ingId: string) => {
    const ing = ingredients.find((x) => x.id === ingId);
    if (!ing) return setVar(vid, { ingredientId: undefined });
    setVar(vid, { ingredientId: ing.id, name: ing.name, buyPrice: ing.buyPrice, buyQty: ing.buyQty, buyUnit: ing.buyUnit });
  };
  const ingredientOptions = React.useMemo(
    () => [
      { value: "", label: "Input manual", hint: "tanpa master" },
      ...ingredients.map((ing) => ({ value: ing.id, label: ing.name, hint: `${rp(ing.buyPrice)}/${ing.buyQty}${ing.buyUnit}` })),
    ],
    [ingredients],
  );
  const setFix = (id: string, patch: Partial<FixedItem>) => setFixed((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  function reset() {
    setName("");
    setImage(null);
    setCategory("minuman");
    setBrand("Nordu");
    setMode("per_pcs");
    setYieldPcs(1);
    setVariables([]);
    setFixed([]);
    setAllocMode("product");
    setTargetSales(1000);
    setWastePct(5);
    setBtkl(0);
    setUseClass(false);
    setChosenPrice(0);
    setTargetProfit(10_000_000);
    setSensPct(0);
  }

  function save() {
    if (!name.trim()) return toast.error("Isi nama produk dulu.");
    startSave(async () => {
      const res = await saveHppAction({
        name,
        imageUrl: image,
        category,
        brand,
        mode,
        allocMode,
        targetSales,
        wastePct,
        btkl,
        useClass,
        variables,
        fixed,
        chosenPrice: price,
        targetProfit,
        variableCost,
        hpp,
        createdBy: null,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Perhitungan disimpan");
      router.refresh();
    });
  }

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Produk", name || "-"],
      ["Brand", brand],
      ["Kategori", category === "makanan" ? "Makanan" : "Minuman"],
      ["Total HPP / Produk", Math.round(hpp)],
      ["  Bahan Baku + Packing / Produk", Math.round(rawVariable)],
      [`  Waste (${wastePct}%)`, Math.round(waste)],
      ["  Biaya Variabel Efektif / Produk", Math.round(variableCost)],
      ["  Alokasi Biaya Tetap / Produk", Math.round(fixedAlloc)],
      ["  BTKL / Bulan (dapur/bar)", Math.round(btkl)],
      ["Harga Jual Pilihan (tanpa pajak)", Math.round(price)],
      ["Harga After-tax (referensi, PBJT 10%)", Math.round(price * 1.1)],
      ["Food cost %", `${(fc * 100).toFixed(1)}% (${foodCostStatus(fc, category).label})`],
      ["Margin Kontribusi / unit", Math.round(proj.contribution)],
      ["BEP (unit)", proj.bepUnit],
      ["Target Jual / Bulan", proj.targetUnit],
      ["Potensi Omzet / Bulan", Math.round(proj.omzet)],
      ["Proyeksi Laba Bersih / Bulan", Math.round(proj.netProfit)],
      [],
      ["Bahan Baku", "Takaran", "Harga Beli", "Jml", "Subtotal"],
      ...variables.map((v) => [v.name, `${v.takaran} ${v.takaranUnit}`, v.buyPrice, `${v.buyQty} ${v.buyUnit}`, Math.round(itemSubtotal(v) / divisor)]),
    ];
    downloadCsv(`hpp-${(name || "produk").toLowerCase().replace(/\s+/g, "-")}`, toCsv([], rows));
  }

  function loadRecord(r: HppRecord) {
    setName(r.name);
    setImage(r.imageUrl);
    setCategory(r.category === "makanan" ? "makanan" : "minuman");
    setBrand((BRANDS as string[]).includes(r.brand) ? (r.brand as Brand) : "Nordu");
    setMode(r.mode === "per_resep" ? "per_resep" : "per_pcs");
    setVariables(r.variables);
    setFixed(r.fixed);
    setAllocMode(r.allocMode);
    setTargetSales(r.targetSales || 1000);
    setWastePct(r.wastePct ?? 5);
    setBtkl(r.btkl ?? 0);
    setUseClass(!!r.useClass);
    setChosenPrice(r.chosenPrice || 0);
    setTargetProfit(r.targetProfit || 10_000_000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {/* ============ LEFT: INPUT ============ */}
      <div className="min-w-0 space-y-4">
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="size-4 text-muted-foreground" /> Data Produk
          </p>
          <Field label="Nama Produk">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Kopi Susu Gula Aren" />
          </Field>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Kategori Produk</Label>
              <Segmented
                className="mt-1.5"
                value={category}
                onChange={(v) => setCategory(v as typeof category)}
                items={[
                  { value: "minuman", label: "Minuman", icon: Coffee },
                  { value: "makanan", label: "Makanan", icon: UtensilsCrossed },
                ]}
              />
            </div>
            <div>
              <Label>Brand</Label>
              <div className="mt-1.5">
                <Combobox
                  portal
                  matchTriggerWidth
                  searchable={false}
                  value={brand}
                  onChange={(v) => setBrand(v as Brand)}
                  options={BRANDS.map((b) => ({ value: b, label: b }))}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Label>Foto Produk (opsional)</Label>
            <div className="mt-1.5 flex items-center gap-3">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="produk" className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-border" />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                  <ImagePlus className="size-6" />
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="size-4" /> {image ? "Ganti Foto" : "Tambah Foto"}
                  </Button>
                  {image && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setImage(null)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="size-4" /> Hapus
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Untuk database & verifikasi tim F&B.</p>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <Label>Mode Perhitungan</Label>
            <Segmented
              className="mt-1.5"
              value={mode}
              onChange={(v) => setMode(v as typeof mode)}
              items={[
                { value: "per_pcs", label: "Per Pcs (Satuan)" },
                { value: "per_resep", label: "Per Resep (Batch)" },
              ]}
            />
            {mode === "per_resep" && (
              <Field label="Hasil per Resep (pcs)" className="mt-2">
                <NumInput value={yieldPcs} onChange={setYieldPcs} placeholder="mis. 10" />
              </Field>
            )}
          </div>
        </div>

        {/* Variable costs */}
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 shrink-0 text-muted-foreground" /> <span className="min-w-0">Biaya Variabel (Bahan Baku + Packing)</span>
            </p>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">{rp(base.variableCost)}</span>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">Semua bahan untuk membuat {mode === "per_resep" ? "satu resep" : "satu produk"}. Pakai harga tertinggi (antisipasi inflasi).</p>

          <div className="space-y-2">
            {variables.map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-muted/20 p-2.5">
                {ingredients.length > 0 && (
                  <div className="mb-2">
                    <Combobox
                      portal
                      matchTriggerWidth
                      value={v.ingredientId ?? ""}
                      onChange={(val) => pickIngredient(v.id, val)}
                      options={ingredientOptions}
                      placeholder="Pilih dari Master Bahan Baku (opsional)"
                      searchPlaceholder="Cari bahan…"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input value={v.name} onChange={(e) => setVar(v.id, { name: e.target.value, ingredientId: undefined })} placeholder="Nama bahan (mis. Kopi Espresso)" className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setVariables((x) => x.filter((i) => i.id !== v.id))}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                    title="Hapus bahan"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {/* Inputs stay side-by-side; on narrow screens the row swipes
                    horizontally with an edge fade (scroll-fade-x) like elsewhere. */}
                <div className="scroll-fade-x mt-2 flex gap-3 pb-0.5">
                  <div className="w-[9.5rem] shrink-0">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Takaran / produk</p>
                    <div className="flex gap-1.5">
                      <NumInput value={v.takaran} onChange={(n) => setVar(v.id, { takaran: n })} className="w-full min-w-0" placeholder="0" />
                      <div className="w-16 shrink-0">
                        <UnitSelect value={v.takaranUnit} onChange={(u) => setVar(v.id, { takaranUnit: u })} />
                      </div>
                    </div>
                  </div>
                  <div className="w-[13rem] shrink-0">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Harga beli / jml</p>
                    <div className="flex gap-1.5">
                      <NumInput value={v.buyPrice} onChange={(n) => setVar(v.id, { buyPrice: n })} className="w-full min-w-0" placeholder="Rp" />
                      <NumInput value={v.buyQty} onChange={(n) => setVar(v.id, { buyQty: n })} className="w-12 shrink-0" placeholder="1" />
                      <div className="w-16 shrink-0">
                        <UnitSelect value={v.buyUnit} onChange={(u) => setVar(v.id, { buyUnit: u })} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <span className="text-muted-foreground">Subtotal per produk</span>
                  <span className="font-semibold tabular-nums text-foreground">{rp(itemSubtotal(v) / divisor)}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVariables((v) => [...v, emptyVar()])}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-4" /> Tambah Bahan Baku
          </button>

          {/* Waste — GWG policy: waste normal ≤5% dari bahan baku, masuk ke HPP. */}
          <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-foreground">Waste / Susut Bahan</p>
                <p className="text-[11px] text-muted-foreground">Normal ≤5% dari bahan baku (kebijakan HPP)</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-16">
                  <NumInput value={wastePct} onChange={setWastePct} placeholder="5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">%</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">Biaya waste / produk</span>
              <span className="font-semibold tabular-nums text-foreground">{rp(waste)}</span>
            </div>
            {wastePct > 5 && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" /> Waste {wastePct}% melebihi batas normal 5% — catat kelebihannya sebagai waste abnormal (beban operasional terpisah).
              </p>
            )}
          </div>
        </div>

        {/* Fixed costs */}
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="min-w-0 text-sm font-semibold text-foreground">Alokasi Biaya Tetap per Produk</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{rp(base.totalFixed)}/bln</span>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">Overhead & operasional bulanan (tanpa sewa bangunan & pajak, sesuai kebijakan HPP).</p>

          <Segmented
            value={allocMode}
            onChange={(v) => setAllocMode(v as AllocMode)}
            items={[
              { value: "product", label: "Produk Ini Saja" },
              { value: "even", label: "Bagi Rata" },
            ]}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label="Target Penjualan Produk Ini (unit/bln)">
              <NumInput value={targetSales} onChange={setTargetSales} placeholder="1000" />
            </Field>
            {allocMode === "even" && (
              <Field label="Total Unit Semua Produk (unit/bln)">
                <NumInput value={totalUnitsAll} onChange={setTotalUnitsAll} placeholder="1000" />
              </Field>
            )}
          </div>

          {/* BTKL — Biaya Tenaga Kerja Langsung (kitchen/bar staff), per makalah. */}
          <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-foreground">BTKL — Tenaga Kerja Langsung</p>
                  <p className="text-[11px] text-muted-foreground">Gaji karyawan dapur/bar per bulan</p>
                </div>
              </div>
              <div className="w-32 shrink-0">
                <NumInput value={btkl} onChange={setBtkl} placeholder="Rp/bln" />
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {fixed.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <Input value={f.name} onChange={(e) => setFix(f.id, { name: e.target.value })} placeholder="Nama biaya (mis. Listrik, Gas & Air)" className="flex-1" />
                <div className="w-32 shrink-0">
                  <NumInput value={f.monthly} onChange={(n) => setFix(f.id, { monthly: n })} placeholder="Rp/bln" />
                </div>
                <button
                  type="button"
                  onClick={() => setFixed((x) => x.filter((i) => i.id !== f.id))}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  title="Hapus biaya"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFixed((f) => [...f, emptyFixed()])}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-4" /> Tambah Biaya
          </button>
        </div>
      </div>

      {/* ============ RIGHT: RESULTS ============ */}
      {/* Desktop: pin the results panel below the sticky topbar (h-16) and let it
          scroll internally, so the HPP figures stay visible while editing inputs. */}
      <div data-lenis-prevent className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
        {/* HPP breakdown */}
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calculator className="size-4 text-muted-foreground" /> Rincian HPP per Produk
          </p>
          <div className="space-y-1.5 text-sm">
            <Row label="Bahan Baku + Packing" value={rp(rawVariable)} />
            <Row label={`Waste (${wastePct}%)`} value={rp(waste)} />
            <Row label="Biaya Variabel Efektif" value={rp(variableCost)} />
            <Row label="Alokasi Biaya Tetap" value={rp(fixedAlloc)} hint={`Overhead${btkl > 0 ? " + BTKL" : ""} ${rp(base.totalFixed)} / ${allocMode === "even" ? totalUnitsAll : targetSales} unit`} />
            <div className="mt-1 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5">
              <span className="font-semibold text-foreground">Total HPP per Produk</span>
              <span className="text-lg font-bold tabular-nums text-primary">{rp(hpp)}</span>
            </div>
          </div>
        </div>

        {/* Sensitivity */}
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="size-4 text-muted-foreground" /> Analisis Sensitivitas Harga
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground">Simulasi dampak kenaikan biaya bahan baku terhadap HPP & margin.</p>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Biaya bahan baku naik</span>
            <span className="font-semibold tabular-nums text-foreground">+{sensPct}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={sensPct} onChange={(e) => setSensPct(Number(e.target.value))} className="w-full accent-primary" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Mini label="HPP Sekarang" value={rp(hpp)} />
            <Mini label={`HPP Baru (+${sensPct}%)`} value={rp(sens.newHpp)} tone={sens.deltaHpp > 0 ? "up" : undefined} />
            <Mini label="Harga Jual Minimum" value={rp(sens.minPrice)} sub="agar tidak rugi" tone="warn" />
            <Mini label="Margin di Harga Ini" value={`${(sens.marginAtChosen * 100).toFixed(1)}%`} tone={sens.marginAtChosen < 0.3 ? "up" : "ok"} />
          </div>
        </div>

        {/* Price suggestions */}
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Saran Harga Jual</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                fcStatus.tone === "good" && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
                fcStatus.tone === "warn" && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                fcStatus.tone === "bad" && "bg-red-500/12 text-red-600 dark:text-red-400",
              )}
            >
              Food cost {(fc * 100).toFixed(1)}% · {fcStatus.label}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Margin ideal {brand} {(brandBand.idealLow * 100).toFixed(0)}–{(brandBand.idealHigh * 100).toFixed(0)}% · food cost{" "}
            {category === "minuman" ? "minuman 25–35%" : "makanan ≤35%"} · over cost bila &gt;70%.
          </p>
          {fcStatus.tone === "bad" && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5 shrink-0" /> Food cost di atas 70% — menu over cost, wajib dievaluasi ulang (naikkan harga / turunkan biaya bahan).
            </p>
          )}
          <div className="space-y-2">
            {tiers.map((t) => {
              const active = price === t.price;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setChosenPrice(t.price)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                    active ? "border-primary bg-primary/[0.06] ring-1 ring-primary/25" : "border-border hover:bg-muted/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">{t.label}</span>
                      {active && <Check className="size-4 text-primary" />}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{t.note}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Profit {rp(t.profit)} · Margin {(t.margin * 100).toFixed(1)}%
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">{rp(t.price)}</span>
                </button>
              );
            })}
          </div>

          {/* PBJT reference — pajak di LUAR HPP & harga jual; hanya referensi struk.
              Untuk bar/minuman, harga after-tax tidak ditampilkan ke tamu (makalah). */}
          <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Harga jual (tanpa pajak)</span>
              <span className="font-semibold tabular-nums text-foreground">{rp(price)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">+ PBJT 10% (referensi struk)</span>
              <span className="tabular-nums text-muted-foreground">{rp(price * 0.1)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1.5">
              <span className="text-muted-foreground">Harga after-tax (referensi)</span>
              <span className="font-semibold tabular-nums text-foreground">{rp(price * 1.1)}</span>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              PBJT 10% di luar HPP &amp; margin (kebijakan HPP).{" "}
              {category === "minuman" ? "Untuk bar/minuman, harga after-tax tidak ditampilkan ke tamu." : "Hanya sebagai referensi pada struk."}
            </p>
          </div>
        </div>

        {/* Nordu class pricing — HPP identical, harga jual +Rp5.000 / class.
            Class system applies to Nordu only (per makalah). */}
        {brand === "Nordu" && (
        <div className="glass rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Layers className="size-4 text-muted-foreground" /> Sistem Class Nordu
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={useClass}
              onClick={() => setUseClass((v) => !v)}
              className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", useClass ? "bg-primary" : "bg-muted")}
            >
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-background shadow transition-all", useClass ? "left-[1.125rem]" : "left-0.5")} />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">HPP tetap sama; harga jual naik +Rp5.000 tiap class dari Class 1 (terendah).</p>
          {useClass && (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => {
                const cp = price + i * 5000;
                const m = cp > 0 ? (cp - hpp) / cp : 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="min-w-0">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">Class {i + 1}</span>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {i === 0 ? "Base price" : `+Rp ${(i * 5000).toLocaleString("id-ID")} dari Class 1`} · Margin {(m * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-foreground">{rp(cp)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Target & projection */}
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Target &amp; Proyeksi Penjualan</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Target Laba Bersih / Bulan">
              <NumInput value={targetProfit} onChange={setTargetProfit} placeholder="Rp" />
            </Field>
            <Field label="Harga Jual Pilihan (Rp)">
              <NumInput value={price} onChange={setChosenPrice} placeholder="Rp" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile icon={BarChart3} label="Target Jual / Hari" value={`${proj.perDay} pcs`} />
            <StatTile icon={BarChart3} label="Total Jual / Bulan" value={`${proj.targetUnit.toLocaleString("id-ID")} pcs`} />
            <StatTile icon={TrendingUp} label="Potensi Omzet / Bulan" value={rp(proj.omzet)} />
            <StatTile icon={Boxes} label="Total Biaya Produksi / Bln" value={rp(proj.totalProdCost)} />
            <StatTile icon={Boxes} label="Total Biaya Tetap / Bln" value={rp(proj.totalFixed)} />
            <StatTile icon={TrendingUp} label="Proyeksi Laba Bersih / Bln" value={rp(proj.netProfit)} sub={proj.netProfit >= targetProfit ? "target tercapai" : "di bawah target"} />
          </div>
        </div>

        {/* BEP */}
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="size-4 text-muted-foreground" /> Analisis BEP &amp; Proyeksi Laba
            </p>
            <Segmented
              value={chartView}
              onChange={(v) => setChartView(v as typeof chartView)}
              items={[
                { value: "grafik", label: "Grafik" },
                { value: "tabel", label: "Tabel" },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Titik Impas (BEP)" value={`${proj.bepUnit} unit`} sub={rp(proj.bepRevenue)} />
            <Mini label="Target Laba" value={`${proj.targetUnit.toLocaleString("id-ID")} unit`} sub={rp(targetProfit) + "/bln"} />
            <Mini label="Margin Kontribusi" value={rp(proj.contribution)} sub="per unit terjual" tone="ok" />
          </div>

          {chartView === "grafik" ? (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                  <XAxis dataKey="unit" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}jt` : `${Math.round(v / 1000)}rb`)} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v) => rp(Number(v))}
                    labelFormatter={(l) => `${l} unit`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={proj.bepUnit} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "BEP", fill: "#f59e0b", fontSize: 11, position: "top" }} />
                  <ReferenceLine x={proj.targetUnit} stroke="#8b5cf6" strokeDasharray="4 4" label={{ value: "Target", fill: "#8b5cf6", fontSize: 11, position: "top" }} />
                  <Line type="monotone" dataKey="pendapatan" name="Pendapatan" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="biaya" name="Total Biaya" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div data-lenis-prevent className="mt-3 max-h-64 overflow-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/70 text-left text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2 text-right">Pendapatan</th>
                    <th className="px-3 py-2 text-right">Total Biaya</th>
                    <th className="px-3 py-2 text-right">Laba/Rugi</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((p) => (
                    <tr key={p.unit} className="border-t border-border/60">
                      <td className="px-3 py-1.5 tabular-nums">{p.unit}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{rp(p.pendapatan)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{rp(p.biaya)}</td>
                      <td className={cn("px-3 py-1.5 text-right tabular-nums", p.pendapatan - p.biaya >= 0 ? "text-emerald-500" : "text-red-500")}>{rp(p.pendapatan - p.biaya)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Perhitungan
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} className="flex-1">
            <Boxes className="size-4" /> Export .csv
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>

        {/* History */}
        {initialHistory.length > 0 && (
          <div className="glass rounded-2xl border border-border p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <History className="size-4 text-muted-foreground" /> Riwayat Perhitungan
            </p>
            <div className="space-y-1.5">
              {initialHistory.map((r) => (
                <div key={r.id} className="group flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
                  <button type="button" onClick={() => loadRecord(r)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      {r.category === "makanan" ? (
                        <UtensilsCrossed className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Coffee className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                      <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold", STATUS_PILL[HPP_STATUS_META[r.status].tone])}>
                        {HPP_STATUS_META[r.status].label}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.brand} · HPP {rp(r.hpp)} · Harga {rp(r.chosenPrice)} · {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </p>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (typeof window !== "undefined" && !window.confirm(`Hapus perhitungan "${r.name}"?`)) return;
                        const res = await deleteHppAction(r.id);
                        if (res?.error) toast.error(res.error);
                        else {
                          toast.success("Dihapus");
                          router.refresh();
                        }
                      }}
                      className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                      title="Hapus"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- small sub-components ---------- */
function Segmented({
  value,
  onChange,
  items,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; icon?: LucideIcon }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex w-full gap-1 rounded-xl border border-border bg-muted/50 p-1", className)}>
      {items.map((it) => {
        const active = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[11px] text-muted-foreground/70">({hint})</span>}
      </span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "ok" | "warn" }) {
  const color = tone === "up" ? "text-red-500" : tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-sm font-semibold tabular-nums", color)}>{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
