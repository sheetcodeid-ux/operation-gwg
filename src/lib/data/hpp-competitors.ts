import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { listHpp, type HppRecord } from "./hpp";
import { hppPct, hppStatus, type Brand } from "@/lib/hpp/calc";

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
  competitors: { competitor: string; price: number; city: string | null; observedAt: string }[];
}

const mem = new Map<string, CompetitorPrice>();

/** Menu dianggap kemahalan/kemurahan bila selisihnya lewat ambang ini. */
export const PRICE_BAND = 0.1;

export async function listCompetitorPrices(): Promise<CompetitorPrice[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const { data, error } = await db()
    .from("hpp_competitor_prices")
    .select("*")
    .order("observed_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error("[hpp-competitors] list failed:", error.message);
    return [];
  }
  return (data ?? []).map(fromRow);
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
  const [records, prices] = await Promise.all([
    preloaded?.records ?? listHpp(),
    preloaded?.prices ?? listCompetitorPrices(),
  ]);

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
  for (const [, hits] of orphans) {
    insights.push(buildInsight({ menuId: null, menuName: hits[0].menuName, brand: "—", category: "minuman", ourPrice: 0, hpp: 0 }, hits));
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
