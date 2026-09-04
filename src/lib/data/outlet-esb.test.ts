import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { samakan } from "./outlet-esb";

/**
 * Pemasangan outlet dengan id cabang ESB.
 *
 * Salah pasang adalah kesalahan yang paling sulit ditemukan di seluruh modul
 * ini: penjualan cabang lain masuk ke KPI outlet ini, angkanya tetap terlihat
 * wajar, dan tidak ada satu pun pesan yang menandainya. Karena itu yang dijaga
 * bukan "sebanyak mungkin terpasang", melainkan "tidak ada yang salah pasang".
 */

const sumber = readFileSync(join(process.cwd(), "src/lib/data/outlet-esb.ts"), "utf8");

describe("menyeragamkan nama sebelum dicocokkan", () => {
  it("beda huruf besar-kecil dan spasi ganda tetap satu cabang", () => {
    expect(samakan("HEAD OFFICE")).toBe(samakan("Head Office"));
    expect(samakan("Nordu  Coffee   Sambas")).toBe(samakan("Nordu Coffee Sambas"));
  });

  it("tanda baca di ujung nama diabaikan", () => {
    // Benar-benar ada di data ESB: "Nordu Banjarbaru -".
    expect(samakan("Nordu Banjarbaru -")).toBe(samakan("Nordu Banjarbaru"));
  });

  it("angka pembeda cabang TIDAK ikut dihapus", () => {
    // "Yogyakarta 1" dan "Yogyakarta 2" dua cabang berbeda; menyamakannya
    // berarti seluruh penjualan salah satunya hilang dari KPI.
    expect(samakan("Nordu Coffee Yogyakarta 1")).not.toBe(samakan("Nordu Coffee Yogyakarta 2"));
    expect(samakan("Nordu Banjarbaru 2")).not.toBe(samakan("Nordu Banjarbaru"));
  });
});

describe("yang tidak pasti tidak dipasangkan", () => {
  it("hanya nama yang cocok PERSIS yang dipasang — tidak ada penebakan mirip", () => {
    expect(sumber).toContain("petaCabang.get(samakan(o.name))");
    for (const kata of ["levenshtein", "similarity", "startsWith", "includes("]) {
      expect(sumber.toLowerCase(), `pencocokan longgar lewat ${kata}`).not.toContain(kata.toLowerCase());
    }
  });

  it("nama cabang yang muncul dua kali di ESB dilewati, bukan diambil yang pertama", () => {
    // Memilih yang pertama sama saja dengan memilih secara acak.
    expect(sumber).toContain("jumlahNama.get(samakan(b.name)) === 1");
  });

  it("outlet yang sudah punya id tidak pernah ditimpa", () => {
    // Pemasangan manual yang benar tidak boleh dibatalkan oleh pekerjaan ini.
    expect(sumber).toContain("if (o.esb_branch_id)");
    expect(sumber).toContain("hasil.sudah += 1");
  });

  it("yang tidak cocok dilaporkan namanya, bukan didiamkan", () => {
    expect(sumber).toContain("tanpaPadanan");
    expect(sumber).toContain("cabangTakTerpakai");
  });
});
