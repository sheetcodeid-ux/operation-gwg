import { describe, expect, it } from "vitest";
import { hitungProduksi, satuanSejenis, type OverheadProduksi } from "./calc";
import type { VariableItem } from "@/lib/hpp/calc";

/**
 * Contoh yang dipakai di sini adalah contoh nyata dari gudang: ayam ungkep,
 * sekali masak, lalu dibagi jadi potongan. Angka karangan mudah dibuat lulus;
 * angka yang benar-benar dikerjakan orang yang memakainya jauh lebih mungkin
 * menangkap kesalahan yang sesungguhnya terjadi.
 */
const bahan = (name: string, takaran: number, takaranUnit: string, buyPrice: number, buyQty: number, buyUnit: string): VariableItem =>
  ({ id: name, name, takaran, takaranUnit, buyPrice, buyQty, buyUnit });

const oh = (name: string, biaya: number): OverheadProduksi => ({ id: name, name, biaya });

describe("hitungProduksi — sekali masak dibagi hasilnya", () => {
  it("ayam ungkep: 10 kg ayam jadi 40 potong", () => {
    const hasil = hitungProduksi({
      bahan: [
        bahan("Ayam", 10, "kg", 38000, 1, "kg"), // 380.000
        bahan("Bumbu ungkep", 500, "g", 24000, 1, "kg"), // 12.000
      ],
      overhead: [oh("Gas", 15000), oh("Tenaga kerja", 50000)],
      hasil: 40,
      hasilUnit: "pcs",
      susutPct: 0,
    });
    expect(hasil.biayaBahan).toBe(392000);
    expect(hasil.biayaOverhead).toBe(65000);
    expect(hasil.totalBatch).toBe(457000);
    expect(hasil.hasilBersih).toBe(40);
    expect(hasil.hppPerUnit).toBe(11425);
  });

  it("penyusutan menaikkan biaya per unit, bukan menurunkannya", () => {
    const dasar = {
      bahan: [bahan("Ayam", 10, "kg", 38000, 1, "kg")],
      overhead: [],
      hasil: 10,
      hasilUnit: "kg",
    };
    const tanpaSusut = hitungProduksi({ ...dasar, susutPct: 0 });
    const denganSusut = hitungProduksi({ ...dasar, susutPct: 20 });
    // Biaya bahannya sama, hasilnya yang berkurang — jadi per kilo jadi lebih
    // mahal. Kalau hasilnya terbalik, rumusnya menyembunyikan kerugian.
    expect(denganSusut.biayaBahan).toBe(tanpaSusut.biayaBahan);
    expect(denganSusut.hasilBersih).toBe(8);
    expect(denganSusut.hppPerUnit).toBeGreaterThan(tanpaSusut.hppPerUnit);
    expect(denganSusut.hppPerUnit).toBe(47500);
  });

  it("mode satuan = batch dengan hasil 1", () => {
    const satu = hitungProduksi({
      bahan: [bahan("Roti", 1, "pcs", 3000, 1, "pcs"), bahan("Isian", 40, "g", 60000, 1, "kg")],
      overhead: [oh("Listrik", 500)],
      hasil: 1,
      hasilUnit: "pcs",
      susutPct: 0,
    });
    expect(satu.biayaBahan).toBe(5400);
    expect(satu.hppPerUnit).toBe(5900);
  });

  it("konversi satuan mengikuti aturan yang sama dengan kalkulator PDQ", () => {
    // 250 g dari pembelian 1 kg seharga 20.000 = 5.000.
    const r = hitungProduksi({
      bahan: [bahan("Bumbu", 250, "g", 20000, 1, "kg")],
      overhead: [],
      hasil: 1,
      hasilUnit: "pcs",
      susutPct: 0,
    });
    expect(r.biayaBahan).toBe(5000);
  });
});

describe("hitungProduksi — tepi yang gampang bikin layar rusak", () => {
  it("hasil belum diisi tidak menghasilkan Infinity", () => {
    const r = hitungProduksi({ bahan: [bahan("Ayam", 1, "kg", 38000, 1, "kg")], overhead: [], hasil: 0, hasilUnit: "pcs", susutPct: 0 });
    // Bukan Infinity, bukan NaN — nol, yang terbaca sebagai "belum terisi".
    expect(r.hppPerUnit).toBe(0);
    expect(Number.isFinite(r.hppPerUnit)).toBe(true);
  });

  it("penyusutan 100% tidak menghasilkan NaN", () => {
    const r = hitungProduksi({ bahan: [bahan("Ayam", 1, "kg", 38000, 1, "kg")], overhead: [], hasil: 10, hasilUnit: "kg", susutPct: 100 });
    expect(r.hasilBersih).toBe(0);
    expect(r.hppPerUnit).toBe(0);
  });

  it("penyusutan di luar 0–100 dijepit, bukan dipakai apa adanya", () => {
    const naik = hitungProduksi({ bahan: [], overhead: [oh("Gas", 1000)], hasil: 10, hasilUnit: "kg", susutPct: 250 });
    expect(naik.hasilBersih).toBe(0);
    const turun = hitungProduksi({ bahan: [], overhead: [oh("Gas", 1000)], hasil: 10, hasilUnit: "kg", susutPct: -50 });
    // Penyusutan negatif berarti hasilnya BERTAMBAH sendiri — mustahil.
    expect(turun.hasilBersih).toBe(10);
  });

  it("resep kosong menghasilkan nol di semua kolom, bukan NaN", () => {
    const r = hitungProduksi({ bahan: [], overhead: [], hasil: 0, hasilUnit: "pcs", susutPct: 0 });
    for (const n of [r.biayaBahan, r.biayaOverhead, r.totalBatch, r.hasilBersih, r.hppPerUnit, r.porsiBahanPct]) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBe(0);
    }
  });

  it("porsi bahan dihitung terhadap total, dan aman saat total nol", () => {
    const r = hitungProduksi({
      bahan: [bahan("Ayam", 1, "kg", 75000, 1, "kg")],
      overhead: [oh("Gas", 25000)],
      hasil: 1,
      hasilUnit: "pcs",
      susutPct: 0,
    });
    expect(r.porsiBahanPct).toBe(75);
    expect(hitungProduksi({ bahan: [], overhead: [], hasil: 1, hasilUnit: "pcs", susutPct: 0 }).porsiBahanPct).toBe(0);
  });

  it("angka rusak dari formulir tidak merambat jadi NaN", () => {
    const r = hitungProduksi({
      bahan: [bahan("Rusak", NaN, "g", NaN, 0, "kg")],
      overhead: [{ id: "x", name: "x", biaya: NaN as unknown as number }],
      hasil: NaN as unknown as number,
      hasilUnit: "pcs",
      susutPct: NaN as unknown as number,
    });
    for (const n of [r.biayaOverhead, r.totalBatch, r.hasilBersih, r.hppPerUnit]) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });
});

describe("satuanSejenis", () => {
  it("mengenali satuan sejenis", () => {
    expect(satuanSejenis("kg", "g")).toBe(true);
    expect(satuanSejenis("L", "ml")).toBe(true);
  });

  it("menandai satuan beda jenis", () => {
    expect(satuanSejenis("kg", "ml")).toBe(false);
  });

  it("tidak menilai satuan di luar daftar", () => {
    // "porsi" dan "pack" memang tidak punya dimensi — menganggapnya salah akan
    // memunculkan peringatan pada resep yang justru paling wajar.
    expect(satuanSejenis("porsi", "kg")).toBe(true);
    expect(satuanSejenis("pack", "ml")).toBe(true);
  });
});
