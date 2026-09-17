import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEBAN_BARU, EXPENSE_COLS, RINCI_UTILITAS, expenseTotal, type ExpenseRow } from "./categories";
import { sudahDirinci, utilitasBaris } from "./utilitas";

/**
 * UTILITAS PUNYA DUA KOLOM YANG SAMA-SAMA BISA TERISI, dan itu keadaan yang
 * paling mudah menghasilkan angka salah yang terlihat benar.
 *
 * Dijumlahkan dua-duanya → biaya listrik dihitung dua kali, beban membengkak
 * beberapa persen, dan tidak ada layar yang menunjukkannya salah.
 *
 * Dikosongkan dua-duanya lalu ditulis nol → Rp 1,39 miliar biaya utilitas
 * hilang dari laba rugi, juga tanpa satu pun pesan.
 *
 * Dua kesalahan itu yang dijaga di sini.
 */

const rinci = (l: number | null, a: number | null, i: number | null, k: number | null) => ({
  listrik: l,
  air: a,
  internet: i,
  kebersihan: k,
});

describe("rincian yang menentukan, bukan angka gabungan", () => {
  it("empat rincian terisi: utilitas = jumlahnya", () => {
    const h = utilitasBaris({ rincian: rinci(100, 50, 30, 20) });
    expect(h.utilitas).toBe(200);
    expect(h.asal).toBe("rincian");
  });

  it("kolom Utilitas yang diketik DIABAIKAN begitu ada rincian", () => {
    // Kalau tidak, angka ketikan yang basi menang atas rincian yang benar —
    // dan tidak ada cara tahu mana yang dipakai.
    const h = utilitasBaris({ rincian: rinci(100, 50, 30, 20), agregat: 999_999 });
    expect(h.utilitas).toBe(200);
    expect(h.asal).toBe("rincian");
  });

  it("sebagian rincian terisi tetap dipakai — yang kosong tidak dianggap nol pada kolomnya", () => {
    const h = utilitasBaris({ rincian: rinci(100, null, null, 20) });
    expect(h.utilitas).toBe(120);
    expect(h.rincian.air).toBeNull();
    expect(h.rincian.internet).toBeNull();
  });

  it("NOL pada rincian berarti sudah dirinci, bukan kosong", () => {
    // Outlet yang benar-benar menulis 0 untuk listrik sudah menyatakan sesuatu.
    const h = utilitasBaris({ rincian: rinci(0, 0, 0, 0), agregat: 500 });
    expect(h.utilitas).toBe(0);
    expect(h.asal).toBe("rincian");
  });
});

describe("berkas lama tetap bisa diunggah", () => {
  it("tanpa rincian, angka gabungan yang dipakai", () => {
    const h = utilitasBaris({ rincian: rinci(null, null, null, null), agregat: 750 });
    expect(h.utilitas).toBe(750);
    expect(h.asal).toBe("agregat");
    for (const k of RINCI_UTILITAS) expect(h.rincian[k]).toBeNull();
  });

  it("agregat nol yang memang diketik tetap nol", () => {
    const h = utilitasBaris({ rincian: rinci(null, null, null, null), agregat: 0, tersimpan: 900 });
    expect(h.utilitas).toBe(0);
    expect(h.asal).toBe("agregat");
  });
});

describe("tidak ada satu pun yang menyebut utilitas", () => {
  it("angka yang SUDAH tersimpan dipertahankan — bukan dinolkan", () => {
    // Berkas yang kolom utilitasnya tidak ikut terbawa tidak boleh menghapus
    // angka yang sudah benar. Masalah yang sama sudah ditangani untuk
    // `pendapatan` di `unggah-data.ts`.
    const h = utilitasBaris({ rincian: rinci(null, null, null, null), agregat: null, tersimpan: 1_234_567 });
    expect(h.utilitas).toBe(1_234_567);
    expect(h.asal).toBe("dipertahankan");
  });

  it("tanpa apa pun sama sekali, hasilnya nol — dan asalnya disebut", () => {
    const h = utilitasBaris({ rincian: rinci(null, null, null, null) });
    expect(h.utilitas).toBe(0);
    expect(h.asal).toBe("dipertahankan");
  });
});

describe("penanda sudah dirinci", () => {
  it("satu rincian saja sudah cukup", () => {
    expect(sudahDirinci(rinci(1, null, null, null))).toBe(true);
    expect(sudahDirinci(rinci(0, null, null, null))).toBe(true);
    expect(sudahDirinci(rinci(null, null, null, null))).toBe(false);
    expect(sudahDirinci({})).toBe(false);
  });
});

/* ─────────────────── penjaga hitung ganda ─────────────────── */

const baris = (isi: Partial<Record<string, number | null>> = {}): ExpenseRow => {
  const r = { outletCode: "K1", outletName: "Outlet" } as ExpenseRow;
  for (const c of EXPENSE_COLS) r[c] = 0;
  for (const [k, v] of Object.entries(isi)) (r as Record<string, unknown>)[k] = v;
  return r;
};

describe("total beban TIDAK menghitung utilitas dua kali", () => {
  it("empat rincian tidak ikut dijumlah — mereka sudah ada di dalam utilitas", () => {
    const r = baris({ utilitas: 200, listrik: 100, air: 50, internet: 30, kebersihan: 20 });
    // 200, bukan 400.
    expect(expenseTotal(r)).toBe(200);
  });

  it("kalau suatu hari keempatnya ikut ditambahkan, uji ini yang gagal lebih dulu", () => {
    const sumber = readFileSync(join(process.cwd(), "src/lib/ops/categories.ts"), "utf8");
    const kode = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const badan = kode.slice(kode.indexOf("export const expenseTotal"));
    expect(badan).not.toContain("RINCI_UTILITAS");
  });
});

describe("platform fee dan PBJT IKUT ke total beban", () => {
  it("keduanya menambah beban", () => {
    expect(expenseTotal(baris({ platform_fee: 70, pbjt: 30 }))).toBe(100);
  });

  it("PBJT masuk beban operasional — keputusan pemiliknya", () => {
    // Pendapatan − HPP − Beban(termasuk PBJT) = Laba.
    const tanpa = expenseTotal(baris({ sewa: 1_000 }));
    const dengan = expenseTotal(baris({ sewa: 1_000, pbjt: 250 }));
    expect(dengan - tanpa).toBe(250);
  });

  it("kosong tidak menggagalkan penjumlahan", () => {
    const r = baris({ sewa: 500 });
    for (const c of BEBAN_BARU) r[c] = null;
    expect(expenseTotal(r)).toBe(500);
  });
});

describe("delapan kolom lama tetap apa adanya", () => {
  it("jumlahnya tidak berubah untuk baris yang tidak punya kolom baru", () => {
    // Regresi: 174 baris historis tidak punya satu pun kolom baru. Totalnya
    // harus sama persis dengan sebelum Phase 2B.
    const r = baris({ utilitas: 10, sewa: 20, tenaga_kerja: 30, potongan: 40, manajemen_fee: 50, pemasaran: 60, ongkos_kirim: 70, lainnya: 80 });
    expect(expenseTotal(r)).toBe(360);
  });
});
