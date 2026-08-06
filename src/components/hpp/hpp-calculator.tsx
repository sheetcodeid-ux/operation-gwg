"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BookmarkPlus,
  Boxes,
  Calculator,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Coffee,
  FileStack,
  Gauge,
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
  BRANDS,
  UNITS,
  bepSeries,
  calcHpp,
  calcHppV2,
  foodCostPct,
  foodCostStatus,
  hppPct,
  hppStatus,
  minPriceForCategory,
  classPrices,
  MIN_MARGIN,
  WASTE_NORMAL_MAX,
  itemSubtotal,
  priceTiers,
  projection,
  roundPrice,
  sensitivity,
  wasteCost,
  type AllocMode,
  type Brand,
  type FixedItem,
  type OverheadKind,
  type VariableItem,
} from "@/lib/hpp/calc";
import { saveHppAction, deleteHppAction } from "@/lib/actions/hpp";
import { saveOverheadTemplateAction, deleteOverheadTemplateAction } from "@/lib/actions/overhead-template";
import type { HppRecord } from "@/lib/data/hpp";
import { HPP_STATUS_META, STATUS_PILL } from "@/lib/hpp/status";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { UMP_2026 } from "@/lib/hpp/ump";

/** UMP provinces sorted highest-first — the top one is the recommended standar
 *  (kebijakan MoM: skala tertinggi untuk seluruh brand). */
const UMP_SORTED = [...UMP_2026].sort((a, b) => b.ump - a.ump);
import { Field, Input, Label } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { useConfirm } from "@/components/ui/confirm";
import { recipeUnits } from "@/lib/hpp/units";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
const round0 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v: string) => Number(String(v).replace(/[^\d.-]/g, "")) || 0;

const MASS = ["g", "kg"];
const VOL = ["ml", "L"];
const COUNT = ["pcs"];
const ALL_UNITS = [...MASS, ...VOL, ...COUNT];

const emptyVar = (): VariableItem => ({ id: uid(), name: "", takaran: 0, takaranUnit: "g", buyPrice: 0, buyQty: 1, buyUnit: "kg" });
const emptyFixed = (kind: OverheadKind = "fixed"): FixedItem => ({ id: uid(), name: "", monthly: 0, kind });

const UNIT_OPTIONS = ALL_UNITS.map((u) => ({ value: u, label: u }));

/** Unit picker — Combobox milik web ini, bukan <select> bawaan browser (yang
 *  memakai menu OS, mengabaikan tema, dan tidak bisa dicari). */
function UnitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Tanpa searchable: hanya 5 satuan, dan kotak cari akan memunculkan keyboard
  // di HP untuk sesuatu yang cukup diketuk.
  return <Combobox portal matchTriggerWidth value={value} onChange={onChange} options={UNIT_OPTIONS} />;
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

export type IngredientOption = {
  id: string;
  name: string;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  /** Isi per kemasan + satuan pakai (barang per dus). */
  contentQty?: number;
  contentUnit?: string;
};

/** Client-safe costing policy (food-cost target + selling margin band per category). */
export type PolicyOption = { scope: string; foodPct: number; bevPct: number; foodMarginMin: number; foodMarginMax: number; bevMarginMin: number; bevMarginMax: number };
/** Client-safe ESB catalog entry for the product picker. */
export type EsbMenuOption = { menu: string; foodBev: "makanan" | "minuman"; qty30d: number; unitPrice: number };
/** Client-safe reusable overhead template (applying only pre-fills the form). */
export type OverheadTemplateOption = { id: string; name: string; brand: string | null; items: { name: string; monthly: number; kind: OverheadKind }[] };

