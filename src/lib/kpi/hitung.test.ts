import { describe, expect, it } from "vitest";
import {
  BATAS_PERSENTASE,
  actualLulus,
  actualPengurang,
  barisEfisiensi,
  barisKpi,
  hitungTarget,
  keberhasilanPasar,
  persentaseCapaian,
  ringkasEfisiensi,
  ringkasKpi,
  type BarisKpi,
} from "./hitung";
import { INDIKATOR, indikatorPosisi } from "./indikator";
import { DEPARTEMEN, POSISI, posisiDepartemen } from "./struktur";

/**
 * Mesin hitung KPI.
 *
 * Yang dikunci di sini bukan angkanya, melainkan sifat-sifat yang membuat KPI
 * ini bisa dipakai menilai orang: capaiannya tidak bisa dilampaui tanpa batas,
 * yang belum terukur tidak dihitung nol, dan hasilnya cocok sampai dua angka
 * di belakang koma dengan hitungan manual yang sudah dipakai selama ini.
 */

const ind = (key: string, bobot: number) => ({
  key,
  label: key,
  bobot,
  target: { jenis: "tetap" as const, nilai: 10 },
  actual: { sumber: "manual" as const },
  penjelasan: "",
});

describe("persentase capaian", () => {
  it("actual dibagi target", () => {
    expect(persentaseCapaian(6, 10)).toBe(60);
    expect(persentaseCapaian(7, 10)).toBe(70);
  });

  it("tidak pernah lebih dari 100%", () => {
    // Tanpa batas ini, satu indikator yang mudah dilampaui bisa menutupi
    // seluruh indikator lain yang gagal.
    expect(persentaseCapaian(20, 10)).toBe(BATAS_PERSENTASE);
  });

  it("target nol bukan capaian sempurna, melainkan belum terukur", () => {
    // Menganggapnya 100% berarti memberi nilai penuh untuk sesuatu yang tidak
    // pernah diminta.
    expect(persentaseCapaian(5, 0)).toBeNull();
  });

  it("tanpa actual atau tanpa target: belum terukur", () => {
    expect(persentaseCapaian(null, 10)).toBeNull();
    expect(persentaseCapaian(5, null)).toBeNull();
  });
});

describe("% actual dan skor", () => {
  it("bobot 10% dengan capaian 60% menghasilkan 6%", () => {
    // Contoh yang diberikan Fikri, dikunci apa adanya.
    const b = barisKpi({ indikator: ind("x", 10), bobot: 10, target: 10, actual: 6 });
    expect(b.persentase).toBe(60);
    expect(b.persenActual).toBe(6);
  });

  it("skor adalah jumlah seluruh % actual", () => {
    const baris = [
      barisKpi({ indikator: ind("a", 50), bobot: 50, target: 10, actual: 7 }),
      barisKpi({ indikator: ind("b", 50), bobot: 50, target: 4, actual: 4 }),
    ];
    // 50%×70% = 35, 50%×100% = 50 → 85
    expect(ringkasKpi(baris).skor).toBe(85);
  });

  it("yang belum terukur dikeluarkan dari bobot, bukan dihitung nol", () => {
    // Nol berarti "gagal total" — tuduhan yang berbeda dari "belum diukur".
    const baris = [
      barisKpi({ indikator: ind("a", 60), bobot: 60, target: 10, actual: 10 }),
      barisKpi({ indikator: ind("b", 40), bobot: 40, target: null, actual: null }),
    ];
    const r = ringkasKpi(baris);
    expect(r.skor).toBe(60);
    expect(r.bobotTerpakai).toBe(60);
    expect(r.bobotTotal).toBe(100);
    expect(r.jumlahBelumTerukur).toBe(1);
    // Setara 100 supaya bisa dibandingkan dengan posisi yang indikatornya lengkap.
    expect(r.skorSetara).toBe(100);
  });

  it("tanpa satu pun data, skornya bukan nol tapi tidak ada", () => {
    const r = ringkasKpi([barisKpi({ indikator: ind("a", 100), bobot: 100, target: null, actual: null })]);
    expect(r.skorSetara).toBeNull();
  });
});

