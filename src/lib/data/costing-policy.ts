import "server-only";

import { db, dbEnabled } from "./db";
import { BRANDS, type Brand } from "@/lib/hpp/calc";

/**
 * Costing policy = target food-cost % (COGS ÷ harga jual) per category, with a
 * company-wide `default` baseline and optional per-brand overrides.
 *
 * Resolution (per makalah + requirement #10): brand override wins when present,
 * else the default. Food 35% / Beverage 25% is the seeded company default.
 */
export interface CostingPolicy {
  scope: string; // 'default' | brand name
  foodPct: number; // target food cost % for makanan (health indicator)
  bevPct: number; // target food cost % for minuman (health indicator)
  // Selling-price margin bands per category (drive the price suggestions).
  foodMarginMin: number;
  foodMarginMax: number;
  bevMarginMin: number;
  bevMarginMax: number;
  updatedAt?: string;
}

export const DEFAULT_POLICY: CostingPolicy = {
  scope: "default",
  foodPct: 35,
  bevPct: 25,
  foodMarginMin: 35,
  foodMarginMax: 50,
  bevMarginMin: 60,
  bevMarginMax: 100,
};

interface Row {
  scope: string;
  food_pct: number | string;
  bev_pct: number | string;
  food_margin_min?: number | string;
  food_margin_max?: number | string;
  bev_margin_min?: number | string;
  bev_margin_max?: number | string;
  updated_at?: string;
}

const mem = new Map<string, CostingPolicy>();
mem.set("default", { ...DEFAULT_POLICY });

/** All policies (default + brand overrides). Never throws. */
export async function listCostingPolicies(): Promise<CostingPolicy[]> {
  if (!dbEnabled) return [...mem.values()];
  try {
    const { data } = await db().from("costing_policy").select("scope,food_pct,bev_pct,food_margin_min,food_margin_max,bev_margin_min,bev_margin_max,updated_at");
    const num = (v: number | string | undefined, fb: number) => (v == null ? fb : Number(v) || fb);
    const rows: CostingPolicy[] = ((data ?? []) as Row[]).map((r) => ({
      scope: r.scope,
      foodPct: num(r.food_pct, 35),
      bevPct: num(r.bev_pct, 25),
      foodMarginMin: num(r.food_margin_min, DEFAULT_POLICY.foodMarginMin),
      foodMarginMax: num(r.food_margin_max, DEFAULT_POLICY.foodMarginMax),
      bevMarginMin: num(r.bev_margin_min, DEFAULT_POLICY.bevMarginMin),
      bevMarginMax: num(r.bev_margin_max, DEFAULT_POLICY.bevMarginMax),
      updatedAt: r.updated_at,
    }));
    if (!rows.some((r) => r.scope === "default")) rows.unshift({ ...DEFAULT_POLICY });
    return rows;
  } catch {
    return [{ ...DEFAULT_POLICY }];
  }
}

/** Effective policy for a brand: brand override if set, else the default. */
export function resolvePolicy(policies: CostingPolicy[], brand?: string): CostingPolicy {
  const def = policies.find((p) => p.scope === "default") ?? DEFAULT_POLICY;
  if (!brand) return def;
  const override = policies.find((p) => p.scope === brand);
  return override ?? def;
}

/** Target food-cost % for one (brand, category), as a fraction 0..1. */
export function targetFoodCost(policies: CostingPolicy[], brand: string | undefined, category: "makanan" | "minuman"): number {
  const p = resolvePolicy(policies, brand);
  return (category === "minuman" ? p.bevPct : p.foodPct) / 100;
}

const clampPct = (n: number) => Math.min(90, Math.max(1, Math.round(n * 100) / 100));
const clampMargin = (n: number) => Math.min(95, Math.max(1, Math.round(n * 100) / 100));

export interface CostingPolicyInput {
  foodPct: number;
  bevPct: number;
  foodMarginMin: number;
  foodMarginMax: number;
  bevMarginMin: number;
  bevMarginMax: number;
}

/** Create/replace a policy. scope 'default' or a known brand only. */
export async function saveCostingPolicy(scope: string, input: CostingPolicyInput): Promise<void> {
  const valid = scope === "default" || (BRANDS as string[]).includes(scope);
  if (!valid) throw new Error("Scope tidak dikenal.");
  // Keep min ≤ max so the price band is always coherent.
  const fMin = clampMargin(input.foodMarginMin);
  const fMax = Math.max(fMin, clampMargin(input.foodMarginMax));
  const bMin = clampMargin(input.bevMarginMin);
  const bMax = Math.max(bMin, clampMargin(input.bevMarginMax));
  const rec: CostingPolicy = {
    scope,
    foodPct: clampPct(input.foodPct),
    bevPct: clampPct(input.bevPct),
    foodMarginMin: fMin,
    foodMarginMax: fMax,
    bevMarginMin: bMin,
    bevMarginMax: bMax,
    updatedAt: new Date().toISOString(),
  };
  if (!dbEnabled) {
    mem.set(scope, rec);
    return;
  }
  await db().from("costing_policy").upsert({
    scope,
    food_pct: rec.foodPct,
    bev_pct: rec.bevPct,
    food_margin_min: rec.foodMarginMin,
    food_margin_max: rec.foodMarginMax,
    bev_margin_min: rec.bevMarginMin,
    bev_margin_max: rec.bevMarginMax,
    updated_at: rec.updatedAt,
  });
}

/** Remove a brand override (falls back to default). 'default' cannot be deleted. */
export async function deleteCostingPolicy(scope: string): Promise<void> {
  if (scope === "default") throw new Error("Kebijakan default tidak bisa dihapus.");
  if (!dbEnabled) {
    mem.delete(scope);
    return;
  }
  await db().from("costing_policy").delete().eq("scope", scope);
}

export { BRANDS };
export type { Brand };
