/**
 * HPP (Harga Pokok Produksi) engine — GWG Group formula (makalah Juni 2026).
 *
 *   HPP = Biaya Variabel (bahan baku + packing) + Alokasi Biaya Tetap per produk
 *   Harga Jual = HPP + %Margin (tanpa pajak)
 *
 * Kebijakan: sewa & pajak (PBJT) TIDAK masuk HPP; waste normal ≤5%; margin
 * minimal 30%; food cost sehat ≤35%. Semua deterministik (tanpa AI eksternal).
 */

export type UnitDim = "mass" | "volume" | "count";

/** Supported units grouped by dimension, with factor to the base unit. */
export const UNITS: Record<string, { dim: UnitDim; factor: number; label: string }> = {
  g: { dim: "mass", factor: 1, label: "gram (g)" },
  kg: { dim: "mass", factor: 1000, label: "kilogram (kg)" },
  ml: { dim: "volume", factor: 1, label: "mililiter (ml)" },
  L: { dim: "volume", factor: 1000, label: "liter (L)" },
  pcs: { dim: "count", factor: 1, label: "pcs" },
};

export interface VariableItem {
  id: string;
  name: string;
  takaran: number; // amount used to make ONE product
  takaranUnit: string; // g / ml / pcs / kg / L
  buyPrice: number; // purchase price
  buyQty: number; // purchase quantity
  buyUnit: string; // kg / L / pcs / g / ml
  /** Linked master-ingredient id (optional) — enables price-change propagation. */
  ingredientId?: string;
}

export interface FixedItem {
  id: string;
  name: string;
  monthly: number; // Rp / month
}

/** Bagi Rata = split across every product; Produk Ini Saja = all to this one. */
export type AllocMode = "even" | "product";

export interface HppInput {
  variables: VariableItem[];
  fixed: FixedItem[];
  allocMode: AllocMode;
  /** Monthly sales target for THIS product (units). */
  targetSales: number;
  /** Total monthly units across ALL products (only used for allocMode "even"). */
  totalUnitsAllProducts?: number;
}

/** Cost of one variable-cost row for a single product. */
export function itemSubtotal(v: VariableItem): number {
  const t = UNITS[v.takaranUnit];
  const b = UNITS[v.buyUnit];
  // Mismatched/unknown units → treat as a plain per-piece price.
  if (!t || !b || t.dim !== b.dim) {
    const perUnit = v.buyQty ? v.buyPrice / v.buyQty : 0;
    return round2(perUnit * (v.takaran || 0));
  }
  const purchaseBase = (v.buyQty || 0) * b.factor; // e.g. 1 kg → 1000 g
  const costPerBase = purchaseBase ? v.buyPrice / purchaseBase : 0; // Rp per g
  return round2(costPerBase * (v.takaran || 0) * t.factor); // × takaran (in base)
}

export interface HppResult {
  variableCost: number; // Biaya Variabel per Produk
  totalFixed: number; // total biaya tetap / bulan
  fixedAlloc: number; // Alokasi Biaya Tetap per Produk
  hpp: number; // Total HPP per Produk
  target: number; // sales target used
}

export function calcHpp(input: HppInput): HppResult {
  const variableCost = round2(input.variables.reduce((s, v) => s + itemSubtotal(v), 0));
  const totalFixed = round2(input.fixed.reduce((s, f) => s + (f.monthly || 0), 0));
  const denom =
    input.allocMode === "even"
      ? Math.max(1, input.totalUnitsAllProducts || input.targetSales || 0)
      : Math.max(1, input.targetSales || 0);
  const fixedAlloc = round2(totalFixed / denom);
  const hpp = round2(variableCost + fixedAlloc);
  return { variableCost, totalFixed, fixedAlloc, hpp, target: Math.max(1, input.targetSales || 0) };
}

export interface PriceTier {
  key: "kompetitif" | "standar" | "premium";
  label: string;
  targetMargin: number;
  price: number;
  profit: number;
  margin: number;
  note: string;
}

/** Round a price up to the nearest Rp 500 for tidy shelf prices. */
export function roundPrice(p: number, step = 500): number {
  return Math.ceil(p / step) * step;
}

export type Brand = "Nordu" | "Cattu" | "Busari" | "Lesung Pipi";
export const BRANDS: Brand[] = ["Nordu", "Cattu", "Busari", "Lesung Pipi"];

/** Gross-margin bands per brand (on selling price), from the GWG makalah:
 *  Nordu 35–40%, Cattu 35–40% (min 35%), Busari 30–35% (min 30%). Bar ≥30%.
 *  Lesung Pipi follows the group default (min 30%, ideal 35–40%). */
export const BRAND_MARGIN: Record<Brand, { min: number; idealLow: number; idealHigh: number }> = {
  Nordu: { min: 0.35, idealLow: 0.35, idealHigh: 0.4 },
  Cattu: { min: 0.35, idealLow: 0.35, idealHigh: 0.4 },
  Busari: { min: 0.3, idealLow: 0.3, idealHigh: 0.35 },
  "Lesung Pipi": { min: 0.3, idealLow: 0.35, idealHigh: 0.4 },
};

/** Three price suggestions from HPP + margin bands. Brand-aware when given a
 *  brand (uses that brand's band, floor 30%); otherwise generic 30/40/48%. */