describe("jenis target", () => {
  const k = { jumlahBrand: 4, jumlahOutlet: 58, actualBulanLalu: 61606, jumlahPekerjaan: 100 };

  it("target per brand dikalikan jumlah brand", () => {
    expect(hitungTarget({ jenis: "tetap", nilai: 10, perBrand: true }, k)).toBe(40);
    expect(hitungTarget({ jenis: "tetap", nilai: 10 }, k)).toBe(10);
  });

  it("target tumbuh dihitung dari capaian bulan lalu", () => {
    // Contoh Fikri: Juni 61.606 → Juli 70.847.
    const t = hitungTarget({ jenis: "tumbuh", pertumbuhan: 15 }, k)!;
    expect(Math.round(t)).toBe(70847);
  });

  it("bulan pertama belum punya target pertumbuhan", () => {
    // Bukan nol: tidak ada bulan lalu untuk dijadikan dasar.
    expect(hitungTarget({ jenis: "tumbuh", pertumbuhan: 15 }, { ...k, actualBulanLalu: null })).toBeNull();
  });

  it("target mengikuti jumlah pekerjaan dan jumlah outlet", () => {
    expect(hitungTarget({ jenis: "pekerjaan" }, k)).toBe(100);
    expect(hitungTarget({ jenis: "outlet" }, k)).toBe(58);
  });
});

describe("indikator pengurang", () => {
  it("tiap temuan mengurangi satu dari target", () => {
    // Contoh Fikri: target 10, 3 temuan → actual 7 → 70% → bobot 50% = 35%.
    const actual = actualPengurang(10, 3);
    expect(actual).toBe(7);
    const b = barisKpi({ indikator: ind("akurasi", 50), bobot: 50, target: 10, actual });
    expect(b.persentase).toBe(70);
    expect(b.persenActual).toBe(35);
  });

  it("kegagalan melebihi target berhenti di nol, tidak minus", () => {
    // Nilai minus akan menarik turun indikator lain yang tidak ada hubungannya.
    expect(actualPengurang(10, 14)).toBe(0);
  });

  it("telat sekali pada indikator lulus-atau-tidak langsung nol", () => {
    expect(actualLulus(4, 0)).toBe(4);
    expect(actualLulus(4, 1)).toBe(0);
  });
});

describe("efisiensi beban operasional", () => {
  // Angka dari contoh Fikri: Cattu A. Yani, average Rp245.633.267.
  const baris = barisEfisiensi({
    outletId: "o1",
    outletNama: "Cattu A. Yani",
    average: 245_633_267,
    actualWh: 70_000_000,
    actualNonWh: 3_000_000,
  });

  it("target warehouse 30% dari average, non-warehouse 5% dari itu", () => {
    expect(Math.round(baris.targetWh!)).toBe(73_689_980);
    expect(Math.round(baris.targetNonWh!)).toBe(3_684_499);
  });

  it("% actual dihitung terhadap patokan 35%", () => {
    // (73.000.000 ÷ 77.374.479) × 35% = 33,02%
    expect(baris.persenActual!).toBeCloseTo(33.02, 1);
    expect(baris.selisih!).toBeLessThan(0); // tersisa
  });

  it("outlet yang belum dilaporkan tidak dihitung nol", () => {
    // Nol berarti mengklaim outlet itu tidak mengeluarkan biaya sama sekali.
    const kosong = barisEfisiensi({ outletId: "o2", outletNama: "B", average: 100, actualWh: null, actualNonWh: null });
    expect(kosong.actual).toBeNull();
    expect(kosong.persenActual).toBeNull();
  });

  it("seluruh outlet DITOTALKAN, bukan dirata-rata", () => {
    // Dirata-rata, satu cabang kecil yang boros bisa menutupi seluruh
    // perusahaan yang hemat.
    const besar = barisEfisiensi({ outletId: "a", outletNama: "A", average: 1_000_000_000, actualWh: 300_000_000, actualNonWh: 15_000_000 });
    const kecil = barisEfisiensi({ outletId: "b", outletNama: "B", average: 10_000_000, actualWh: 9_000_000, actualNonWh: 0 });
    const r = ringkasEfisiensi([besar, kecil]);
    expect(r.totalBudget).toBeCloseTo(315_000_000 + 3_150_000, 0);
    expect(r.totalActual).toBe(324_000_000);
    expect(r.outletTerhitung).toBe(2);
  });

  it("belanja sesuai budget berarti capaian penuh", () => {
    const pas = barisEfisiensi({ outletId: "a", outletNama: "A", average: 1000, actualWh: 300, actualNonWh: 15 });
    expect(ringkasEfisiensi([pas]).capaian).toBe(100);
  });

  it("lebih hemat tetap 100%, lebih boros turun sebanding", () => {
    const hemat = barisEfisiensi({ outletId: "a", outletNama: "A", average: 1000, actualWh: 200, actualNonWh: 0 });
    expect(ringkasEfisiensi([hemat]).capaian).toBe(100);
    const boros = barisEfisiensi({ outletId: "a", outletNama: "A", average: 1000, actualWh: 600, actualNonWh: 30 });
    expect(ringkasEfisiensi([boros]).capaian!).toBeCloseTo(50, 0);
  });
});

