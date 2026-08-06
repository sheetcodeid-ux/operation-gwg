/**
 * Mesin HPP GWG Group — mengikuti makalah "Analisis Penetapan Harga Pokok
 * Penjualan (HPP) All Menu", Juli 2026 (MoM 19/22/25 & rangkuman 29 Juni 2026).
 *
 * Tujuh langkah resmi (Bab IV.2.A):
 *   1. HPP Dasar ............ bahan baku, memakai HARGA TERTINGGI wilayah
 *   2. + Bahan Baku ......... komposisi penyusun menu
 *   3. + BTKL ............... biaya tenaga kerja langsung (dapur/bar)
 *   4. + Overhead ........... listrik + gas + waste (5%) + lain-lain
 *   5. + Packing ............ kemasan primer, setara HPP dasar
 *   6. = Total HPP
 *   7. Harga Jual ........... Total HPP + %margin (SEBELUM pajak)
 *
 * Keputusan final (Lampiran makalah):
 *   • PBJT dan sewa bangunan DIKELUARKAN dari HPP maupun overhead
 *   • Waste normal maksimal 5%, diukur nyata; waste abnormal = beban periode
 *   • HPP (food & drink) maksimal 70% dari harga jual — di atas itu over cost
 *   • Margin makanan minimal 35%, minuman/bar minimal 60%, maksimal tanpa batas
 *   • Class Nordu: harga jual naik Rp5.000 per class, HPP tetap
 *   • HPP wajib diperbarui bila harga bahan naik lebih dari 5%
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

/** Peran satu baris biaya langsung: bahan baku, atau kemasan primer.
 *  Makalah menempatkan packing setara HPP dasar tapi tetap dilaporkan sebagai
 *  komponen tersendiri (langkah 5), jadi keduanya dibedakan di sini. */
export type CostRole = "bahan" | "packing";

export interface VariableItem {
  id: string;
  name: string;
  /** Default `bahan` bila kosong — kompatibel dengan data lama. */
  role?: CostRole;
  takaran: number; // amount used to make ONE product
  takaranUnit: string; // g / ml / pcs / kg / L
  buyPrice: number; // purchase price
  buyQty: number; // purchase quantity
  buyUnit: string; // kg / L / pcs / g / ml
  /** Linked master-ingredient id (optional) — enables price-change propagation. */
  ingredientId?: string;
}

/** Overhead nature: `fixed` = tetap tiap bulan (mis. sewa alat, langganan);
 *  `variable` = operasional yang ikut volume produksi (mis. gas, listrik, air).
 *  Keduanya dialokasikan per produk dengan cara yang sama (bulanan ÷ unit) —
 *  pemisahan ini untuk kejelasan & pelaporan, bukan mengubah rumus HPP. */
export type OverheadKind = "fixed" | "variable";

