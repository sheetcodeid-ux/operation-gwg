import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDIKATOR } from "./indikator";

/**
 * Average Transaction Marketing Communication.
 *
 * Angkanya adalah AVERAGE NET SALES PER BILL di Sales Dashboard ESB — net sales
 * dibagi jumlah struk. Bukan AVERAGE NET SALES PER PAX: yang itu dibagi jumlah
 * tamu, dan satu struk sering dibayar untuk beberapa orang, jadi angkanya
 * selalu lebih kecil. Tertukar sedikit pun membuat capaian satu departemen
 * salah selama berbulan-bulan tanpa ada yang bisa menunjuk penyebabnya.
 */

const data = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
const seasonal = readFileSync(join(process.cwd(), "src/lib/data/seasonal.ts"), "utf8");

describe("sumber angkanya", () => {
  it("tidak lagi diketik tangan", () => {
    const i = INDIKATOR.marcomm.find((x) => x.key === "average_transaction");
    expect(i, "indikator Average Transaction hilang").toBeTruthy();
    expect(i!.actual).toEqual({ sumber: "otomatis", kode: "average_transaction" });
  });

  it("dihitung dari TOTAL struk sebulan, bukan rata-rata dari rata-rata harian", () => {
    // Merata-ratakan angka yang sudah rata-rata memberi bobot sama kepada hari
    // sepi dan hari ramai — hasilnya selalu meleset dari angka di ESB.
    const blok = data.slice(data.indexOf("async function averageTransaksi"));
    const badan = blok.slice(0, blok.indexOf("\n}\n"));
    expect(badan).toContain('.select("net,bills")');
    expect(badan).toContain("net / struk");
  });

  it("hari yang jumlah struknya belum ditarik dibuang, bukan dihitung nol", () => {
    // Ikut menghitung net sales hari itu tanpa struknya akan menaikkan
    // hasilnya tanpa batas — dan itu tidak akan pernah terlihat salah.
    expect(data).toContain('.not("bills", "is", null)');
  });

  it("bulan yang belum punya satu struk pun terbaca kosong, bukan nol", () => {
    const blok = data.slice(data.indexOf("async function averageTransaksi"));
    expect(blok.slice(0, blok.indexOf("\n}\n"))).toContain("if (struk === 0) return null;");
  });

  it("bulan yang datanya baru separuh tidak menampilkan angka", () => {
    // Penarikan ulang berjalan bertahap: pernah tercatat 19 dari 247 hari
    // terisi, dan 15 hari pertama Agustus belum ada. Rata-rata dari separuh
    // bulan tetap terlihat seperti angka yang sah — tidak ada yang
    // mencurigainya, dan tidak ada yang memeriksanya lagi setelah sisanya
    // masuk.
    expect(data).toContain("hariAda < k.averageTrx.hariHarus");
    expect(data).toContain("angkanya menunggu lengkap");
  });

  it("bulan lalu yang belum lengkap tidak dipakai sebagai dasar target", () => {
    // Target tumbuh 15% di atas angka separuh bulan akan terlihat wajar dan
    // salah selamanya.
    expect(data).toContain("a.hariAda >= a.hariHarus");
  });
});

describe("pengisian data hariannya", () => {
  it("jumlah tamu dan struk ikut disimpan tiap hari", () => {
    expect(seasonal).toContain("pax: sales.pax");
    expect(seasonal).toContain("bills: sales.bills");
  });

  it("hari lama yang belum punya jumlah struk ditarik ulang sendiri", () => {
    // Hari yang sudah lewat dianggap FINAL dan tidak pernah ditarik lagi.
    // Tanpa penanda ini, seluruh bulan sebelum kolomnya ada akan selamanya
    // kosong — tanpa satu pun tanda bahwa datanya memang tidak pernah ada.
    expect(seasonal).toContain("perluStruk");
    expect(seasonal).toContain("r.bills === null");
  });
});

describe("angka per outlet tidak pernah dihitung dari bulan yang separuh", () => {
  it("angka bulanan per outlet diambil UTUH dari ESB, bukan dijumlahkan dari harian", () => {
    // Penjumlahan harian pernah menghasilkan net sales kurang separuh: 56
    // cabang punya data Agustus, tapi rata-rata baru 14 dari 31 hari. Dari
    // angka itulah fee 5% dan budget efisiensi dihitung — keduanya terlihat
    // wajar dan keduanya salah. Sekarang barisnya ada berarti bulannya utuh.
    expect(data).toContain("async function netSalesLengkap");
    expect(data).toContain("await netBulananPerCabang(periode)");
    expect(data).toContain("bulan.map(netSalesLengkap)");
    expect(data).toContain("perluFee ? netSalesLengkap(periode)");
    // Dan tidak boleh diam-diam kembali menjumlahkan harian per cabang.
    expect(data).not.toContain('.select("branch,net")');
  });

  it("kosongnya menyebut sebabnya, bukan satu kalimat untuk dua hal berbeda", () => {
    // "Belum tersambung ke ESB" menyesatkan setelah seluruh outlet dipasangkan:
    // yang kurang penarikan angkanya, bukan pemasangannya.
    expect(data).toContain("outlet belum dipasangkan ke cabang ESB");
    expect(data).toContain("angka ESB bulan ini belum ditarik");
  });
});
