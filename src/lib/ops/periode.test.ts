import { describe, expect, it } from "vitest";
import { jendela, jendelaSebelum, NAMA_SKALA, TAHUN_TAMPIL, type Skala } from "./periode";
import { jumlahHari } from "./harian";
import { mingguBulan } from "@/lib/kpi/minggu";

/**
 * MODEL PERIODE — yang menentukan kolom kelima halaman Performance.
 *
 * Dua hal yang dijaga di sini, dan keduanya soal ANGKA, bukan tampilan:
 *
 *  1. Ember-embernya menutup seluruh jendela tanpa celah dan tanpa tumpang
 *     tindih. Satu hari yang jatuh di dua ember terhitung dua kali; satu hari
 *     yang tidak masuk ember mana pun hilang dari total — dan dua-duanya
 *     mustahil ketahuan dari layar.
 *  2. Minggu-minggunya SAMA dengan definisi yang sudah dipakai KPI. Dua
 *     definisi "minggu ke-3" berarti dua angka benar yang tidak bisa
 *     dipertemukan.
 */

const SEMUA: Skala[] = ["harian", "mingguan", "bulanan", "kuartalan", "tahunan"];
const acuanUntuk = (s: Skala) => (s === "harian" || s === "mingguan" ? "2026-08" : "2026");

describe("ember menutup jendelanya", () => {
  for (const s of SEMUA) {
    it(`${s}: tidak ada celah dan tidak ada tumpang tindih`, () => {
      const j = jendela(s, acuanUntuk(s));
      expect(j.ember.length).toBeGreaterThan(0);
      expect(j.ember[0].dari).toBe(j.dari);
      expect(j.ember[j.ember.length - 1].sampai).toBe(j.sampai);
      for (let i = 1; i < j.ember.length; i += 1) {
        const sebelumnya = new Date(`${j.ember[i - 1].sampai}T00:00:00Z`);
        const sekarang = new Date(`${j.ember[i].dari}T00:00:00Z`);
        const selisihHari = (sekarang.getTime() - sebelumnya.getTime()) / 86_400_000;
        // Persis satu hari: ember berikutnya mulai sehari sesudah yang sebelumnya
        // berakhir. Nol berarti tumpang tindih, lebih dari satu berarti berlubang.
        expect(selisihHari, `${s} ember ${i}`).toBe(1);
      }
    });

    it(`${s}: tiap ember mulai tidak sesudah berakhirnya`, () => {
      for (const e of jendela(s, acuanUntuk(s)).ember) expect(e.dari <= e.sampai).toBe(true);
    });

    it(`${s}: kunci kolomnya unik`, () => {
      // `tanggal` dipakai sebagai key React dan penentu urutan.
      const k = jendela(s, acuanUntuk(s)).ember.map((e) => e.kolom.tanggal);
      expect(new Set(k).size).toBe(k.length);
    });
  }
});

describe("bentuknya sesuai skalanya", () => {
  it("harian: satu ember per tanggal, dan itu tanggalnya sendiri", () => {
    const j = jendela("harian", "2026-02");
    expect(j.ember).toHaveLength(jumlahHari("2026-02"));
    expect(j.ember[0].dari).toBe("2026-02-01");
    expect(j.ember[0].sampai).toBe("2026-02-01");
    // Daily tidak memakai `label` — itu yang membuat kepala kolomnya tetap "01".
    expect(j.ember[0].kolom.label).toBeUndefined();
  });

  it("mingguan: IKUT definisi minggu yang dipakai KPI", () => {
    const j = jendela("mingguan", "2026-08");
    const m = mingguBulan("2026-08");
    expect(j.ember).toHaveLength(m.length);
    j.ember.forEach((e, i) => {
      expect(e.dari).toBe(`2026-08-${String(m[i].dari).padStart(2, "0")}`);
      expect(e.sampai).toBe(`2026-08-${String(m[i].sampai).padStart(2, "0")}`);
    });
  });

  it("bulanan: dua belas ember, satu tahun penuh", () => {
    const j = jendela("bulanan", "2026");
    expect(j.ember).toHaveLength(12);
    expect(j.dari).toBe("2026-01-01");
    expect(j.sampai).toBe("2026-12-31");
    expect(j.bulan).toHaveLength(12);
  });

  it("kuartalan: empat ember tiga bulanan", () => {
    const j = jendela("kuartalan", "2026");
    expect(j.ember).toHaveLength(4);
    expect(j.ember.map((e) => e.kolom.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(j.ember[0].dari).toBe("2026-01-01");
    expect(j.ember[3].sampai).toBe("2026-12-31");
  });

  it("tahunan: acuannya tahun TERAKHIR, kolomnya mundur dari situ", () => {
    const j = jendela("tahunan", "2026");
    expect(j.ember).toHaveLength(TAHUN_TAMPIL);
    expect(j.ember[j.ember.length - 1].kolom.label).toBe("2026");
    expect(j.ember[0].kolom.label).toBe(String(2026 - (TAHUN_TAMPIL - 1)));
  });
});

describe("jendela pembanding", () => {
  for (const s of SEMUA) {
    it(`${s}: kolom ke-i pembanding tepat mendahului kolom ke-i sekarang`, () => {
      // INI yang harus benar, bukan "jendelanya tidak tumpang tindih".
      //
      // Pada Yearly jendelanya memang bertindihan: 2022–2026 dibandingkan
      // dengan 2021–2025, karena yang dibandingkan kolom demi kolom — 2022
      // dengan 2021, 2023 dengan 2022. Yang salah justru kalau tidak
      // bertindihan, sebab berarti pembandingnya lompat lima tahun.
      const j = jendela(s, acuanUntuk(s));
      const lalu = jendelaSebelum(j);
      for (let i = 0; i < Math.min(j.ember.length, lalu.ember.length); i += 1) {
        expect(lalu.ember[i].sampai < j.ember[i].dari, `${s} kolom ${i}`).toBe(true);
      }
    });
  }

  it("mundur lalu maju kembali ke acuan semula", () => {
    for (const s of SEMUA) {
      const a = acuanUntuk(s);
      expect(jendela(s, jendela(s, a).sebelum).sesudah, s).toBe(a);
    }
  });
});

describe("nama skala", () => {
  it("tiap skala punya nama menu dan label agregatnya", () => {
    for (const s of SEMUA) {
      expect(NAMA_SKALA[s].menu, s).toBeTruthy();
      expect(NAMA_SKALA[s].agregat, s).toBeTruthy();
    }
    // Daily tidak boleh berubah namanya — itu label yang sudah ada di layar.
    expect(NAMA_SKALA.harian.agregat).toBe("Bulan Ini");
  });
});
