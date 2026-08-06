import "server-only";

import { listHpp, type HppRecord } from "./hpp";
import { listIngredients, recipeUnits, unitPrice, type HppIngredient } from "./hpp-ingredients";
import { calcHppV2, hppPct, hppStatus, itemSubtotal, type Brand, type VariableItem } from "@/lib/hpp/calc";

/**
 * Kewajiban makalah (Lampiran no.11): "Update HPP jika bahan naik >5% —
 * dilakukan untuk semua menu terkait".
 *
 * Master Bahan Baku sudah menandai bahan yang harganya melonjak lebih dari 5%.
 * Modul ini menutup lingkarannya: mencari menu mana saja yang memakai bahan
 * tersebut, menghitung ulang HPP-nya dengan harga terbaru, lalu melaporkan
 * selisihnya beserta risiko over cost — sehingga tim tahu persis menu apa yang
 * harus ditinjau, bukan sekadar tahu ada harga yang naik.
 */

export interface AffectedIngredient {
  id: string;
  name: string;
  prevPrice: number | null;
  buyPrice: number;
  buyQty: number;
  buyUnit: string;
  /** Kenaikan harga per satuan, dalam pecahan (0.12 = naik 12%). */
  risePct: number;
}

export interface AffectedMenu {
  id: string;
  name: string;
  brand: string;
  category: string;
  chosenPrice: number;
  /** HPP tersimpan saat menu terakhir dihitung. */
  hppLama: number;
  /** HPP bila dihitung ulang dengan harga bahan terkini. */
  hppBaru: number;
  selisih: number;
  selisihPct: number;
  hppPctLama: number;
  hppPctBaru: number;
  /** Status kesehatan setelah harga baru diterapkan. */
  status: { tone: "good" | "warn" | "bad"; label: string };
  /** Bahan yang memicu — bisa lebih dari satu. */
  triggers: string[];
}

export interface HppPriceAlerts {
  ingredients: AffectedIngredient[];
  menus: AffectedMenu[];
}

/**
 * Ganti harga baris bahan dengan harga master terkini. Resep memakai satuan
 * PAKAI, jadi kemasan dijabarkan dulu: 1 dus isi 24 pcs → qty 24, satuan pcs.
 */
function withCurrentPrice(v: VariableItem, master: Map<string, HppIngredient>): VariableItem {
  const ing = v.ingredientId ? master.get(v.ingredientId) : undefined;
  if (!ing) return v;
  return { ...v, ...recipeUnits(ing) };
}

/**
 * Daftar bahan yang sedang bertanda naik >5% beserta menu yang memakainya.
 * Menu tanpa perubahan HPP (mis. bahan tertaut tapi takarannya nol) dibuang.
 */
export async function listHppPriceAlerts(preloaded?: {
  ingredients?: HppIngredient[];
  records?: HppRecord[];
}): Promise<HppPriceAlerts> {
  // Pages that already hold these lists pass them in — otherwise this module
  // would re-query both tables and double the page's database round trips.
  const [all, records] = await Promise.all([
    preloaded?.ingredients ?? listIngredients(),
    preloaded?.records ?? listHpp(),
  ]);
  const flagged = all.filter((i) => i.alert);
  if (flagged.length === 0) return { ingredients: [], menus: [] };

  const master = new Map(all.map((i) => [i.id, i]));
  const flaggedIds = new Set(flagged.map((i) => i.id));

  const ingredients: AffectedIngredient[] = flagged.map((i) => ({
    id: i.id,
    name: i.name,
    prevPrice: i.prevPrice,
    buyPrice: i.buyPrice,
    buyQty: i.buyQty,
    buyUnit: i.buyUnit,
    risePct:
      i.prevPrice && i.prevPrice > 0 ? unitPrice(i) / unitPrice({ ...i, buyPrice: i.prevPrice }) - 1 : 0,
  }));

  const menus: AffectedMenu[] = [];
  for (const r of records) {
    const hits = (r.variables ?? []).filter((v) => v.ingredientId && flaggedIds.has(v.ingredientId));
    if (hits.length === 0) continue;

    const updated = (r.variables ?? []).map((v) => withCurrentPrice(v, master));
    const bd = calcHppV2({
      variables: updated,
      fixed: r.fixed ?? [],
      btklMonthly: r.btkl ?? 0,
      wastePct: r.wastePct ?? 5,
      allocMode: r.allocMode,
      targetSales: r.targetSales,
      totalUnitsAllProducts: r.targetSales,
      yieldPcs: r.mode === "per_resep" ? Math.max(1, r.yieldPcs || 1) : 1,
    });

    const hppBaru = bd.totalHpp;
    const hppLama = r.hpp || 0;
    // Bahan tertaut tapi harganya tidak berubah ⇒ tidak perlu ditinjau.
    if (Math.abs(hppBaru - hppLama) < 1) continue;

    const category = (r.category === "minuman" ? "minuman" : "makanan") as "makanan" | "minuman";
    const pctBaru = hppPct(hppBaru, r.chosenPrice);
    menus.push({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      chosenPrice: r.chosenPrice,
      hppLama,
      hppBaru,
      selisih: Math.round((hppBaru - hppLama) * 100) / 100,
      selisihPct: hppLama > 0 ? hppBaru / hppLama - 1 : 0,
      hppPctLama: hppPct(hppLama, r.chosenPrice),
      hppPctBaru: pctBaru,
      status: hppStatus(pctBaru, category, r.brand as Brand),
      triggers: [...new Set(hits.map((h) => master.get(h.ingredientId!)?.name ?? "—"))],
    });
  }

  // Kenaikan HPP terbesar lebih dulu — itu yang paling mendesak ditinjau.
  menus.sort((a, b) => b.selisih - a.selisih);
  return { ingredients, menus };
}

/** Dipakai badge sidebar/dashboard: berapa menu yang menunggu ditinjau. */
export async function countHppPriceAlerts(): Promise<number> {
  const { menus } = await listHppPriceAlerts();
  return menus.length;
}

export { itemSubtotal };
