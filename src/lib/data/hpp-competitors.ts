import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { listHpp, type HppRecord } from "./hpp";
import { BRAND_HPP_TARGET, HPP_OVER_COST, MIN_MARGIN, hppPct, hppStatus, type Brand } from "@/lib/hpp/calc";
import { listEsbMenus } from "./esb-menu";

/**
 * Analytics Harga Kompetitor.
 *
 * Menjawab satu pertanyaan yang tidak bisa dijawab HPP sendirian: harga kita
 * kemahalan atau tidak. HPP hanya tahu biaya — pasar yang menentukan apakah
 * harga itu bisa diterima. Modul ini menyandingkan keduanya, sehingga tiap
 * rekomendasi turun harga langsung diuji: kalau ikut harga pasar, HPP-nya
 * masih sehat atau justru jadi over cost.
 */

export interface CompetitorPrice {
  id: string;
  /** Menu kita yang dibandingkan (opsional — boleh nama bebas). */
  menuId: string | null;
  menuName: string;
  competitor: string;
  price: number;
  city: string | null;
  source: string | null;
  note: string | null;
  observedAt: string;
  createdBy: string | null;
  createdAt: string;
}

export type CompetitorDraft = Omit<CompetitorPrice, "id" | "createdBy" | "createdAt"> & { id?: string };

/** Posisi harga kita terhadap pasar. */
export type PricePosition = "mahal" | "kompetitif" | "murah" | "belum-ada-data";

/** Satu usulan harga beserta akibatnya — supaya pilihannya bisa dibandingkan. */
export interface PriceOption {
  key: "pasar" | "sehat" | "premium";
  label: string;
  price: number;
  hppPct: number;
  margin: number;
  /** Aman = HPP tidak lewat batas merah dan margin tidak di bawah minimum. */
  safe: boolean;
  note: string;
}

export interface CompetitorInsight {
  menuId: string | null;
  menuName: string;
  brand: string;
  category: string;
  ourPrice: number;
  hpp: number;
  samples: number;
  min: number;
  avg: number;
  max: number;
  /** Selisih harga kita terhadap rata-rata pasar, pecahan (0.2 = 20% lebih mahal). */
  gapPct: number;
  position: PricePosition;
  /** HPP% kita sekarang, dan HPP% seandainya ikut harga rata-rata pasar. */
  hppPctNow: number;
  hppPctAtMarket: number;
  /** Apakah menurunkan harga ke rata-rata pasar masih aman secara biaya. */
  canMatchMarket: boolean;
  marketStatus: { tone: "good" | "warn" | "bad"; label: string };
  /** Usulan harga: ikut pasar, aman margin, atau premium. */
  options: PriceOption[];
  /** Usulan yang paling layak diambil (aman & paling dekat pasar). */
  recommended: PriceOption | null;
  competitors: { competitor: string; price: number; city: string | null; observedAt: string }[];
}

const mem = new Map<string, CompetitorPrice>();

/** Menu dianggap kemahalan/kemurahan bila selisihnya lewat ambang ini. */
export const PRICE_BAND = 0.1;

export async function listCompetitorPrices(): Promise<CompetitorPrice[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  try {
    // Diurutkan per id (unik) untuk paginasi; urutan tampil disusun di memori.
    const rows = await selectAll<CompetitorRow>("hpp_competitor_prices", (a, b) =>
      db().from("hpp_competitor_prices").select("*").order("id", { ascending: true }).range(a, b),
    );
    return rows.map(fromRow).sort((x, y) => y.observedAt.localeCompare(x.observedAt));
  } catch (e) {
    console.error("[hpp-competitors] list failed:", e);
    return [];
  }
}

export async function saveCompetitorPrice(input: CompetitorDraft, userId: string | null): Promise<CompetitorPrice> {
  const rec: CompetitorPrice = {
    ...input,
    id: input.id ?? `cmp_${randomUUID()}`,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };
  if (!dbEnabled) {
    mem.set(rec.id, rec);
    return rec;
  }
  await db().from("hpp_competitor_prices").upsert(toRow(rec));
  return rec;
}

