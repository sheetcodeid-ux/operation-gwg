import { describe, expect, it } from "vitest";
import {
  DEPARTEMEN,
  DEPARTEMEN_MANAJEMEN,
  MENU_POSISI,
  OUTLET_KPK,
  POSISI,
  POSISI_MANAJEMEN,
  outletKpk,
} from "./struktur";
import { indikatorPosisi } from "./indikator";
import { hppKpkPersen } from "./hitung";

describe("KPI Supervisor — struktur", () => {
  it("berdiri di luar manajemen", () => {
    const d = DEPARTEMEN.find((x) => x.kode === "supervisor");
    expect(d?.diluarManajemen).toBe(true);
    // Departemen lain TIDAK ikut tertandai — kalau ikut, KPI Manajemen
    // kehilangan divisi yang seharusnya dinilai.
    expect(DEPARTEMEN.filter((x) => x.diluarManajemen)).toHaveLength(1);
  });

  it("dua posisi, keduanya dinilai per orang dari daftar basis data", () => {
    for (const kode of ["supervisor_umum", "supervisor_kpk"] as const) {
      const p = POSISI.find((x) => x.kode === kode);
      expect(p?.departemen).toBe("supervisor");
      expect(p?.perPic).toBe(true);
      expect(p?.picDinamis).toBe(kode);
      expect(MENU_POSISI[kode]).toBeTruthy();
    }
  });
});

describe("KPI Supervisor — indikator", () => {
  const bobot = (kode: "supervisor_umum" | "supervisor_kpk") =>
    Object.fromEntries(indikatorPosisi(kode).map((i) => [i.key, i.bobot]));

  it("Supervisor Umum: 40/30/20/10 dan totalnya seratus", () => {
    const b = bobot("supervisor_umum");
    expect(b).toEqual({ gross_sales: 40, net_profit: 30, komplain_area: 20, problem_solver_sup: 10 });
    expect(Object.values(b).reduce((x, y) => x + y, 0)).toBe(100);
  });

  it("Supervisor KPK: sama persis, hanya Problem Solver diganti HPP", () => {
    const b = bobot("supervisor_kpk");
    expect(b).toEqual({ gross_sales: 40, net_profit: 30, komplain_area: 20, hpp_kpk: 10 });
    expect(Object.values(b).reduce((x, y) => x + y, 0)).toBe(100);

    // Tiga indikator pertamanya HARUS identik dengan yang umum — kalau
    // berbeda, dua supervisor bertetangga dinilai dengan rumus berbeda.
    const umum = indikatorPosisi("supervisor_umum").slice(0, 3);
    const kpk = indikatorPosisi("supervisor_kpk").slice(0, 3);
    expect(kpk).toEqual(umum);
  });

  it("targetnya sesuai yang diputuskan pemilik", () => {
    const cari = (kode: "supervisor_umum" | "supervisor_kpk", key: string) =>
      indikatorPosisi(kode).find((i) => i.key === key);
    expect(cari("supervisor_umum", "komplain_area")?.target).toEqual({ jenis: "tetap", nilai: 20 });
    expect(cari("supervisor_umum", "problem_solver_sup")?.target).toEqual({ jenis: "tetap", nilai: 10 });
    expect(cari("supervisor_kpk", "hpp_kpk")?.target).toEqual({ jenis: "tetap", nilai: 35 });
    // Lewat batas tidak langsung nol — sama dengan HPP Coordinator Area.
    expect(cari("supervisor_kpk", "hpp_kpk")?.penilaian).toBe("batas_linear");
  });

  it("Gross Sales dan Net Profit memakai sumber yang sama dengan Coordinator Area", () => {
    const ca = indikatorPosisi("operational_ca");
    const sup = indikatorPosisi("supervisor_umum");
    for (const key of ["gross_sales", "net_profit"]) {
      expect(sup.find((i) => i.key === key)?.actual).toEqual(ca.find((i) => i.key === key)?.actual);
      expect(sup.find((i) => i.key === key)?.target).toEqual(ca.find((i) => i.key === key)?.target);
    }
  });
});

