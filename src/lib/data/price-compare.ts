import "server-only";

import { listEsbMenus, esbMenuSyncedAt, type EsbMenu } from "./esb-menu";
import { listHpp, type HppRecord } from "./hpp";

/**
 * ESB price vs latest HPP comparison — the "Referensi Harga & HPP" dataset.
 *
 * Joins the ESB catalog (esb_menu) with the LATEST HPP record per menu name
 * (case-insensitive), so every row shows the actual ESB selling price against
 * the newest costing. Menus with no HPP yet still appear (HPP = null) so R&D
 * sees what still needs costing; HPP records with no ESB match appear too.
 */
export type PriceStatus = "above" | "below" | "match" | "no_hpp" | "no_esb";

export interface PriceCompareRow {
  menu: string;
  brand: string | null;
  category: "makanan" | "minuman";
  className: string; // 'Class (Nordu)' | '—'
  esbPrice: number | null; // ESB pre-tax unit price
  esbQty30d: number;
  latestHpp: number | null; // newest HPP (cost)
  hppPrice: number | null; // R&D chosen selling price (tanpa pajak)
  hppPct: number | null; // food cost = HPP ÷ ESB price
  diff: number | null; // ESB price − HPP
  diffPct: number | null; // diff ÷ HPP
  status: PriceStatus;
  lastUpdated: string | null; // HPP record createdAt
}

const norm = (s: string) => s.trim().toLowerCase();

/** Latest HPP record per (normalised) menu name. */
function latestHppByMenu(records: HppRecord[]): Map<string, HppRecord> {
  const m = new Map<string, HppRecord>();
  for (const r of records) {
    const k = norm(r.name);
    const cur = m.get(k);
    if (!cur || r.createdAt > cur.createdAt) m.set(k, r);
  }
  return m;
}

function statusOf(esbPrice: number | null, hpp: number | null): PriceStatus {
  if (hpp == null) return "no_hpp";
  if (esbPrice == null) return "no_esb";
  const tol = Math.max(100, hpp * 0.01); // 1% (or Rp 100) tolerance = "match"
  if (esbPrice > hpp + tol) return "above";
  if (esbPrice < hpp - tol) return "below";
  return "match";
}

export interface PriceCompare {
  rows: PriceCompareRow[];
  esbSyncedAt: string | null;
  configured: boolean;
}

export async function getPriceComparison(): Promise<PriceCompare> {
  const [menus, records, esbSyncedAt] = await Promise.all([listEsbMenus(), listHpp(), esbMenuSyncedAt()]);
  const hppMap = latestHppByMenu(records);
  const seenHpp = new Set<string>();

  const rows: PriceCompareRow[] = [];

  // Every ESB menu (with or without an HPP match).
  for (const e of menus) {
    const key = norm(e.menu);
    const hpp = hppMap.get(key) ?? null;
    if (hpp) seenHpp.add(key);
    rows.push(buildRow(e.menu, e, hpp));
  }
  // HPP records with no ESB match (manual / new products).
  for (const [key, r] of hppMap) {
    if (seenHpp.has(key)) continue;
    rows.push(buildRow(r.name, null, r));
  }

  return { rows, esbSyncedAt, configured: menus.length > 0 || records.length > 0 };
}

function buildRow(name: string, e: EsbMenu | null, hpp: HppRecord | null): PriceCompareRow {
  const esbPrice = e ? (e.unitPrice > 0 ? e.unitPrice : null) : null;
  const latestHpp = hpp ? hpp.hpp : null;
  const category: "makanan" | "minuman" = (e?.foodBev ?? (hpp?.category === "minuman" ? "minuman" : "makanan")) as "makanan" | "minuman";
  const diff = esbPrice != null && latestHpp != null ? esbPrice - latestHpp : null;
  const diffPct = diff != null && latestHpp ? diff / latestHpp : null;
  const hppPct = esbPrice && latestHpp != null && esbPrice > 0 ? latestHpp / esbPrice : null;
  return {
    menu: name,
    brand: hpp?.brand ?? null,
    category,
    className: hpp?.useClass ? "Class (Nordu)" : "—",
    esbPrice,
    esbQty30d: e?.qty30d ?? 0,
    latestHpp,
    hppPrice: hpp ? hpp.chosenPrice || null : null,
    hppPct,
    diff,
    diffPct,
    status: statusOf(esbPrice, latestHpp),
    lastUpdated: hpp?.createdAt ?? null,
  };
}
