import { describe, expect, it } from "vitest";
import { calcHpp, foodCostStatus, priceTiers, projection, sensitivity, type HppInput } from "./calc";

// "kopi susu gula aren" from the reference screenshot.
const input: HppInput = {
  allocMode: "product",
  targetSales: 1000,
  fixed: [
    { id: "1", name: "Sewa", monthly: 1_500_000 },
    { id: "2", name: "Listrik", monthly: 500_000 },
    { id: "3", name: "Gaji", monthly: 2_000_000 },
    { id: "4", name: "Transport", monthly: 750_000 },
  ],
  variables: [
    { id: "a", name: "Kopi", takaran: 15, takaranUnit: "g", buyPrice: 210_000, buyQty: 1, buyUnit: "kg" },
    { id: "b", name: "Susu", takaran: 150, takaranUnit: "ml", buyPrice: 20_500, buyQty: 1, buyUnit: "L" },
    { id: "c", name: "Gula aren", takaran: 25, takaranUnit: "g", buyPrice: 38_000, buyQty: 1, buyUnit: "kg" },
    { id: "d", name: "Gelas", takaran: 1, takaranUnit: "pcs", buyPrice: 22_000, buyQty: 50, buyUnit: "pcs" },
    { id: "e", name: "Tutup", takaran: 1, takaranUnit: "pcs", buyPrice: 15_000, buyQty: 50, buyUnit: "pcs" },
    { id: "f", name: "Sedotan", takaran: 1, takaranUnit: "pcs", buyPrice: 15_000, buyQty: 50, buyUnit: "pcs" },
  ],
};

describe("HPP engine (matches reference screenshot)", () => {
  const r = calcHpp(input);

  it("computes variable, fixed allocation and total HPP", () => {
    expect(r.variableCost).toBe(8215);
    expect(r.fixedAlloc).toBe(4750);
    expect(r.hpp).toBe(12965);
  });

  it("suggests three price tiers with expected margins", () => {
    const [k, s, p] = priceTiers(r.hpp);
    expect(k.price).toBe(19000);
    expect(Math.round(k.margin * 1000) / 10).toBe(31.8);
    expect(s.price).toBe(22000);
    expect(Math.round(s.margin * 1000) / 10).toBe(41.1);
    expect(p.price).toBe(25000);
    expect(Math.round(p.margin * 1000) / 10).toBe(48.1);
  });

  it("price tiers follow a settable margin band (beverage 60–100%)", () => {
    const [min, mid, max] = priceTiers(r.hpp, undefined, { min: 0.6, max: 1.0 });
    // Suggestions start at the band minimum, midpoint, then maximum.
    expect(min.margin).toBeGreaterThanOrEqual(0.6);
    expect(min.margin).toBeLessThan(0.62);
    expect(Math.round(mid.margin * 100)).toBe(80); // midpoint of 60–100
    expect(max.margin).toBeGreaterThanOrEqual(0.89); // 100% capped to 90% (finite price)
    expect(max.margin).toBeLessThan(0.91);
    expect(min.price).toBeLessThan(mid.price);
    expect(mid.price).toBeLessThan(max.price);
  });

  it("projects BEP, target units and net profit at Rp 22.000 / target Rp 10jt", () => {
    const proj = projection(r.variableCost, r.totalFixed, 22000, 10_000_000);
    expect(proj.contribution).toBe(13785);
    expect(proj.bepUnit).toBe(345);
    expect(proj.targetUnit).toBe(1071);
    expect(proj.perDay).toBe(35.7);
    expect(proj.omzet).toBe(23_562_000);
    expect(proj.totalProdCost).toBe(13_548_265);
    expect(proj.netProfit).toBe(10_013_735);
  });

  it("sensitivity: +0% keeps HPP flat", () => {
    const s = sensitivity(r.variableCost, r.fixedAlloc, 0, 22000);
    expect(s.newHpp).toBe(12965);
    expect(s.deltaHpp).toBe(0);
  });
});

describe("foodCostStatus vs costing-policy target", () => {
  it("uses category defaults when no target given (35% food / 25% bev)", () => {
    expect(foodCostStatus(0.34, "makanan").tone).toBe("good");
    expect(foodCostStatus(0.36, "makanan").tone).toBe("warn");
    expect(foodCostStatus(0.24, "minuman").tone).toBe("good"); // ≤25% target
    expect(foodCostStatus(0.30, "minuman").tone).toBe("warn"); // above 25%
  });

  it("respects a custom brand target (e.g. Beverage 28%)", () => {
    expect(foodCostStatus(0.27, "minuman", 0.28).tone).toBe("good");
    expect(foodCostStatus(0.29, "minuman", 0.28).tone).toBe("warn");
    expect(foodCostStatus(0.71, "makanan", 0.35).tone).toBe("bad"); // >70% over cost
  });
});
