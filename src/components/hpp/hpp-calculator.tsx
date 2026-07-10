"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Calculator,
  Check,
  ChevronsUpDown,
  Coffee,
  History,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
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
  UNITS,
  bepSeries,
  calcHpp,
  foodCostPct,
  itemSubtotal,
  priceTiers,
  projection,
  roundPrice,
  sensitivity,
  type AllocMode,
  type FixedItem,
  type VariableItem,
} from "@/lib/hpp/calc";
import { saveHppAction, deleteHppAction } from "@/lib/actions/hpp";
import type { HppRecord } from "@/lib/data/hpp";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
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

export function HppCalculator({ initialHistory, canEdit }: { initialHistory: HppRecord[]; canEdit: boolean }) {
  const router = useRouter();
  const [saving, startSave] = React.useTransition();

  const [name, setName] = React.useState("");
  const [image, setImage] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<"makanan" | "minuman">("minuman");
  const [mode, setMode] = React.useState<"per_pcs" | "per_resep">("per_pcs");
  const [yieldPcs, setYieldPcs] = React.useState(1); // pcs per resep (per_resep only)
  const [variables, setVariables] = React.useState<VariableItem[]>([]);
  const [allocMode, setAllocMode] = React.useState<AllocMode>("product");
  const [targetSales, setTargetSales] = React.useState(1000);
  const [totalUnitsAll, setTotalUnitsAll] = React.useState(1000);
  const [fixed, setFixed] = React.useState<FixedItem[]>([]);

  const [sensPct, setSensPct] = React.useState(0);
  const [chosenPrice, setChosenPrice] = React.useState(0);
  const [targetProfit, setTargetProfit] = React.useState(10_000_000);
  const [chartView, setChartView] = React.useState<"grafik" | "tabel">("grafik");
  const fileRef = React.useRef<HTMLInputElement>(null);

  // ---- derived ----
  const base = React.useMemo(
    () => calcHpp({ variables, fixed, allocMode, targetSales, totalUnitsAllProducts: totalUnitsAll }),
    [variables, fixed, allocMode, targetSales, totalUnitsAll],
  );
  // Per resep: variable cost is per batch → divide by yield to get per-pcs.
  const divisor = mode === "per_resep" ? Math.max(1, yieldPcs) : 1;
  const variableCost = base.variableCost / divisor;
  const fixedAlloc = base.fixedAlloc;
  const hpp = variableCost + fixedAlloc;

  const tiers = React.useMemo(() => priceTiers(hpp), [hpp]);
  const price = chosenPrice || tiers[1]?.price || 0; // default: Standar
  const sens = React.useMemo(() => sensitivity(variableCost, fixedAlloc, sensPct / 100, price), [variableCost, fixedAlloc, sensPct, price]);
  const proj = React.useMemo(() => projection(variableCost, base.totalFixed, price, targetProfit), [variableCost, base.totalFixed, price, targetProfit]);
  const fc = foodCostPct(variableCost, price);
  const series = React.useMemo(
    () => bepSeries(price, variableCost, base.totalFixed, Math.max(proj.targetUnit, proj.bepUnit) * 1.05 || 100),
    [price, variableCost, base.totalFixed, proj.targetUnit, proj.bepUnit],
  );

  const setVar = (id: string, patch: Partial<VariableItem>) => setVariables((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
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
    setMode("per_pcs");
    setYieldPcs(1);
    setVariables([]);
    setFixed([]);
    setAllocMode("product");
    setTargetSales(1000);
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
        mode,
        allocMode,
        targetSales,
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
      ["Kategori", category === "makanan" ? "Makanan" : "Minuman"],
      ["Total HPP / Produk", Math.round(hpp)],
      ["  Biaya Variabel / Produk", Math.round(variableCost)],
      ["  Alokasi Biaya Tetap / Produk", Math.round(fixedAlloc)],
      ["Harga Jual Pilihan", Math.round(price)],
      ["Food cost %", `${(fc * 100).toFixed(1)}%`],
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
    setMode(r.mode === "per_resep" ? "per_resep" : "per_pcs");
    setVariables(r.variables);
    setFixed(r.fixed);
    setAllocMode(r.allocMode);
    setTargetSales(r.targetSales || 1000);
    setChosenPrice(r.chosenPrice || 0);
    setTargetProfit(r.targetProfit || 10_000_000);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ============ LEFT: INPUT ============ */}
      <div className="space-y-4">
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="size-4 text-muted-foreground" /> Data Produk
          </p>
          <Field label="Nama Produk">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Kopi Susu Gula Aren" />
          </Field>

          <div className="mt-3">
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

          <div className="mt-3">
            <Label>Gambar Produk (opsional)</Label>
            <div className="mt-1.5 flex items-center gap-3">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="produk" className="size-16 rounded-xl object-cover ring-1 ring-border" />
              ) : (
                <div className="grid size-16 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                  <ImagePlus className="size-6" />
                </div>
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onImage} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-4" /> Pilih Gambar
                </Button>
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
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-muted-foreground" /> Biaya Variabel (Bahan Baku + Packing)
            </p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary tabular-nums">{rp(base.variableCost)}</span>
          </div>
          <p className="mb-3 text-[11px] text-muted-foreground">Semua bahan untuk membuat {mode === "per_resep" ? "satu resep" : "satu produk"}. Pakai harga tertinggi (antisipasi inflasi).</p>

          <div className="space-y-2">
            {variables.map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-muted/20 p-2.5">
                <div className="flex items-center gap-2">
                  <Input value={v.name} onChange={(e) => setVar(v.id, { name: e.target.value })} placeholder="Nama bahan (mis. Kopi Espresso)" className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setVariables((x) => x.filter((i) => i.id !== v.id))}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                    title="Hapus bahan"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Takaran / produk</p>
                    <div className="flex gap-1.5">
                      <NumInput value={v.takaran} onChange={(n) => setVar(v.id, { takaran: n })} className="w-full" placeholder="0" />
                      <div className="w-20 shrink-0">
                        <UnitSelect value={v.takaranUnit} onChange={(u) => setVar(v.id, { takaranUnit: u })} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Harga beli / jml</p>
                    <div className="flex gap-1.5">
                      <NumInput value={v.buyPrice} onChange={(n) => setVar(v.id, { buyPrice: n })} className="w-full" placeholder="Rp" />
                      <NumInput value={v.buyQty} onChange={(n) => setVar(v.id, { buyQty: n })} className="w-14 shrink-0" placeholder="1" />
                      <div className="w-20 shrink-0">
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
        </div>

        {/* Fixed costs */}
        <div className="glass rounded-2xl border border-border p-5">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Alokasi Biaya Tetap per Produk</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{rp(base.totalFixed)}/bln</span>
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

          <div className="mt-3 space-y-2">
            {fixed.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <Input value={f.name} onChange={(e) => setFix(f.id, { name: e.target.value })} placeholder="Nama biaya (mis. Listrik & Air)" className="flex-1" />
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
      <div className="space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
        {/* HPP breakdown */}
        <div className="glass rounded-2xl border border-border p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calculator className="size-4 text-muted-foreground" /> Rincian HPP per Produk
          </p>
          <div className="space-y-1.5 text-sm">
            <Row label="Biaya Variabel per Produk" value={rp(variableCost)} />
            <Row label="Alokasi Biaya Tetap" value={rp(fixedAlloc)} hint={`Total ${rp(base.totalFixed)} / ${allocMode === "even" ? totalUnitsAll : targetSales} unit`} />
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
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Saran Harga Jual</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Food cost {(fc * 100).toFixed(1)}%</span>
          </div>
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
        </div>

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
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      HPP {rp(r.hpp)} · Harga {rp(r.chosenPrice)} · {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
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