export function HppCalculator({
  initialHistory,
  canEdit,
  ingredients = [],
  autoLoadId,
  policies = [{ scope: "default", foodPct: 35, bevPct: 25, foodMarginMin: 35, foodMarginMax: 50, bevMarginMin: 60, bevMarginMax: 100 }],
  esbMenus = [],
  templates = [],
}: {
  initialHistory: HppRecord[];
  canEdit: boolean;
  ingredients?: IngredientOption[];
  autoLoadId?: string;
  policies?: PolicyOption[];
  esbMenus?: EsbMenuOption[];
  templates?: OverheadTemplateOption[];
}) {
  const router = useRouter();
  const [saving, startSave] = React.useTransition();
  const [savingTpl, startSaveTpl] = React.useTransition();
  const [appliedTpl, setAppliedTpl] = React.useState<{ id: string; name: string } | null>(null);
  // Dialog konfirmasi/prompt bertema web ini — bukan popup bawaan browser yang
  // memblokir main thread dan tampil di luar tema.
  const { confirm, open: ask, dialog: confirmDialog } = useConfirm();

  const [name, setName] = React.useState("");
  // Product source: pick from the ESB catalog, or enter a new/manual product.
  const [manualProduct, setManualProduct] = React.useState(esbMenus.length === 0);
  const [targetCustom, setTargetCustom] = React.useState(false);
  const [esbTargetRec, setEsbTargetRec] = React.useState<number | null>(null);
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
  const [umpProv, setUmpProv] = React.useState(UMP_SORTED[0]?.prov ?? ""); // default: UMP tertinggi (rekomendasi)
  const [umpStaff, setUmpStaff] = React.useState(1);
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
  // Mesin tujuh langkah makalah: bahan baku → BTKL → overhead (termasuk waste)
  // → packing → Total HPP. BTKL tidak lagi diselundupkan sebagai baris overhead.
  const bd = React.useMemo(
    () =>
      calcHppV2({
        variables,
        fixed,
        btklMonthly: btkl,
        wastePct,
        allocMode,
        targetSales,
        totalUnitsAllProducts: totalUnitsAll,
        yieldPcs: mode === "per_resep" ? yieldPcs : 1,
      }),
    [variables, fixed, btkl, wastePct, allocMode, targetSales, totalUnitsAll, mode, yieldPcs],
  );
  const base = React.useMemo(
    () => calcHpp({ variables, fixed: fixedAll, allocMode, targetSales, totalUnitsAllProducts: totalUnitsAll }),
    [variables, fixedAll, allocMode, targetSales, totalUnitsAll],
  );
  // Per resep: biaya satu batch dibagi hasil porsi.
  const divisor = mode === "per_resep" ? Math.max(1, yieldPcs) : 1;
  const rawVariable = bd.hppDasar; // bahan baku + packing per produk
  const waste = bd.waste;
  const variableCost = round0(bd.bahanBaku + bd.waste + bd.packing);
  const fixedAlloc = round0(bd.overheadOps + bd.btkl);
  const hpp = bd.totalHpp;

  // Costing policy for this brand (override wins, else default).
  const policy = React.useMemo(() => {
    const fallback = { scope: "default", foodPct: 35, bevPct: 25, foodMarginMin: 35, foodMarginMax: 50, bevMarginMin: 60, bevMarginMax: 100 };
    const def = policies.find((p) => p.scope === "default") ?? fallback;
    return policies.find((p) => p.scope === brand) ?? def;
  }, [policies, brand]);
  // Selling-price margin band per category — drives the price suggestions.
  const marginBand = React.useMemo(
    () => (category === "minuman" ? { min: policy.bevMarginMin / 100, max: policy.bevMarginMax / 100 } : { min: policy.foodMarginMin / 100, max: policy.foodMarginMax / 100 }),
    [policy, category],
  );
  const tiers = React.useMemo(() => priceTiers(hpp, brand, marginBand), [hpp, brand, marginBand]);
  const price = chosenPrice || tiers[0]?.price || 0; // default: Minimal (start di margin minimum)
  const sens = React.useMemo(() => sensitivity(variableCost, fixedAlloc, sensPct / 100, price), [variableCost, fixedAlloc, sensPct, price]);
  const proj = React.useMemo(() => projection(variableCost, base.totalFixed, price, targetProfit), [variableCost, base.totalFixed, price, targetProfit]);
  const fc = foodCostPct(variableCost, price);
  const targetFc = (category === "minuman" ? policy.bevPct : policy.foodPct) / 100;
  const policyCustom = policy.scope === brand;
  const fcStatus = foodCostStatus(fc, category, targetFc);
  // Penilaian over cost memakai HPP total ÷ harga jual (kebijakan ≤70%),
  // bukan food cost bahan baku saja.
  const hppPctVal = hppPct(hpp, price);
  const hppSt = hppStatus(hppPctVal, category, brand);
  // Pick an ESB catalog product: fill name + category, and recommend the
  // monthly sales target from the last-30-day qty (avg/day × 30 ≈ the 30d total).
  const pickEsbProduct = React.useCallback((menuName: string) => {
    setName(menuName);
    const m = esbMenus.find((x) => x.menu === menuName);
    if (!m) return;
    setCategory(m.foodBev);
    const rec = Math.max(1, Math.round(m.qty30d));
    setEsbTargetRec(rec);
    setTargetSales(rec);
    setTargetCustom(false);
  }, [esbMenus]);

  const series = React.useMemo(
    () => bepSeries(price, variableCost, base.totalFixed, Math.max(proj.targetUnit, proj.bepUnit) * 1.05 || 100),
    [price, variableCost, base.totalFixed, proj.targetUnit, proj.bepUnit],
  );

  const setVar = (id: string, patch: Partial<VariableItem>) => setVariables((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const pickIngredient = (vid: string, ingId: string) => {
    const ing = ingredients.find((x) => x.id === ingId);
    if (!ing) return setVar(vid, { ingredientId: undefined });
    // Kemasan dijabarkan ke satuan pakai: 1 dus Rp120.000 isi 24 pcs masuk
    // sebagai 24 pcs, sehingga takaran resep dihitung per pcs, bukan per dus.
    setVar(vid, { ingredientId: ing.id, name: ing.name, ...recipeUnits(ing) });
  };
  const ingredientOptions = React.useMemo(
    () => [
      { value: "", label: "Input manual", hint: "tanpa master" },
      ...ingredients.map((ing) => {
        const u = recipeUnits(ing);
        return { value: ing.id, label: ing.name, hint: `${rp(u.buyPrice)}/${u.buyQty}${u.buyUnit}` };
      }),
    ],
    [ingredients],
  );
  const setFix = (id: string, patch: Partial<FixedItem>) => setFixed((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addFixed = (kind: OverheadKind) => setFixed((f) => [...f, emptyFixed(kind)]);
  // Two logical overhead groups (kebijakan MoM): Tetap vs Variabel/Operasional.
  // Legacy rows without a kind are treated as Tetap (backward compatible).
  const fixedTetap = React.useMemo(() => fixed.filter((f) => (f.kind ?? "fixed") === "fixed"), [fixed]);
  const fixedVar = React.useMemo(() => fixed.filter((f) => f.kind === "variable"), [fixed]);

  // ---- overhead templates (reusable, editable after applying) ----
  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setFixed(t.items.map((it) => ({ id: uid(), name: it.name, monthly: it.monthly, kind: it.kind === "variable" ? "variable" : "fixed" })));
    setAppliedTpl({ id: t.id, name: t.name });
    toast.success(`Template "${t.name}" diterapkan — nilai masih bisa diedit.`);
  };
  async function saveAsTemplate() {
    const items = fixed
      .filter((f) => f.name.trim())
      .map((f) => ({ name: f.name.trim(), monthly: Math.max(0, Math.round(f.monthly || 0)), kind: (f.kind ?? "fixed") as OverheadKind }));
    if (items.length === 0) {
      toast.error("Belum ada biaya overhead untuk disimpan sebagai template.");
      return;
    }
    const nm = await ask({
      title: "Simpan sebagai template overhead",
      description: "Template bisa dipakai ulang di menu lain dan tetap bisa diedit.",
      confirmLabel: "Simpan",
      prompt: { label: "Nama template", placeholder: "mis. Overhead Nordu Baning", defaultValue: appliedTpl?.name ?? "", required: true },
    });
    if (typeof nm !== "string" || !nm.trim()) return;
    startSaveTpl(async () => {
      const res = await saveOverheadTemplateAction({ name: nm.trim(), brand, items });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setAppliedTpl(res.id ? { id: res.id, name: nm.trim() } : null);
      toast.success(`Template "${nm.trim()}" disimpan.`);
      router.refresh();
    });
  }
  async function removeTemplate(id: string, label: string) {
    if (!(await confirm({ title: `Hapus template "${label}"?`, confirmLabel: "Hapus", tone: "danger" }))) return;
    startSaveTpl(async () => {
      const res = await deleteOverheadTemplateAction(id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (appliedTpl?.id === id) setAppliedTpl(null);
      toast.success("Template dihapus.");
      router.refresh();
    });
  }

  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  function reset() {
    setName("");
    setManualProduct(esbMenus.length === 0);
    setEsbTargetRec(null);
    setTargetCustom(false);
    setImage(null);
    setCategory("minuman");
    setBrand("Nordu");
    setMode("per_pcs");
    setYieldPcs(1);
    setVariables([]);
    setFixed([]);
    setAppliedTpl(null);
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
        yieldPcs,
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
      ["Food cost %", `${(fc * 100).toFixed(1)}% · target ≤${(targetFc * 100).toFixed(0)}% (${fcStatus.label})`],
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
    setManualProduct(true); // editing a saved product — keep its name as-is
    setEsbTargetRec(null);
    setTargetCustom(false);
    setImage(r.imageUrl);
    setCategory(r.category === "makanan" ? "makanan" : "minuman");
    setBrand((BRANDS as string[]).includes(r.brand) ? (r.brand as Brand) : "Nordu");
    setMode(r.mode === "per_resep" ? "per_resep" : "per_pcs");
    setVariables(r.variables);
    setFixed(r.fixed);
    setAllocMode(r.allocMode);
    setTargetSales(r.targetSales || 1000);
    setYieldPcs(r.yieldPcs ?? 1);
    setWastePct(r.wastePct ?? 5);
    setBtkl(r.btkl ?? 0);
    setUseClass(!!r.useClass);
    setChosenPrice(r.chosenPrice || 0);
    setTargetProfit(r.targetProfit || 10_000_000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Deep-link edit from Database HPP (/rnd/hpp?edit=<id>): load it once on mount.
  const loadedRef = React.useRef(false);
  React.useEffect(() => {
    if (loadedRef.current || !autoLoadId) return;
    const rec = initialHistory.find((r) => r.id === autoLoadId);
    if (rec) {
      loadedRef.current = true;
      loadRecord(rec);
      toast.info(`Memuat "${rec.name}" untuk diedit`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadId]);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {/* ============ LEFT: INPUT ============ */}
      <div className="min-w-0 space-y-4">
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="size-4 text-muted-foreground" /> Data Produk
          </p>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label>Nama Produk</Label>
              {esbMenus.length > 0 && (
                <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5 text-[11px]">
                  <button type="button" onClick={() => setManualProduct(false)} className={cn("rounded-md px-2 py-0.5 font-medium transition-colors", !manualProduct ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground")}>Dari ESB</button>
                  <button type="button" onClick={() => setManualProduct(true)} className={cn("rounded-md px-2 py-0.5 font-medium transition-colors", manualProduct ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground")}>Baru / Manual</button>
                </div>
              )}
            </div>
            {manualProduct || esbMenus.length === 0 ? (
              <>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Kopi Susu Gula Aren" />
                {esbMenus.length > 0 && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Produk baru — belum ada di ESB. Isi target penjualan manual.</p>}
              </>
            ) : (
              <>
                <Combobox
                  portal
                  matchTriggerWidth
                  value={name}
                  onChange={pickEsbProduct}
                  options={esbMenus
                    .filter((m) => m.foodBev === category)
                    .map((m) => ({ value: m.menu, label: `${m.menu}${m.unitPrice > 0 ? ` · Rp ${m.unitPrice.toLocaleString("id-ID")}` : ""}` }))}
                  searchPlaceholder="Cari produk ESB…"
                  placeholder="Pilih produk dari ESB…"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Daftar produk {category === "minuman" ? "Beverage" : "Food"} dari ESB. Target penjualan direkomendasikan dari 30 hari terakhir.</p>
              </>
            )}
          </div>

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
                  <div className="w-[10.5rem] shrink-0">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Takaran / produk</p>
                    <div className="flex gap-1.5">
                      <NumInput value={v.takaran} onChange={(n) => setVar(v.id, { takaran: n })} className="w-full min-w-0" placeholder="0" />
                      <div className="w-20 shrink-0">
                        <UnitSelect value={v.takaranUnit} onChange={(u) => setVar(v.id, { takaranUnit: u })} />
                      </div>
                    </div>
                  </div>
                  <div className="w-[14.5rem] shrink-0">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Harga beli / jml</p>
                    <div className="flex gap-1.5">
                      <NumInput value={v.buyPrice} onChange={(n) => setVar(v.id, { buyPrice: n })} className="w-full min-w-0" placeholder="Rp" />
                      <NumInput value={v.buyQty} onChange={(n) => setVar(v.id, { buyQty: n })} className="w-12 shrink-0" placeholder="1" />
                      <div className="w-20 shrink-0">
                        <UnitSelect value={v.buyUnit} onChange={(u) => setVar(v.id, { buyUnit: u })} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
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
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
              <span className="text-muted-foreground">Biaya waste / produk</span>
              <span className="font-semibold tabular-nums text-foreground">{rp(waste)}</span>
            </div>
            {wastePct > WASTE_NORMAL_MAX && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" /> Waste {wastePct}% melebihi batas normal {WASTE_NORMAL_MAX}% — hanya menu berbahan mudah rusak (mis. nasi telur) yang boleh standar lebih tinggi; kelebihan lain dicatat sebagai waste abnormal (beban operasional terpisah, di luar HPP).
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
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <Label>Target Penjualan Produk Ini (unit/bln)</Label>
                {esbTargetRec != null && !targetCustom && (
                  <span className="rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">Rekomendasi ESB</span>
                )}
                {esbTargetRec != null && targetCustom && (
                  <button type="button" onClick={() => { setTargetSales(esbTargetRec); setTargetCustom(false); }} className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground hover:text-foreground">Custom · pakai rekomendasi ({esbTargetRec.toLocaleString("id-ID")})</button>
                )}
              </div>
              <NumInput value={targetSales} onChange={(v) => { setTargetSales(v); if (esbTargetRec != null) setTargetCustom(true); }} placeholder="1000" />
              {esbTargetRec != null && !targetCustom && <p className="mt-1 text-[10px] text-muted-foreground">Dari penjualan 30 hari terakhir ESB (~{Math.round(esbTargetRec / 30)}/hari).</p>}
            </div>
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
            {/* Referensi UMP 2026 (BPS, lampiran makalah) — kebijakan MoM:
                BTKL memakai kualifikasi standar skala tertinggi. */}
            <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-border/60 pt-2.5">
              <div className="min-w-40 flex-1">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Referensi UMP 2026 (BPS)</p>
                <Combobox
                  portal
                  matchTriggerWidth
                  value={umpProv}
                  onChange={setUmpProv}
                  options={UMP_SORTED.map((u, i) => ({ value: u.prov, label: `${u.prov} — Rp ${u.ump.toLocaleString("id-ID")}${i === 0 ? " · Tertinggi (rekomendasi)" : ""}` }))}
                  searchPlaceholder="Cari provinsi…"
                />
              </div>
              <div className="w-20 shrink-0">
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Staf</p>
                <NumInput value={umpStaff} onChange={setUmpStaff} placeholder="1" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const u = UMP_2026.find((x) => x.prov === umpProv);
                  if (!u) return toast.error("Pilih provinsi dulu.");
                  setBtkl(Math.round(u.ump * Math.max(1, umpStaff)));
                  toast.success(`BTKL diisi dari UMP ${u.prov} × ${Math.max(1, umpStaff)} staf`);
                }}
              >
                Terapkan
              </Button>
              <p className="w-full text-[10px] text-muted-foreground">Standar skala tertinggi berlaku untuk seluruh brand (MoM Juni 2026).</p>
            </div>
          </div>

          {/* Overhead templates — save a common set once, apply to any product.
              Applying only pre-fills the rows below; every value stays editable. */}
          <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileStack className="size-4 shrink-0 text-muted-foreground" />
                {templates.length > 0 ? (
                  <div className="min-w-0 flex-1">
                    <Combobox
                      portal
                      matchTriggerWidth
                      value={appliedTpl?.id ?? ""}
                      onChange={applyTemplate}
                      options={templates.map((t) => ({ value: t.id, label: t.name, hint: `${t.items.length} biaya` }))}
                      placeholder="Terapkan template overhead…"
                      searchPlaceholder="Cari template…"
                    />
                  </div>
                ) : (
                  <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">Belum ada template. Susun overhead lalu simpan sebagai template agar bisa dipakai ulang.</p>
                )}
              </div>
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={saveAsTemplate} disabled={savingTpl}>
                  {savingTpl ? <Loader2 className="size-4 animate-spin" /> : <BookmarkPlus className="size-4" />} Simpan Template
                </Button>
              )}
            </div>
            {appliedTpl && (
              <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2 text-[11px]">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Template: {appliedTpl.name}</span>
                <span className="text-muted-foreground">nilai bisa diedit bebas</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeTemplate(appliedTpl.id, appliedTpl.name)}
                    disabled={savingTpl}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-red-500 disabled:opacity-50"
                    title="Hapus template ini"
                  >
                    <Trash2 className="size-3.5" /> Hapus template
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Overhead Tetap — biaya bulanan yang relatif stabil (sewa alat, langganan). */}
          <OverheadGroup
            icon={Boxes}
            title="Overhead Tetap"
            desc="Biaya bulanan yang stabil (mis. sewa alat, langganan, perawatan)."
            items={fixedTetap}
            total={fixedTetap.reduce((s, f) => s + (f.monthly || 0), 0)}
            placeholder="Nama biaya (mis. Sewa Alat, Langganan)"
            addLabel="Tambah Overhead Tetap"
            onAdd={() => addFixed("fixed")}
            onName={(id, v) => setFix(id, { name: v })}
            onMonthly={(id, n) => setFix(id, { monthly: n })}
            onRemove={(id) => setFixed((x) => x.filter((i) => i.id !== id))}
          />

          {/* Overhead Variabel / Operasional — ikut volume produksi (gas, listrik, air). */}
          <OverheadGroup
            icon={Gauge}
            title="Overhead Variabel / Operasional"
            desc="Ikut volume produksi (mis. gas, listrik, air)."
            items={fixedVar}
            total={fixedVar.reduce((s, f) => s + (f.monthly || 0), 0)}
            placeholder="Nama biaya (mis. Gas, Listrik, Air)"
            addLabel="Tambah Overhead Variabel"
            onAdd={() => addFixed("variable")}
            onName={(id, v) => setFix(id, { name: v })}
            onMonthly={(id, n) => setFix(id, { monthly: n })}
            onRemove={(id) => setFixed((x) => x.filter((i) => i.id !== id))}
            className="mt-3"
          />
        </div>
      </div>

      {/* ============ RIGHT: RESULTS ============ */}
      {/* Desktop: pin the results panel below the sticky topbar (h-16) and let it
          scroll internally, so the HPP figures stay visible while editing inputs. */}
      <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
        {/* HPP breakdown */}
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calculator className="size-4 text-muted-foreground" /> Rincian HPP per Produk
          </p>
          {/* Urutan mengikuti tujuh langkah makalah GWG (Bab IV.2.A). */}
          <div className="space-y-1.5 text-sm">
            <Row label="1–2 · Bahan Baku" value={rp(bd.bahanBaku)} hint="Harga tertinggi wilayah setempat" />
            <Row label="3 · BTKL (dapur/bar)" value={rp(bd.btkl)} hint={btkl > 0 ? `${rp(btkl)} / bulan ÷ ${bd.allocUnits} unit` : "Belum diisi"} />
            <Row label="4 · Overhead" value={rp(bd.overhead)} hint={`Listrik/gas/lain ${rp(bd.overheadOps)} + waste ${wastePct}% ${rp(bd.waste)}`} />
            <Row label="5 · Packing" value={rp(bd.packing)} hint="Kemasan primer — setara HPP dasar" />
            <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2.5">
              <span className="min-w-0 font-semibold text-foreground">6 · Total HPP per Produk</span>
              <span className="shrink-0 text-lg font-bold tabular-nums text-primary">{rp(hpp)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pt-1 text-xs">
              <span className="shrink-0 text-muted-foreground">HPP terhadap harga jual</span>
              <span className={cn("text-right font-semibold tabular-nums", hppSt.tone === "bad" ? "text-red-600 dark:text-red-400" : hppSt.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                {(hppPctVal * 100).toFixed(1)}% · {hppSt.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Harga jual minimum agar margin {category === "minuman" ? "minuman" : "makanan"} ≥{MIN_MARGIN[category] * 100}%:{" "}
              <span className="font-semibold text-foreground">{rp(minPriceForCategory(hpp, category))}</span> (sebelum pajak)
            </p>
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
              Food cost {(fc * 100).toFixed(1)}% · target ≤{(targetFc * 100).toFixed(0)}% · {fcStatus.label}
            </span>
          </div>
          <p className="-mt-1 mb-2 text-[10px] text-muted-foreground">
            Target food cost {category === "minuman" ? "minuman" : "makanan"} {(targetFc * 100).toFixed(0)}% —{" "}
            {policyCustom ? <span className="font-medium text-primary">kustom {brand}</span> : "kebijakan default perusahaan"}.
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Saran harga pakai band margin {category === "minuman" ? "minuman" : "makanan"}{" "}
            <span className="font-medium text-foreground">{(marginBand.min * 100).toFixed(0)}–{(marginBand.max * 100).toFixed(0)}%</span>
            {policyCustom ? <span className="text-primary"> (kustom {brand})</span> : ""} · mulai dari margin minimum · atur di Kebijakan Costing.
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
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground">Harga jual (tanpa pajak)</span>
              <span className="font-semibold tabular-nums text-foreground">{rp(price)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground">+ PBJT 10% (referensi struk)</span>
              <span className="tabular-nums text-muted-foreground">{rp(price * 0.1)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/60 pt-1.5">
              <span className="min-w-0 truncate text-muted-foreground">Harga after-tax (referensi)</span>
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
              {classPrices(price, hpp).map((c) => {
                const st = hppStatus(c.hppPct, category, brand);
                return (
                  <div key={c.cls} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="min-w-0">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">{c.label}</span>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.cls === 1 ? "Base price" : `+Rp ${((c.cls - 1) * 5000).toLocaleString("id-ID")} dari Class 1`} · HPP {(c.hppPct * 100).toFixed(1)}% · Margin {(c.margin * 100).toFixed(1)}%
                      </p>
                      <p className={cn("text-[10px]", st.tone === "bad" ? "text-red-600 dark:text-red-400" : st.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>{st.label}</p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-foreground">{rp(c.price)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Target & projection — compact Fraud-style stat row (not dominant) */}
        <div className="glass rounded-2xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Target &amp; Proyeksi Penjualan</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                proj.netProfit >= targetProfit ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/12 text-amber-600 dark:text-amber-400",
              )}
            >
              {proj.netProfit >= targetProfit ? "Target tercapai" : "Di bawah target"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Target Laba Bersih / Bulan">
              <NumInput value={targetProfit} onChange={setTargetProfit} placeholder="Rp" />
            </Field>
            <Field label="Harga Jual Pilihan (Rp)">
              <NumInput value={price} onChange={setChosenPrice} placeholder="Rp" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <ProjStat icon={CalendarDays} label="Target / Hari" value={`${proj.perDay} pcs`} />
            <ProjStat icon={BarChart3} label="Target / Bulan" value={`${proj.targetUnit.toLocaleString("id-ID")} pcs`} />
            <ProjStat icon={TrendingUp} label="Potensi Omzet" value={rp(proj.omzet)} />
            <ProjStat icon={Boxes} label="Biaya Produksi" value={rp(proj.totalProdCost)} />
            <ProjStat icon={Boxes} label="Biaya Tetap" value={rp(proj.totalFixed)} />
            <ProjStat
              icon={TrendingUp}
              label="Laba Bersih"
              value={rp(proj.netProfit)}
              tone={proj.netProfit >= targetProfit ? "good" : "warn"}
            />
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
            <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border">
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
                        if (!(await confirm({ title: `Hapus perhitungan "${r.name}"?`, confirmLabel: "Hapus", tone: "danger" }))) return;
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
      {confirmDialog}
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

/** One overhead category (Tetap or Variabel) — labelled rows + subtotal + add. */
function OverheadGroup({
  icon: Icon,
  title,
  desc,
  items,
  total,
  placeholder,
  addLabel,
  onAdd,
  onName,
  onMonthly,
  onRemove,
  className,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  items: FixedItem[];
  total: number;
  placeholder: string;
  addLabel: string;
  onAdd: () => void;
  onName: (id: string, v: string) => void;
  onMonthly: (id: string, n: number) => void;
  onRemove: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/20 p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
          <Icon className="size-4 shrink-0 text-muted-foreground" /> <span className="min-w-0 truncate">{title}</span>
        </p>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">{rp(total)}/bln</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      {items.length > 0 && (
        <div className="mt-2 space-y-2">
          {items.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input value={f.name} onChange={(e) => onName(f.id, e.target.value)} placeholder={placeholder} className="flex-1" />
              <div className="w-32 shrink-0">
                <NumInput value={f.monthly} onChange={(n) => onMonthly(f.id, n)} placeholder="Rp/bln" />
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                title="Hapus biaya"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="size-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  // Hint-nya bisa panjang ("Rp 5.000.000 / bulan ÷ 1000 unit"). Tanpa min-w-0
  // pada label dan shrink-0 pada nilai, nominalnya terdesak keluar baris.
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[11px] text-muted-foreground/70">({hint})</span>}
      </span>
      <span className="shrink-0 font-medium tabular-nums text-foreground">{value}</span>
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

/** Compact metric row (Fraud-page style): neutral icon chip + label + value.
 *  Deliberately small so the projection block never dominates the page. */
function ProjStat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
        <p className={cn(
          "truncate text-sm font-semibold tabular-nums",
          tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground",
        )}>{value}</p>
      </div>
    </div>
  );
}