export async function deleteCompetitorPrice(id: string): Promise<void> {
  if (!dbEnabled) {
    mem.delete(id);
    return;
  }
  await db().from("hpp_competitor_prices").delete().eq("id", id);
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Gabungkan menu kita dengan harga kompetitor yang tercatat. Menu dicocokkan
 * lewat menuId bila ada, kalau tidak lewat nama (case-insensitive) — supaya
 * survei harga bisa dicatat sebelum menunya tersimpan di kalkulator.
 */
export async function competitorInsights(preloaded?: {
  records?: HppRecord[];
  prices?: CompetitorPrice[];
}): Promise<CompetitorInsight[]> {
  const [records, prices, esb] = await Promise.all([
    preloaded?.records ?? listHpp(),
    preloaded?.prices ?? listCompetitorPrices(),
    listEsbMenus().catch(() => []),
  ]);
  // Menu yang belum dihitung HPP-nya tetap punya harga jual di ESB. Tanpa ini
  // "harga kita" kosong dan posisi terhadap pasar tidak bisa dihitung sama
  // sekali — persis yang terjadi pada menu yang datang dari katalog ESB.
  const esbPrice = new Map(esb.filter((m) => m.menu).map((m) => [norm(m.menu), m.unitPrice || 0]));

  const byMenu = new Map<string, CompetitorPrice[]>();
  for (const p of prices) {
    for (const key of [p.menuId, norm(p.menuName)].filter((k): k is string => !!k)) {
      byMenu.set(key, [...(byMenu.get(key) ?? []), p]);
    }
  }

  const insights: CompetitorInsight[] = [];
  const covered = new Set<string>();

  for (const r of records) {
    const hits = [...new Set([...(byMenu.get(r.id) ?? []), ...(byMenu.get(norm(r.name)) ?? [])])];
    hits.forEach((h) => covered.add(h.id));
    insights.push(buildInsight({ menuId: r.id, menuName: r.name, brand: r.brand, category: r.category, ourPrice: r.chosenPrice, hpp: r.hpp }, hits));
  }

  // Harga kompetitor untuk menu yang belum ada di kalkulator tetap ditampilkan
  // — itu justru bahan riset untuk menu berikutnya.
  const orphans = new Map<string, CompetitorPrice[]>();
  for (const p of prices) {
    if (covered.has(p.id)) continue;
    const key = norm(p.menuName);
    orphans.set(key, [...(orphans.get(key) ?? []), p]);
  }
  for (const [key, hits] of orphans) {
    insights.push(
      buildInsight(
        { menuId: null, menuName: hits[0].menuName, brand: "—", category: "minuman", ourPrice: esbPrice.get(key) ?? 0, hpp: 0 },
        hits,
      ),
    );
  }

  // Paling kemahalan lebih dulu — itu yang paling berisiko kalah bersaing.
  return insights.sort((a, b) => b.gapPct - a.gapPct);
}

function buildInsight(
  base: { menuId: string | null; menuName: string; brand: string; category: string; ourPrice: number; hpp: number },
  hits: CompetitorPrice[],
): CompetitorInsight {
  const values = hits.map((h) => h.price).filter((n) => n > 0);
  const samples = values.length;
  const min = samples ? Math.min(...values) : 0;
  const max = samples ? Math.max(...values) : 0;
  const avg = samples ? values.reduce((a, b) => a + b, 0) / samples : 0;

  const gapPct = samples && avg > 0 && base.ourPrice > 0 ? base.ourPrice / avg - 1 : 0;
  const position: PricePosition =
    !samples || base.ourPrice <= 0 ? "belum-ada-data" : gapPct > PRICE_BAND ? "mahal" : gapPct < -PRICE_BAND ? "murah" : "kompetitif";

  const category = base.category === "makanan" ? "makanan" : "minuman";
  const hppPctNow = hppPct(base.hpp, base.ourPrice);
  const hppPctAtMarket = hppPct(base.hpp, avg);
  const marketStatus = avg > 0 && base.hpp > 0 ? hppStatus(hppPctAtMarket, category, base.brand as Brand) : { tone: "warn" as const, label: "Belum ada data" };

  return {
    ...base,
    samples,
    min,
    avg: Math.round(avg),
    max,
    gapPct,
    position,
    hppPctNow,
    hppPctAtMarket,
    // Ikut harga pasar hanya aman kalau HPP-nya tidak berubah jadi merah.
    canMatchMarket: avg > 0 && base.hpp > 0 && marketStatus.tone !== "bad",
    options: priceOptions(base.hpp, category, base.brand as Brand, avg, max),
    recommended: pickRecommended(priceOptions(base.hpp, category, base.brand as Brand, avg, max), base.ourPrice),
    marketStatus,
    competitors: hits
      .map((h) => ({ competitor: h.competitor, price: h.price, city: h.city, observedAt: h.observedAt }))
      .sort((a, b) => a.price - b.price),
  };
}

const toRow = (r: CompetitorPrice) => ({
  id: r.id,
  menu_id: r.menuId,
  menu_name: r.menuName,
  competitor: r.competitor,
  price: r.price,
  city: r.city,
  source: r.source,
  note: r.note,
  observed_at: r.observedAt,
  created_by: r.createdBy,
  created_at: r.createdAt,
});

interface CompetitorRow {
  id: string;
  menu_id: string | null;
  menu_name: string;
  competitor: string;
  price: number | string;
  city: string | null;
  source: string | null;
  note: string | null;
  observed_at: string;
  created_by: string | null;
  created_at: string;
}

const fromRow = (r: CompetitorRow): CompetitorPrice => ({
  id: r.id,
  menuId: r.menu_id,
  menuName: r.menu_name,
  competitor: r.competitor,
  price: Number(r.price) || 0,
  city: r.city,
  source: r.source,
  note: r.note,
  observedAt: r.observed_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
});


/**
 * Tiga usulan harga untuk satu menu, lengkap dengan akibatnya ke HPP.
 *
 *  • Ikut pasar   — sejajar rata-rata kompetitor; paling aman secara penjualan.
 *  • Aman margin  — harga terendah yang masih menjaga HPP di bawah batas brand;
 *                   inilah lantai harga yang tidak boleh ditembus.
 *  • Premium      — setara kompetitor termahal; hanya masuk akal kalau kualitas
 *                   atau porsinya memang di atas rata-rata.
 *
 * Semuanya diuji ke HPP, jadi usulan yang membuat menu rugi ditandai tidak aman
 * alih-alih disodorkan begitu saja.
 */
function priceOptions(hpp: number, category: "makanan" | "minuman", brand: Brand, avg: number, max: number): PriceOption[] {
  if (hpp <= 0 || avg <= 0) return [];

  const targetMax = BRAND_HPP_TARGET[brand]?.max ?? HPP_OVER_COST;
  const minMargin = MIN_MARGIN[category];
  // Harga minimum yang memenuhi DUA syarat sekaligus: HPP di bawah target brand
  // dan margin di atas minimum kategori. Ambil yang paling ketat.
  const floor = Math.ceil(Math.max(hpp / targetMax, hpp / (1 - minMargin)) / 500) * 500;

  const make = (key: PriceOption["key"], label: string, price: number, note: string): PriceOption => {
    const pct = hppPct(hpp, price);
    const margin = price > 0 ? (price - hpp) / price : 0;
    return {
      key,
      label,
      price: Math.round(price),
      hppPct: pct,
      margin,
      safe: price > 0 && pct <= HPP_OVER_COST && margin >= minMargin,
      note,
    };
  };

  const out = [
    make("pasar", "Ikut pasar", avg, "Sejajar rata-rata kompetitor"),
    make("sehat", "Aman margin", floor, `Batas bawah — HPP tetap di bawah ${Math.round(targetMax * 100)}%`),
  ];
  // Premium hanya ditawarkan kalau memang ada jarak dari rata-rata.
  if (max > avg * 1.05) out.push(make("premium", "Premium", max, "Setara kompetitor termahal"));
  return out;
}

/** Usulan terbaik: yang aman dan paling dekat dengan harga pasar. */
function pickRecommended(options: PriceOption[], ourPrice: number): PriceOption | null {
  const safe = options.filter((o) => o.safe);
  if (safe.length === 0) return null;
  const market = options.find((o) => o.key === "pasar");
  // Kalau ikut pasar sudah aman, itu pilihan paling wajar.
  if (market?.safe) return market;
  // Kalau tidak, ambil harga aman terendah — naik seperlunya saja.
  const cheapest = [...safe].sort((a, b) => a.price - b.price)[0];
  return cheapest.price === Math.round(ourPrice) ? null : cheapest;
}
