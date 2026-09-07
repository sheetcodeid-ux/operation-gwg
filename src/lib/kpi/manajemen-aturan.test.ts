import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aturan KPI Manajemen yang kalau dilanggar TIDAK terlihat salah.
 *
 * Halamannya penuh angka besar yang mustahil dihafal, jadi omzet yang
 * kekurangan satu miliar tetap tampak wajar. Yang dijaga di sini adalah
 * jalan-jalan sunyi tempat angka bisa hilang tanpa satu pun pesan galat.
 */

const data = readFileSync(join(process.cwd(), "src/lib/data/kpi-manajemen.ts"), "utf8");

describe("bulan yang diisi tangan", () => {
  it("memakai ANGKA KETIKAN, bukan ESB dan bukan nol", () => {
    // Bulan ditandai manual justru KARENA angka ESB-nya salah, jadi memakai
    // ESB apa adanya mengembalikan angka yang sudah ditolak. Tapi nol lebih
    // buruk lagi: outletnya seolah tidak berjualan, omzet korporat turun
    // diam-diam, dan outletnya ikut tercoret dari same store karena satu
    // bulan pembandingnya kosong.
    expect(data).toContain("? (ketik.get(o.id) ?? 0)");
    expect(data).toContain(": jual(esb, o.esbBranchId);");
  });

  it("dipakai komponen A dan B sekaligus", () => {
    // Dulu hanya komponen B yang menolak angka ESB bulan manual, sementara
    // komponen A memakainya apa adanya — satu bulan yang sama bernilai dua
    // hal berbeda di satu halaman.
    expect(data).toContain("outletAktif.reduce((s, o) => s + omzet(o, esb, ketik, bulan), 0)");
    expect(data).toContain("actual: omzet(o, esbIni, ketikIni, periode),");
  });

  it("angka ketikan ditarik untuk bulan berjalan DAN tiga bulan pembanding", () => {
    // Target adalah rata-rata tiga bulan sebelumnya. Menarik isian tangan
    // hanya untuk bulan berjalan membuat targetnya tetap salah.
    expect(data).toContain("const [ketikIni, ...ketikLalu] = await Promise.all([");
    expect(data).toContain("...bulanA.map((b) => grossKetikBulan(b)),");
  });
});
