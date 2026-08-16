import { describe, expect, it } from "vitest";
import { batasBulan } from "./hygiene-bersih";

/**
 * Penjaga batas penghapusan foto Hygiene.
 *
 * Ini satu-satunya angka yang memisahkan "foto lama yang boleh dibuang" dari
 * "foto bulan ini yang masih dipakai supervisor untuk menindaklanjuti temuan".
 * Salah sehari saja artinya foto yang masih terpakai ikut terhapus, dan foto
 * tidak bisa dikembalikan.
 *
 * Yang diuji terutama tepi-tepinya: pergantian bulan, pergantian tahun, dan
 * selisih WIB — sebab di situlah kesalahan semacam ini selalu bersembunyi,
 * bukan di tengah bulan.
 */
describe("batasBulan", () => {
  it("menyimpan bulan berjalan saja saat simpanBulan = 1", () => {
    // 16 Agustus 2026 pukul 12.00 WIB.
    const kini = new Date("2026-08-16T05:00:00Z");
    expect(batasBulan(1, kini)).toBe("2026-08-01");
  });

  it("menyimpan dua bulan terakhir saat simpanBulan = 2", () => {
    const kini = new Date("2026-08-16T05:00:00Z");
    expect(batasBulan(2, kini)).toBe("2026-07-01");
  });

  it("menyeberangi pergantian tahun dengan benar", () => {
    const kini = new Date("2026-01-10T05:00:00Z");
    expect(batasBulan(1, kini)).toBe("2026-01-01");
    expect(batasBulan(2, kini)).toBe("2025-12-01");
    expect(batasBulan(3, kini)).toBe("2025-11-01");
  });

  it("memakai tanggal WIB, bukan UTC, di jam-jam rawan", () => {
    // 1 Agustus 2026 pukul 02.00 WIB = 31 Juli 19.00 UTC. Menghitung lewat UTC
    // akan mengira ini masih Juli, lalu MENGHAPUS foto bulan berjalan.
    const kini = new Date("2026-07-31T19:00:00Z");
    expect(batasBulan(1, kini)).toBe("2026-08-01");
  });

  it("tidak pernah menghapus bulan berjalan walau setelannya nol atau negatif", () => {
    const kini = new Date("2026-08-16T05:00:00Z");
    expect(batasBulan(0, kini)).toBe("2026-08-01");
    expect(batasBulan(-5, kini)).toBe("2026-08-01");
  });

  it("selalu jatuh di tanggal 1", () => {
    for (const hari of ["2026-03-01", "2026-03-15", "2026-03-31"]) {
      expect(batasBulan(1, new Date(`${hari}T05:00:00Z`))).toBe("2026-03-01");
    }
  });
});