describe("keberhasilan pasar", () => {
  it("cocok dengan hitungan manual sampai dua angka di belakang koma", () => {
    // Contoh Fikri: total 0,19% dari target 1,50% menghasilkan 12,54%.
    // Kalau bagiannya dibulatkan dulu jadi 0,19% baru dibagi, hasilnya 12,67%
    // dan tidak cocok — karena itu pembulatan hanya di tampilan.
    const r = keberhasilanPasar(
      [
        { menu: "WIM", penjualan: 5_034_909 },
        { menu: "Leopard", penjualan: 20_436_363 },
        { menu: "Bubur Ayam", penjualan: 20_000 },
      ],
      13_552_933_416,
      1.5,
    );
    expect(r.bagianTotal!).toBeCloseTo(0.188, 3);
    expect(r.capaian!).toBeCloseTo(12.54, 2);
  });

  it("tanpa omset tidak mengarang capaian", () => {
    expect(keberhasilanPasar([{ menu: "A", penjualan: 100 }], 0, 1.5).capaian).toBeNull();
  });
});

describe("struktur & bobot tiap posisi", () => {
  it("setiap posisi punya daftar indikator", () => {
    for (const p of POSISI) {
      expect(indikatorPosisi(p.kode).length, `${p.nama} tanpa indikator`).toBeGreaterThan(0);
    }
  });

  it("kunci indikator tidak kembar dalam satu posisi", () => {
    // Kunci kembar membuat angka yang satu menimpa yang lain saat disimpan.
    for (const [posisi, daftar] of Object.entries(INDIKATOR)) {
      const kunci = daftar.map((i) => i.key);
      expect(new Set(kunci).size, `${posisi} punya kunci kembar`).toBe(kunci.length);
    }
  });

  it("bobot tiap posisi berjumlah 100 — kecuali Sosial Media yang memang 90", () => {
    // Bobot Sosial Media yang diberikan berjumlah 90%. Dibiarkan apa adanya
    // atas keputusan Fikri: nanti diperbaiki lewat pengaturan, bukan ditebak
    // di sini. Yang dijaga tes ini adalah bahwa itu SATU-SATUNYA pengecualian.
    for (const [posisi, daftar] of Object.entries(INDIKATOR)) {
      const total = daftar.reduce((a, i) => a + i.bobot, 0);
      expect(total, `${posisi} berjumlah ${total}`).toBe(posisi === "creative_sosmed" ? 90 : 100);
    }
  });

  it("setiap posisi terdaftar di departemennya", () => {
    for (const p of POSISI) {
      expect(posisiDepartemen(p.departemen).map((x) => x.kode)).toContain(p.kode);
    }
  });

  it("departemen yang indikatornya belum ada ditandai menyusul, bukan dibiarkan kosong", () => {
    // Departemen kosong tanpa keterangan terbaca seperti fitur yang rusak.
    for (const d of DEPARTEMEN) {
      if (d.posisi.length === 0) expect(d.menyusul?.length ?? 0, `${d.nama}`).toBeGreaterThan(0);
    }
  });

  it("Head Food Development dan Head PDQ tidak dinilai efisiensi operasional", () => {
    for (const kode of ["pdq_head_food", "pdq_head_pdq"] as const) {
      expect(indikatorPosisi(kode).map((i) => i.key)).not.toContain("efisiensi");
    }
  });

  it("Food Staff dan Beverage Staff memakai indikator yang sama persis", () => {
    expect(indikatorPosisi("pdq_food")).toEqual(indikatorPosisi("pdq_beverage"));
  });
});

describe("baris yang belum terukur membawa alasannya", () => {
  it("alasan ikut tersimpan supaya bisa ditulis di layar", () => {
    // "Belum ada data" tanpa sebab akan dibaca sebagai sistem yang rusak.
    const b: BarisKpi = barisKpi({
      indikator: ind("views", 5),
      bobot: 5,
      target: null,
      actual: null,
      alasan: "Belum ada capaian bulan lalu sebagai dasar target.",
    });
    expect(b.alasan).toContain("bulan lalu");
    expect(b.persenActual).toBeNull();
  });
});
