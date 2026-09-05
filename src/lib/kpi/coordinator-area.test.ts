import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { barisKpi, hitungTarget, persentaseCapaian } from "./hitung";
import { INDIKATOR } from "./indikator";
import type { Indikator } from "./indikator";

/**
 * KPI Coordinator Area.
 *
 * Tiga dari lima indikatornya TIDAK dinilai "makin besar makin baik", dan itu
 * yang paling gampang salah: kalau dinilai dengan rumus biasa, area yang paling
 * banyak dikomplain dan harga pokoknya paling boros justru mendapat nilai
 * penuh. Angkanya akan terlihat wajar, dan tidak ada yang akan memeriksanya.
 */

const ind = (key: string): Indikator => {
  const i = INDIKATOR.operational_ca.find((x) => x.key === key);
  if (!i) throw new Error(`indikator ${key} hilang`);
  return i;
};

const KOSONG = { jumlahBrand: 4, jumlahOutlet: 12, actualBulanLalu: null, jumlahPekerjaan: null, rataTigaBulan: null, dasarPorsi: null };

describe("bobotnya", () => {
  it("berjumlah tepat 100%", () => {
    // Bobot yang tidak genap 100 membuat skor tertinggi ikut terpotong, dan
    // orang yang sempurna tetap terlihat gagal.
    const total = INDIKATOR.operational_ca.reduce((a, i) => a + i.bobot, 0);
    expect(total).toBe(100);
  });

  it("sesuai yang ditetapkan: 35 / 30 / 5 / 10 / 20", () => {
    expect(ind("gross_sales").bobot).toBe(35);
    expect(ind("net_profit").bobot).toBe(30);
    expect(ind("hygiene_cctv").bobot).toBe(5);
    expect(ind("komplain_area").bobot).toBe(10);
    expect(ind("hpp").bobot).toBe(20);
  });
});

describe("Gross Sales — target rata-rata 3 bulan + 15%", () => {
  it("dihitung dari rata-rata tiga bulan, bukan bulan lalu saja", () => {
    // Satu bulan Lebaran atau satu bulan sepi akan menggeser target jauh, dan
    // yang dinilai jadi beruntung atau celaka karena kalender.
    const t = hitungTarget(ind("gross_sales").target, { ...KOSONG, rataTigaBulan: 1_000_000_000 });
    expect(t).toBe(1_150_000_000);
  });

  it("belum ada tiga bulannya berarti belum ada target, bukan target nol", () => {
    // Target nol akan membuat capaiannya tak-hingga lalu dipotong jadi penuh.
    expect(hitungTarget(ind("gross_sales").target, KOSONG)).toBeNull();
  });

  it("capaiannya dipotong di 100%, tidak menutupi indikator lain", () => {
    const b = barisKpi({ indikator: ind("gross_sales"), bobot: 35, target: 1_000_000_000, actual: 2_000_000_000 });
    expect(b.persentase).toBe(100);
    expect(b.persenActual).toBe(35);
  });
});

describe("Net Profit — 30% dari Gross Sales yang tercapai", () => {
  it("targetnya ikut turun saat penjualan meleset", () => {
    // Dasarnya gross sales yang BENAR-BENAR tercapai, bukan yang ditargetkan:
    // meleset di penjualan tidak boleh menghukum orang dua kali.
    const t = hitungTarget(ind("net_profit").target, { ...KOSONG, dasarPorsi: 800_000_000 });
    expect(t).toBe(240_000_000);
  });

  it("margin 30% berarti nilai penuh 30%", () => {
    const b = barisKpi({ indikator: ind("net_profit"), bobot: 30, target: 240_000_000, actual: 240_000_000 });
    expect(b.persentase).toBe(100);
    expect(b.persenActual).toBe(30);
  });

  it("margin separuh target bernilai separuh bobotnya", () => {
    const b = barisKpi({ indikator: ind("net_profit"), bobot: 30, target: 240_000_000, actual: 120_000_000 });
    expect(b.persentase).toBe(50);
    expect(b.persenActual).toBe(15);
  });

  it("gross sales belum ada berarti target belum ada", () => {
    expect(hitungTarget(ind("net_profit").target, KOSONG)).toBeNull();
  });
});