export interface FixedItem {
  id: string;
  name: string;
  monthly: number; // Rp / month
  /** Klasifikasi overhead (default `fixed` bila tidak diisi — kompatibel mundur). */
  kind?: OverheadKind;
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

/* ═══════════════════ kebijakan resmi (Lampiran makalah) ═══════════════════ */

/** HPP di atas 70% dari harga jual = over cost, wajib evaluasi ulang. */
export const HPP_OVER_COST = 0.7;
/** Margin minimum per kategori; maksimal tanpa batas. */
export const MIN_MARGIN: Record<"makanan" | "minuman", number> = { makanan: 0.35, minuman: 0.6 };
/** Waste normal maksimal 5% dari bahan baku. */
export const WASTE_NORMAL_MAX = 5;
/** HPP wajib diperbarui bila harga bahan naik lebih dari 5%. */
export const PRICE_UPDATE_TRIGGER = 0.05;
/** Sistem class Nordu: tiap naik satu class, harga jual +Rp5.000. */
export const CLASS_STEP = 5000;

/* ═══════════════════════ mesin HPP tujuh langkah ═══════════════════════ */

export interface HppV2Input {
  /** Bahan baku & kemasan; dibedakan lewat `role`. */
  variables: VariableItem[];
  /** Overhead operasional per bulan (listrik, gas, air, lain-lain). */
  fixed: FixedItem[];
  /** Biaya tenaga kerja langsung dapur/bar per bulan. */
  btklMonthly: number;
  /** Persen waste normal terhadap bahan baku (maksimal 5%). */
  wastePct: number;
  allocMode: AllocMode;
  targetSales: number;
  totalUnitsAllProducts?: number;
  /** Mode per resep: hasil satu batch, untuk membagi biaya ke per porsi. */
  yieldPcs?: number;
}

/** Rincian HPP per produk, mengikuti urutan langkah pada makalah. */
export interface HppBreakdown {
  /** Langkah 1–2: bahan baku (harga tertinggi). */
  bahanBaku: number;
  /** Langkah 3: BTKL per produk. */
  btkl: number;
  /** Overhead operasional per produk (listrik, gas, air, lain-lain). */
  overheadOps: number;
  /** Waste normal — bagian dari overhead (langkah 4). */
  waste: number;
  /** Langkah 4 total: overhead operasional + waste. */
  overhead: number;
  /** Langkah 5: kemasan primer. */
  packing: number;
  /** Langkah 6. */
  totalHpp: number;
  /** HPP dasar = bahan baku + packing (makalah: packing setara HPP dasar). */
  hppDasar: number;
  /** Total overhead bulanan sebelum dialokasikan (untuk pelaporan). */
  totalFixedMonthly: number;
  /** Pembagi alokasi yang dipakai. */
  allocUnits: number;
}

/** Hitung HPP satu produk mengikuti tujuh langkah makalah. */
export function calcHppV2(input: HppV2Input): HppBreakdown {
  const divisor = Math.max(1, input.yieldPcs && input.yieldPcs > 1 ? input.yieldPcs : 1);
  const sumRole = (role: CostRole) =>
    input.variables.filter((v) => (v.role ?? "bahan") === role).reduce((s, v) => s + itemSubtotal(v), 0) / divisor;

  const bahanBaku = round2(sumRole("bahan"));
  const packing = round2(sumRole("packing"));

  const totalFixedMonthly = round2(input.fixed.reduce((s, f) => s + (f.monthly || 0), 0));
  const allocUnits =
    input.allocMode === "even"
      ? Math.max(1, input.totalUnitsAllProducts || input.targetSales || 0)
      : Math.max(1, input.targetSales || 0);

  const overheadOps = round2(totalFixedMonthly / allocUnits);
  const btkl = round2(Math.max(0, input.btklMonthly || 0) / allocUnits);
  // Waste normal dihitung dari bahan baku saja — kemasan tidak menyusut.
  const waste = round2(bahanBaku * (Math.max(0, input.wastePct) / 100));
  const overhead = round2(overheadOps + waste);

  const totalHpp = round2(bahanBaku + btkl + overhead + packing);
  return {
    bahanBaku,
    btkl,
    overheadOps,
    waste,
    overhead,
    packing,
    totalHpp,
    hppDasar: round2(bahanBaku + packing),
    totalFixedMonthly,
    allocUnits,
  };
}

/** Persentase HPP terhadap harga jual — inilah angka yang dipakai kebijakan
 *  over cost (>70%), bukan food cost bahan baku saja. */
export function hppPct(totalHpp: number, price: number): number {
  return price > 0 ? totalHpp / price : 0;
}

/** Target HPP per brand (Bab IV.3). Cattu tidak punya batas bawah. */
export const BRAND_HPP_TARGET: Record<Brand, { min: number; max: number }> = {
  Nordu: { min: 0.6, max: 0.65 },
  Cattu: { min: 0, max: 0.65 },
  Busari: { min: 0.65, max: 0.7 },
  "Lesung Pipi": { min: 0.6, max: 0.65 },
};

/**
 * Status kesehatan satu menu berdasarkan HPP% dan margin minimum kategori.
 * Urutan penilaian: over cost (>70%) → margin di bawah minimum → di atas target
 * brand → aman.
 */
export function hppStatus(
  pct: number,
  category: "makanan" | "minuman",
  brand?: Brand,
): { tone: CostTone; label: string } {
  const p = pct * 100;
  if (p <= 0) return { tone: "warn", label: "Isi harga & bahan" };
  if (pct > HPP_OVER_COST) return { tone: "bad", label: `Over cost (>${HPP_OVER_COST * 100}%)` };

  const minMargin = MIN_MARGIN[category];
  const margin = 1 - pct;
  if (margin < minMargin) {
    return { tone: "bad", label: `Margin ${(margin * 100).toFixed(1)}% < minimum ${minMargin * 100}%` };
  }

  const target = brand ? BRAND_HPP_TARGET[brand] : null;
  if (target && pct > target.max) {
    return { tone: "warn", label: `Di atas target brand (${target.max * 100}%)` };
  }
  return { tone: "good", label: `Aman — margin ${(margin * 100).toFixed(1)}%` };
}

/** Harga jual minimum agar margin kategori terpenuhi. */
export function minPriceForCategory(totalHpp: number, category: "makanan" | "minuman"): number {
  const m = MIN_MARGIN[category];
  return totalHpp > 0 ? roundPrice(totalHpp / (1 - m)) : 0;
}

export interface ClassPrice {
  cls: 1 | 2 | 3;
  label: string;
  price: number;
  hppPct: number;
  margin: number;
  profit: number;
}

/**
 * Sistem class Nordu: HPP tetap sama, harga jual naik Rp5.000 tiap class.
 * Class 1 memakai harga dasar, Class 2 = +Rp5.000, Class 3 = +Rp5.000 lagi.
 */
export function classPrices(basePrice: number, totalHpp: number, step = CLASS_STEP): ClassPrice[] {
  return ([1, 2, 3] as const).map((cls) => {
    const price = basePrice + step * (cls - 1);
    const profit = price - totalHpp;
    return {
      cls,
      label: `Class ${cls}`,
      price,
      hppPct: hppPct(totalHpp, price),
      margin: price > 0 ? profit / price : 0,
      profit,
    };
  });
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

/** Rentang margin harga jual per brand (makalah Bab IV.3):
 *  Nordu 35–40%, Cattu minimal 35%, Busari 30–35%. Menu bar mengikuti
 *  MIN_MARGIN.minuman (≥60%), bukan angka brand. Lesung Pipi ikut Nordu. */
export const BRAND_MARGIN: Record<Brand, { min: number; idealLow: number; idealHigh: number }> = {
  Nordu: { min: 0.35, idealLow: 0.35, idealHigh: 0.4 },
  Cattu: { min: 0.35, idealLow: 0.35, idealHigh: 0.4 },
  Busari: { min: 0.3, idealLow: 0.3, idealHigh: 0.35 },
  "Lesung Pipi": { min: 0.3, idealLow: 0.35, idealHigh: 0.4 },
};

/** A settable selling-price margin band per category (fractions 0..1). */
export interface MarginBand {
  min: number;
  max: number;
}

/**
 * Three price suggestions from HPP + a margin band. The suggestions START at
 * the band minimum (Minimal), the midpoint (Ideal), and the maximum
 * (Maksimal) — e.g. beverage 60–100% ⇒ 60% / 80% / 100%.
 *
 * `band` (from the costing policy per category) wins when given; otherwise it
 * falls back to the brand band, then a generic 30/40/48%.
 */
export function priceTiers(hpp: number, brand?: Brand, band?: MarginBand): PriceTier[] {
  let min: number, mid: number, max: number;
  if (band && band.max > 0) {
    min = band.min;
    max = Math.max(band.min, band.max);
    mid = (min + max) / 2;
  } else if (brand) {
    const b = BRAND_MARGIN[brand];
    min = Math.max(0.3, b.min);
    mid = b.idealHigh;
    max = Math.min(0.6, b.idealHigh + 0.08);
  } else {
    min = 0.3; mid = 0.4; max = 0.48;
  }
  const defs: Omit<PriceTier, "price" | "profit" | "margin">[] = [
    { key: "kompetitif", label: "Minimal", targetMargin: min, note: "Harga pada margin minimum — untuk menarik pelanggan." },
    { key: "standar", label: "Ideal", targetMargin: mid, note: "Margin tengah — keuntungan sehat & wajar." },
    { key: "premium", label: "Maksimal", targetMargin: max, note: "Harga pada margin maksimum band." },
  ];
  return defs.map((d) => {
    // A 100% GPM implies an infinite price (price = HPP ÷ 0), so cap the margin
    // used for pricing at 90% (already price = 10× HPP). The band max may still
    // read 100% as an aspiration; the computed price stays finite & sensible.
    const m = Math.min(0.9, d.targetMargin);
    const price = hpp > 0 ? roundPrice(hpp / (1 - m)) : 0;
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

/** Food cost % = biaya bahan baku ÷ harga jual. Dipakai sebagai indikator
 *  pendamping; penilaian over cost memakai `hppPct` (HPP total), bukan ini.
 *  Standar makalah: makanan ≤35%, minuman 25–35%. */
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
  const target = (targetPct ?? (category === "minuman" ? 0.35 : 0.35)) * 100;
  if (pct <= 0) return { tone: "warn", label: "Isi harga & bahan" };
  if (pct > HPP_OVER_COST * 100) return { tone: "bad", label: `Over cost (>${HPP_OVER_COST * 100}%)` };
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
