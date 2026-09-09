import { describe, expect, it } from "vitest";
import { TENGGAT, lewatTenggat, nilaiTenggat, tanggalTenggat } from "./deadline";

/**
 * Aturan tenggat yang kalau dilanggar TIDAK terlihat salah: tanggal yang meleset
 * satu hari, dan permintaan berjalan yang diam-diam dihitung gagal.
 */

describe("tanggal tenggat dihitung dari tanggal permintaan", () => {
  it("H-5 jatuh lima hari setelahnya, H-3 tiga hari", () => {
    // Contoh yang dipakai saat aturannya ditetapkan: minta 6 September.
    // "Sebelum H-5" ditetapkan enam hari, bukan tebakan: kalau angkanya
    // bergeser diam-diam, seluruh tenggat yang sudah tercatat ikut bergeser.
    expect(tanggalTenggat("2026-09-06", "sebelum_h5")).toBe("2026-09-12");
    expect(tanggalTenggat("2026-09-06", "h5")).toBe("2026-09-11");
    expect(tanggalTenggat("2026-09-06", "h3")).toBe("2026-09-09");
    expect(tanggalTenggat("2026-09-06", "h1")).toBe("2026-09-07");
  });

  it("melewati pergantian bulan dengan benar", () => {
    // Ditulis sebagai tanggal, bukan penjumlahan hari pada teks — 30 + 5 harus
    // menjadi 5 Oktober, bukan "September 35".
    expect(tanggalTenggat("2026-09-30", "h5")).toBe("2026-10-05");
  });

  it("kategori yang tidak dikenal tidak menghasilkan tanggal asal-asalan", () => {
    expect(tanggalTenggat("2026-09-06", "besok")).toBeNull();
  });
});

describe("nilai satu permintaan", () => {
  const hariIni = "2026-09-20";

  it("tenggat longgar: gagal mengurangi, tepat waktu tidak menambah", () => {
    expect(nilaiTenggat({ kategori: "sebelum_h5", tenggat: "2026-09-10", selesaiPada: "2026-09-12", hariIni })).toBe(-3);
    expect(nilaiTenggat({ kategori: "sebelum_h5", tenggat: "2026-09-10", selesaiPada: "2026-09-09", hariIni })).toBe(0);
    expect(nilaiTenggat({ kategori: "h5", tenggat: "2026-09-10", selesaiPada: "2026-09-12", hariIni })).toBe(-2);
  });

  it("tenggat sempit: gagal tidak menghukum, tepat waktu menambah", () => {
    // Yang meminta sendiri yang menyisakan waktu sempit — tim yang mengerjakan
    // tidak boleh dihukum atas keputusan itu.
    expect(nilaiTenggat({ kategori: "h3", tenggat: "2026-09-10", selesaiPada: "2026-09-12", hariIni })).toBe(0);
    expect(nilaiTenggat({ kategori: "h3", tenggat: "2026-09-10", selesaiPada: "2026-09-10", hariIni })).toBe(2);
    expect(nilaiTenggat({ kategori: "h1", tenggat: "2026-09-10", selesaiPada: "2026-09-10", hariIni })).toBe(3);
  });

  it("selesai TEPAT pada hari tenggat masih terhitung tepat waktu", () => {
    expect(nilaiTenggat({ kategori: "h5", tenggat: "2026-09-10", selesaiPada: "2026-09-10T23:59:00Z", hariIni })).toBe(0);
    expect(nilaiTenggat({ kategori: "h3", tenggat: "2026-09-10", selesaiPada: "2026-09-10T23:59:00Z", hariIni })).toBe(2);
  });

  it("yang belum selesai dan belum lewat tenggat BELUM bernilai apa pun", () => {
    // Menghitungnya gagal berarti menghukum pekerjaan yang masih berjalan, dan
    // skor tim akan naik-turun sendiri sepanjang bulan tanpa ada yang berubah.
    expect(nilaiTenggat({ kategori: "h5", tenggat: "2026-09-25", selesaiPada: null, hariIni })).toBeNull();
    expect(nilaiTenggat({ kategori: "h5", tenggat: "2026-09-10", selesaiPada: null, hariIni })).toBe(-2);
  });
});

describe("penanda lewat tenggat", () => {
  it("yang belum selesai lewat begitu hari ini melewati tenggatnya", () => {
    expect(lewatTenggat({ tenggat: "2026-09-10", selesaiPada: null, hariIni: "2026-09-11" })).toBe(true);
    expect(lewatTenggat({ tenggat: "2026-09-10", selesaiPada: null, hariIni: "2026-09-10" })).toBe(false);
  });

  it("empat pilihan, bobot gagal dan selesai sesuai ketetapan", () => {
    expect(TENGGAT.map((t) => [t.label, t.gagal, t.selesai])).toEqual([
      ["Sebelum H-5", -3, 0],
      ["H-5", -2, 0],
      ["H-3", 0, 2],
      ["H-1", 0, 3],
    ]);
  });
});