describe("outletKpk", () => {
  it("mengenali kesembilan outlet KPK", () => {
    expect(OUTLET_KPK).toHaveLength(9);
    for (const n of OUTLET_KPK) expect(outletKpk(n)).toBe(true);
  });

  it("TIDAK ikut menangkap outlet yang namanya mirip", () => {
    // Dua jebakan sungguhan di basis data: keduanya BUKAN KPK, dan pencocokan
    // "mengandung" akan menyeret keduanya ke indikator yang salah.
    expect(outletKpk("Ayam Goreng Busari Serdam")).toBe(false);
    expect(outletKpk("Cattu Sintang")).toBe(false);
    expect(outletKpk("Nordu Coffee Serdam")).toBe(false);
  });

  it("tahan spasi berlebih dan beda huruf besar-kecil", () => {
    expect(outletKpk("  nordu   coffee  sandai ")).toBe(true);
    expect(outletKpk("NORDU GARDEN SINTANG")).toBe(true);
  });
});

describe("Supervisor dikeluarkan dari manajemen", () => {
  it("tidak ada di daftar departemen manajemen", () => {
    expect(DEPARTEMEN_MANAJEMEN.some((d) => d.kode === "supervisor")).toBe(false);
    expect(DEPARTEMEN_MANAJEMEN).toHaveLength(DEPARTEMEN.length - 1);
  });

  it("kedua posisinya tidak ada di daftar posisi manajemen", () => {
    expect(POSISI_MANAJEMEN.some((p) => p.kode === "supervisor_umum")).toBe(false);
    expect(POSISI_MANAJEMEN.some((p) => p.kode === "supervisor_kpk")).toBe(false);
    expect(POSISI_MANAJEMEN).toHaveLength(POSISI.length - 2);
  });

  it("seluruh posisi lain TETAP ikut — pengecualiannya tidak boleh kebablasan", () => {
    for (const kode of ["operational_ca", "creative_content", "finance_finance", "hc", "marcomm"]) {
      expect(POSISI_MANAJEMEN.some((p) => p.kode === kode)).toBe(true);
    }
  });
});

describe("HPP KPK — belanja dibagi penjualan", () => {
  it("menjumlah dulu baru membagi, bukan merata-ratakan persennya", () => {
    // Outlet besar 30%, outlet kecil 50%. Rata-rata persen = 40%; yang benar
    // 31,8% karena outlet besar memang menentukan sebagian besar belanjanya.
    const h = hppKpkPersen([
      { warehouse: 250, nonWarehouse: 50, gross: 1_000 },
      { warehouse: 40, nonWarehouse: 10, gross: 100 },
    ]);
    expect(h).toBeCloseTo((350 / 1100) * 100, 6);
    expect(h).not.toBeCloseTo(40, 1);
  });

  it("NOL DI KEDUA KOLOM berarti belum diunggah — outletnya dikeluarkan, bukan dihadiahi", () => {
    // Kalau nol diperlakukan apa adanya, hasilnya 350/2100 = 16,7% — HPP yang
    // jauh lebih baik daripada kenyataan, semata karena datanya belum masuk.
    const h = hppKpkPersen([
      { warehouse: 250, nonWarehouse: 50, gross: 1_000 },
      { warehouse: 0, nonWarehouse: 0, gross: 1_000 },
    ]);
    expect(h).toBeCloseTo(30, 6);
  });

  it("outlet yang sama sekali tidak punya baris pembelian juga dikeluarkan", () => {
    const h = hppKpkPersen([
      { warehouse: 250, nonWarehouse: 50, gross: 1_000 },
      { warehouse: null, nonWarehouse: null, gross: 1_000 },
    ]);
    expect(h).toBeCloseTo(30, 6);
  });

  it("outlet tanpa penjualan dikeluarkan — pembaginya tidak boleh nol", () => {
    expect(hppKpkPersen([{ warehouse: 100, nonWarehouse: 0, gross: 0 }])).toBeNull();
    expect(hppKpkPersen([{ warehouse: 100, nonWarehouse: 0, gross: null }])).toBeNull();
  });

  it("tidak ada satu pun yang bisa dihitung berarti null, bukan nol", () => {
    expect(hppKpkPersen([])).toBeNull();
    expect(hppKpkPersen([{ warehouse: 0, nonWarehouse: 0, gross: 1_000 }])).toBeNull();
  });

  it("angka sungguhan Agustus tetap masuk akal terhadap batas 35%", () => {
    // Penibung dan Sandai — dua ujung sebaran yang sebenarnya.
    expect(hppKpkPersen([{ warehouse: 145_554_400, nonWarehouse: 0, gross: 423_942_377 }])).toBeCloseTo(34.3, 1);
    expect(hppKpkPersen([{ warehouse: 97_277_330, nonWarehouse: 0, gross: 198_110_035 }])).toBeCloseTo(49.1, 1);
  });
});
