import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEMBAR_ANGKA_OUTLET, LEMBAR_EFISIENSI, bacaLembar } from "./lembar-outlet";

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
  const hasil = await bacaLembar(LEMBAR_ANGKA_OUTLET, file, new Set(["out_1"]));
  return hasil.baris[0]?.nilai[0] ?? null;
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
    const hasil = await bacaLembar(LEMBAR_ANGKA_OUTLET, new File([buf], "uji.xlsx"), new Set(["out_1"]));
    expect(hasil.baris).toHaveLength(0);
    expect(hasil.asing).toEqual(["Outlet Area Lain"]);
  });
});


/**
 * Lembar realisasi beban PDQ memakai PEMBACA YANG SAMA.
 *
 * Yang berbeda cuma judul kolomnya. Kalau modulnya disalin, pembaca angkanya
 * ikut tersalin — dan pembaca itulah bagian yang paling mahal kalau salah:
 * ia yang mengerti "1.234.567" ala Indonesia. Dua salinan berarti suatu hari
 * yang satu diperbaiki dan yang lain tidak.
 */
describe("lembar realisasi beban (PDQ)", () => {
  async function lembar(rows: (string | number)[][]) {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["ID Outlet", "Nama Outlet", "Average 3 Bulan (Rp)", "Budget (Rp)", "Actual Warehouse (Rp)", "Actual Non-Warehouse (Rp)"],
      ...rows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Realisasi Beban");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    return bacaLembar(LEMBAR_EFISIENSI, new File([buf], "uji.xlsx"), new Set(["out_1"]));
  }

  it("dua kolom isiannya terbaca, ribuan bertitik ikut benar", async () => {
    const h = await lembar([["out_1", "Contoh", 400_000_000, 140_000_000, "70.000.000", "3.500.000"]]);
    expect(h.baris[0].nilai).toEqual([70_000_000, 3_500_000]);
  });

  it("Average dan Budget TIDAK ikut terbaca — keduanya dihitung sistem", async () => {
    // Kalau kolom keterangan ikut dibaca balik, angka yang dihitung sistem
    // bisa ditimpa lewat berkas yang beredar di WhatsApp.
    const h = await lembar([["out_1", "Contoh", 999, 999, 70_000_000, 3_500_000]]);
    expect(h.baris[0].nilai).toEqual([70_000_000, 3_500_000]);
    expect(Object.keys(h.baris[0])).not.toContain("konteks");
  });

  it("baris yang dua-duanya kosong dilewati, bukan disimpan sebagai nol", async () => {
    const h = await lembar([["out_1", "Contoh", 400_000_000, 140_000_000, "", ""]]);
    expect(h.baris).toHaveLength(0);
  });

  it("outlet asing tetap disebut, sama seperti lembar Coordinator Area", async () => {
    const h = await lembar([["out_lain", "Outlet Lain", "", "", 1_000, ""]]);
    expect(h.asing).toEqual(["Outlet Lain"]);
  });
});

describe("kedua form memakai jalur yang sama", () => {
  const form = readFileSync(join(process.cwd(), "src/components/kpi/form-tabel.tsx"), "utf8");

  it("Efisiensi Beban punya unduh format dan unggah isian, sama seperti Coordinator Area", () => {
    // Diminta pemiliknya: "tambahkan juga download excel dan importnya seperti
    // punya CA". Yang dikunci di sini bukan tombolnya melainkan SKEMA-nya —
    // kalau suatu saat seseorang menyalin modul lembarnya alih-alih memakai
    // yang ada, uji ini tetap hijau padahal pembacanya sudah bercabang. Karena
    // itu keduanya diperiksa memanggil `bacaLembar` yang sama.
    expect(form).toContain("LEMBAR_EFISIENSI");
    expect(form).toContain("LEMBAR_ANGKA_OUTLET");
    expect(form.match(/bacaLembar\(/g) ?? []).toHaveLength(2);
    expect(form.match(/unduhLembar\(/g) ?? []).toHaveLength(2);
  });

  it("berkas yang sama bisa diunggah ulang setelah diperbaiki", () => {
    // Tanpa mengosongkan input-nya, unggahan kedua atas berkas yang sama tidak
    // memicu apa pun dan terlihat seperti aplikasi yang menggantung.
    expect(form.match(/e\.target\.value = "";/g) ?? []).toHaveLength(2);
  });
});
