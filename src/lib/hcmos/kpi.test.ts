import { describe, expect, it } from "vitest";

import { KPI_HC, capaian, skorKpi, statusSkor, type KpiKey } from "./kpi";

describe("bobot KPI", () => {
  it("seluruh bobot berjumlah 100", () => {
    expect(KPI_HC.reduce((a, k) => a + k.bobot, 0)).toBe(100);
  });

  it("tidak ada indikator tanpa bobot", () => {
    expect(KPI_HC.every((k) => k.bobot > 0)).toBe(true);
  });
});

const baris = (o: Partial<Record<KpiKey, number | null>>) =>
  KPI_HC.map((k) => ({ key: k.key, realisasi: k.key in o ? (o[k.key] ?? null) : null }));

describe("skorKpi", () => {
  it("indikator yang belum terukur keluar dari pembilang DAN penyebut", () => {
    // Hanya kepatuhan_kontrak (bobot 25) yang terukur, tepat di target.
    const s = skorKpi(baris({ kepatuhan_kontrak: 95 }));
    expect(s.nilai).toBe(100);
    expect(s.bobotTerukur).toBe(25);
    expect(s.terukur).toBe(1);
    expect(s.belumTerukur).toBe(5);
  });

  it("bobot besar menggeser skor lebih kuat daripada bobot kecil", () => {
    // kepatuhan_kontrak bobot 25 tepat target (100); kecepatan_rekrutmen bobot
    // 10 dua kali lebih lambat dari target (capaian 50).
    const s = skorKpi(baris({ kepatuhan_kontrak: 95, kecepatan_rekrutmen: 60 }));
    expect(s.bobotTerukur).toBe(35);
    // (100×25 + 50×10) / 35 = 85,7 → 86. Rata-rata biasa akan memberi 75.
    expect(s.nilai).toBe(86);
  });

  it("tanpa satu pun indikator terukur hasilnya null, bukan nol", () => {
    const s = skorKpi(baris({}));
    expect(s.nilai).toBeNull();
    expect(s.bobotTerukur).toBe(0);
  });

  it("baris dengan key asing diabaikan, bukan bikin gagal", () => {
    expect(skorKpi([{ key: "bukan_kpi" as KpiKey, realisasi: 50 }]).nilai).toBeNull();
  });
});

describe("statusSkor", () => {
  it("memberi sebutan sesuai ambangnya", () => {
    expect(statusSkor(100).label).toBe("Baik");
    expect(statusSkor(90).label).toBe("Cukup");
    expect(statusSkor(75).label).toBe("Perlu Perhatian");
    expect(statusSkor(40).label).toBe("Kurang");
  });

  it("belum terukur bukan berarti kurang", () => {
    expect(statusSkor(null).label).toBe("Belum Terukur");
  });
});

describe("capaian", () => {
  it("indikator yang makin kecil makin baik dihitung terbalik", () => {
    const turnover = KPI_HC.find((k) => k.key === "turnover")!;
    expect(capaian(turnover, 5)).toBe(150);
    expect(capaian(turnover, 10)).toBe(100);
    expect(capaian(turnover, 20)).toBe(50);
  });
});