describe("Complaint — 20 adalah BATAS, bukan sasaran", () => {
  it("20 atau kurang bernilai penuh", () => {
    expect(persentaseCapaian(20, 20, "batas_maks")).toBe(100);
    expect(persentaseCapaian(3, 20, "batas_maks")).toBe(100);
    expect(persentaseCapaian(0, 20, "batas_maks")).toBe(100);
  });

  it("lebih dari 20 turun proporsional — 40 komplain bernilai separuh", () => {
    expect(persentaseCapaian(40, 20, "batas_maks")).toBe(50);
    const b = barisKpi({ indikator: ind("komplain_area"), bobot: 10, target: 20, actual: 40 });
    expect(b.persenActual).toBe(5);
  });

  it("TIDAK dinilai dengan rumus biasa", () => {
    // Inilah kesalahan yang dijaga: rumus biasa memberi 40 komplain nilai
    // 200% lalu dipotong jadi penuh — yang paling banyak dikomplain justru
    // bernilai sempurna.
    expect(persentaseCapaian(40, 20)).toBe(100);
    expect(persentaseCapaian(40, 20, "batas_maks")).toBe(50);
  });
});

describe("Harga Pokok Penjualan — lulus atau tidak", () => {
  it("40% atau kurang bernilai penuh", () => {
    expect(persentaseCapaian(40, 40, "lulus_maks")).toBe(100);
    expect(persentaseCapaian(32, 40, "lulus_maks")).toBe(100);
  });

  it("lewat sedikit pun bernilai nol — tidak ada nilai separuh", () => {
    // Diminta tegas: "HPP >40% = 0%". 40,1% sama nilainya dengan 80%.
    expect(persentaseCapaian(40.1, 40, "lulus_maks")).toBe(0);
    const b = barisKpi({ indikator: ind("hpp"), bobot: 20, target: 40, actual: 45 });
    expect(b.persenActual).toBe(0);
  });
});

describe("Hygiene Audit / CCTV", () => {
  it("40 submit sebulan bernilai penuh, kurang dari itu turun proporsional", () => {
    expect(persentaseCapaian(40, 40)).toBe(100);
    expect(persentaseCapaian(20, 40)).toBe(50);
    const b = barisKpi({ indikator: ind("hygiene_cctv"), bobot: 5, target: 40, actual: 20 });
    expect(b.persenActual).toBe(2.5);
  });

  it("dicatat lewat entri berbukti, bukan diketik satu angka", () => {
    // Satu angka yang diketik tidak bisa diperiksa kembali; barisnya bisa.
    expect(ind("hygiene_cctv").actual).toEqual({ sumber: "entri", entri: "hygiene_cctv" });
  });
});

describe("skor tertinggi seluruh indikator", () => {
  it("tepat 100%, tidak lebih", () => {
    const baris = [
      barisKpi({ indikator: ind("gross_sales"), bobot: 35, target: 1_000, actual: 5_000 }),
      barisKpi({ indikator: ind("net_profit"), bobot: 30, target: 300, actual: 900 }),
      barisKpi({ indikator: ind("hygiene_cctv"), bobot: 5, target: 40, actual: 60 }),
      barisKpi({ indikator: ind("komplain_area"), bobot: 10, target: 20, actual: 0 }),
      barisKpi({ indikator: ind("hpp"), bobot: 20, target: 40, actual: 35 }),
    ];
    expect(baris.reduce((a, b) => a + (b.persenActual ?? 0), 0)).toBe(100);
  });
});

describe("Net Profit yang minus", () => {
  it("boleh minus — outlet yang rugi memang ada", () => {
    // Menolaknya membuat bulan yang buruk mustahil dilaporkan apa adanya; yang
    // mengisinya akan memasukkan nol atau membiarkannya kosong, dan laporannya
    // jadi lebih baik daripada kenyataannya.
    const aksi = readFileSync(join(process.cwd(), "src/lib/actions/kpi.ts"), "utf8");
    expect(aksi).toContain("const takBolehMinus = [b.gross, b.hppNominal];");
    expect(aksi).toContain("Penjualan dan harga pokok tidak bisa minus.");
  });

  it("capaiannya nol, bukan minus", () => {
    // Capaian minus akan MENARIK TURUN skor indikator lain lewat penjumlahan —
    // hukuman untuk satu indikator merembet ke yang tidak ada hubungannya.
    expect(persentaseCapaian(-6_860_286, 240_000_000)).toBe(0);
    const b = barisKpi({ indikator: ind("net_profit"), bobot: 30, target: 240_000_000, actual: -6_860_286 });
    expect(b.persenActual).toBe(0);
    // Angka ruginya tetap terbaca apa adanya.
    expect(b.actual).toBe(-6_860_286);
  });
});