export function priceTiers(hpp: number, brand?: Brand): PriceTier[] {
  const band = brand ? BRAND_MARGIN[brand] : null;
  const margins = band
    ? { kompetitif: Math.max(0.3, band.min), standar: band.idealHigh, premium: Math.min(0.6, band.idealHigh + 0.08) }
    : { kompetitif: 0.3, standar: 0.4, premium: 0.48 };
  const defs: Omit<PriceTier, "price" | "profit" | "margin">[] = [
    { key: "kompetitif", label: "Kompetitif", targetMargin: margins.kompetitif, note: "Margin minimum brand — untuk menarik pelanggan." },
    { key: "standar", label: "Standar", targetMargin: margins.standar, note: "Margin ideal brand dengan keuntungan sehat." },
    { key: "premium", label: "Premium", targetMargin: margins.premium, note: "Harga lebih tinggi, didukung kualitas bahan & branding unggul." },
  ];
  return defs.map((d) => {
    const price = hpp > 0 ? roundPrice(hpp / (1 - d.targetMargin)) : 0;
    const profit = price - hpp;
    const margin = price > 0 ? profit / price : 0;
    return { ...d, price, profit, margin };
  });
}

export interface Sensitivity {
  newVariable: number;
  newHpp: number;
  deltaHpp: number;
  deltaPct: number;
  minPrice: number; // agar tidak rugi
  marginAtChosen: number;
}

/** Impact of a raw-material price increase (fraction, e.g. 0.25 = +25%). */
export function sensitivity(variableCost: number, fixedAlloc: number, pctIncrease: number, chosenPrice: number): Sensitivity {
  const baseHpp = variableCost + fixedAlloc;
  const newVariable = round2(variableCost * (1 + pctIncrease));
  const newHpp = round2(newVariable + fixedAlloc);
  const deltaHpp = round2(newHpp - baseHpp);
  return {
    newVariable,
    newHpp,
    deltaHpp,
    deltaPct: baseHpp > 0 ? deltaHpp / baseHpp : 0,
    minPrice: newHpp,
    marginAtChosen: chosenPrice > 0 ? (chosenPrice - newHpp) / chosenPrice : 0,
  };
}

export interface Projection {
  contribution: number; // margin kontribusi per unit
  bepUnit: number; // titik impas (unit)
  bepRevenue: number;
  targetUnit: number; // total jual / bulan untuk capai target laba
  perDay: number; // target jual / hari
  omzet: number; // potensi omzet / bulan
  totalProdCost: number; // total biaya produksi / bulan
  totalFixed: number;
  netProfit: number; // proyeksi laba bersih / bulan
}

/** Break-even + monthly profit projection at a chosen price and profit target. */
export function projection(variableCost: number, totalFixed: number, price: number, targetProfit: number, daysPerMonth = 30): Projection {
  const contribution = round2(price - variableCost);
  const bepUnit = contribution > 0 ? Math.ceil(totalFixed / contribution) : 0;
  const targetUnit = contribution > 0 ? Math.ceil((totalFixed + Math.max(0, targetProfit)) / contribution) : 0;
  const omzet = round2(targetUnit * price);
  const totalProdCost = round2(variableCost * targetUnit + totalFixed);
  return {
    contribution,
    bepUnit,
    bepRevenue: round2(bepUnit * price),
    targetUnit,
    perDay: daysPerMonth ? round1(targetUnit / daysPerMonth) : targetUnit,
    omzet,
    totalProdCost,
    totalFixed,
    netProfit: round2(omzet - totalProdCost),
  };
}

/** Points for the BEP chart (revenue vs total cost across unit volume). */
export function bepSeries(price: number, variableCost: number, totalFixed: number, maxUnits: number, points = 40) {
  const max = Math.max(1, Math.ceil(maxUnits));
  const step = Math.max(1, Math.round(max / points));
  const out: { unit: number; pendapatan: number; biaya: number }[] = [];
  for (let u = 0; u <= max; u += step) out.push({ unit: u, pendapatan: round2(price * u), biaya: round2(totalFixed + variableCost * u) });
  if (out[out.length - 1]?.unit !== max) out.push({ unit: max, pendapatan: round2(price * max), biaya: round2(totalFixed + variableCost * max) });
  return out;
}

/** Food cost % = variable cost ÷ price (health: ≤35% ideal, >70% over cost). */
export function foodCostPct(variableCost: number, price: number): number {
  return price > 0 ? variableCost / price : 0;
}

export type CostTone = "good" | "warn" | "bad";

/** Food-cost health vs the costing policy target. `targetPct` is the target
 *  food cost for this (brand, category) as a fraction (e.g. 0.35). Defaults to
 *  35% makanan / 25% minuman when no policy is supplied. >70% = over cost.
 *  A small tolerance above target counts as "sedikit di atas" (warn), not bad. */
export function foodCostStatus(fc: number, category: "makanan" | "minuman", targetPct?: number): { tone: CostTone; label: string } {
  const pct = fc * 100;
  const target = (targetPct ?? (category === "minuman" ? 0.25 : 0.35)) * 100;
  if (pct <= 0) return { tone: "warn", label: "Isi harga & bahan" };
  if (pct > 70) return { tone: "bad", label: "Over cost (>70%)" };
  if (pct <= target) return { tone: "good", label: `Sesuai target (≤${target.toFixed(0)}%)` };
  if (pct <= target + 5) return { tone: "warn", label: `Sedikit di atas target (${target.toFixed(0)}%)` };
  return { tone: "warn", label: `Perlu evaluasi (>${target.toFixed(0)}%)` };
}

/** Waste cost = wastePct of raw-material (variable) cost — GWG waste normal ≤5%. */
export function wasteCost(variableCost: number, wastePct: number): number {
  return round2(variableCost * (Math.max(0, wastePct) / 100));
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
