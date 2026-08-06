import { describe, expect, it } from "vitest";
import { calcHpp, foodCostStatus, priceTiers, projection, sensitivity, type HppInput, calcHppV2, hppPct, hppStatus, classPrices} from "./calc";

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
    expect(foodCostStatus(0.24, "minuman").tone).toBe("good"); // ≤35% target
    expect(foodCostStatus(0.30, "minuman").tone).toBe("good"); // masih di dalam 25–35% (makalah 2026)
    expect(foodCostStatus(0.72, "minuman").tone).toBe("bad"); // above 25%
  });

  it("respects a custom brand target (e.g. Beverage 28%)", () => {
    expect(foodCostStatus(0.27, "minuman", 0.28).tone).toBe("good");
    expect(foodCostStatus(0.29, "minuman", 0.28).tone).toBe("warn");
    expect(foodCostStatus(0.71, "makanan", 0.35).tone).toBe("bad"); // >70% over cost
  });
});

describe("mesin HPP tujuh langkah (makalah Juli 2026)", () => {
  const bahan = {
    id: "a",
    name: "Kopi",
    role: "bahan" as const,
    takaran: 20,
    takaranUnit: "g",
    buyPrice: 100_000,
    buyQty: 1,
    buyUnit: "kg",
  };
  const packing = {
    id: "b",
    name: "Paper cup",
    role: "packing" as const,
    takaran: 1,
    takaranUnit: "pcs",
    buyPrice: 1_000,
    buyQty: 1,
    buyUnit: "pcs",
  };

  it("menjumlahkan bahan baku, BTKL, overhead+waste, dan packing", () => {
    const bd = calcHppV2({
      variables: [bahan, packing],
      fixed: [{ id: "f", name: "Listrik", monthly: 1_000_000 }],
      btklMonthly: 2_000_000,
      wastePct: 5,
      allocMode: "product",
      targetSales: 1_000,
    });
    expect(bd.bahanBaku).toBe(2_000); // 20 g dari Rp100.000/kg
    expect(bd.packing).toBe(1_000);
    expect(bd.hppDasar).toBe(3_000); // packing setara HPP dasar
    expect(bd.btkl).toBe(2_000); // 2 juta / 1.000 unit
    expect(bd.overheadOps).toBe(1_000); // 1 juta / 1.000 unit
    expect(bd.waste).toBe(100); // 5% dari bahan baku saja, bukan packing
    expect(bd.overhead).toBe(1_100);
    expect(bd.totalHpp).toBe(6_100);
  });

  it("menandai over cost saat HPP melebihi 70% harga jual", () => {
    expect(hppStatus(hppPct(7_500, 10_000), "makanan").tone).toBe("bad");
    expect(hppStatus(hppPct(6_000, 10_000), "makanan").tone).toBe("good"); // margin 40%
  });

  it("menolak margin di bawah minimum kategori", () => {
    // Minuman wajib margin ≥60% ⇒ HPP maksimal 40%.
    expect(hppStatus(hppPct(5_000, 10_000), "minuman").tone).toBe("bad");
    expect(hppStatus(hppPct(3_500, 10_000), "minuman").tone).toBe("good");
  });

  it("class Nordu menaikkan harga Rp5.000 per class dengan HPP tetap", () => {
    const cs = classPrices(20_000, 12_000);
    expect(cs.map((c) => c.price)).toEqual([20_000, 25_000, 30_000]);
    // HPP rupiah tetap ⇒ persentase HPP turun, margin naik tiap class.
    expect(cs[0].margin).toBeLessThan(cs[1].margin);
    expect(cs[1].margin).toBeLessThan(cs[2].margin);
  });
});
