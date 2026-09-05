import { describe, expect, it } from "vitest";
import { bacaLembar } from "./lembar-outlet";

/**
 * Membaca kembali lembar Excel yang sudah diisi.
 *
 * Yang dijaga di sini cuma satu hal, tapi hal itu benar-benar terjadi: Excel
 * di Indonesia menulis ribuan dengan TITIK. "1.234.567" dibaca `Number()`
 * sebagai NaN, barisnya lolos tanpa tersimpan, dan yang mengisinya baru sadar
 * setelah membuka formnya lagi dan angkanya kosong.
 */

/** Sel apa adanya → angka, lewat jalur yang sama dengan pembacaan berkasnya. */
async function baca(nilai: unknown): Promise<number | null> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    ["ID Outlet", "Nama Outlet", "Net Profit (Rp)", "Harga Pokok Penjualan (Rp)"],
    ["out_1", "Contoh", nilai as string, ""],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Angka Outlet");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const file = new File([buf], "uji.xlsx");
  const hasil = await bacaLembar(file, new Set(["out_1"]));
  return hasil.baris[0]?.netProfit ?? null;
}

describe("angka dari sel Excel", () => {
  it("sel bertipe angka terbaca apa adanya", async () => {
    expect(await baca(118500000)).toBe(118_500_000);
  });

  it("ribuan bertitik ala Indonesia terbaca, bukan jadi kosong", async () => {
    expect(await baca("1.234.567")).toBe(1_234_567);
    expect(await baca("118.500.000")).toBe(118_500_000);
  });

  it("ribuan berkoma ala Inggris juga terbaca", async () => {
    expect(await baca("1,234,567")).toBe(1_234_567);
  });

  it("desimal berkoma dibaca sebagai desimal, bukan ribuan", async () => {
    expect(await baca("37,5")).toBe(37.5);
  });

  it("awalan Rp dan spasi tidak mengganggu", async () => {
    expect(await baca("Rp 118.500.000")).toBe(118_500_000);
  });

  it("sel kosong tetap kosong, bukan nol", async () => {
    // Nol berarti "harga pokoknya nol rupiah" — tuduhan yang berbeda jauh dari
    // "belum diisi".
    expect(await baca("")).toBeNull();
  });
});

describe("baris yang tidak dikenal", () => {
  it("disebut, tidak dibuang diam-diam", async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["ID Outlet", "Nama Outlet", "Net Profit (Rp)", "Harga Pokok Penjualan (Rp)"],
      ["out_asing", "Outlet Area Lain", 5_000_000, ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Angka Outlet");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const hasil = await bacaLembar(new File([buf], "uji.xlsx"), new Set(["out_1"]));
    expect(hasil.baris).toHaveLength(0);
    expect(hasil.asing).toEqual(["Outlet Area Lain"]);
  });
});
