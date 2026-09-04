import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bacaHighlight } from "./esb";

/**
 * Pembacaan kotak-kotak Sales Dashboard ESB.
 *
 * Nama fieldnya pernah DITEBAK — daftar tebakan untuk gross sales berisi tujuh
 * nama dan tidak satu pun benar, jadi gross diam-diam jatuh ke net selama
 * berbulan-bulan tanpa satu pun pesan salah. Respons di bawah adalah balasan
 * SUNGGUHAN dari `get-today-highlight`, disalin apa adanya; kalau ESB suatu
 * saat mengganti nama fieldnya, berkas ini yang gagal lebih dulu — bukan
 * angka KPI orang.
 */
const ASLI = JSON.parse(
  '{"currentSales":"148.530.679","currentDailyGrossSales":"161.776.400","pendingSales":"532.267",' +
    '"removeMenuBeforeSave":"2.785.433","nonSales":"46.364","nonSalesDetail":[{"paymentMethod":"COMPLIMENT",' +
    '"amount":46363.636,"percentage":100}],"cancelledSales":"0","cancelledSalesDetail":[],"lastSalesDate":null,' +
    '"paxTotal":"2.941","averageNetSalesPerPax":"50.504","numberOfBill":"2.777","averageNetSalesPerBill":"53.487"}',
) as Record<string, unknown>;

describe("respons sungguhan dari Sales Dashboard", () => {
  it("setiap kotak terbaca sebagai angka, bukan NaN", () => {
    // Semuanya datang sebagai teks berformat Indonesia ("148.530.679").
    // `Number()` atas teks itu menghasilkan NaN, dan NaN yang lolos tampil
    // sebagai capaian kosong tanpa ada yang tahu kenapa.
    const h = bacaHighlight(ASLI);
    expect(h.net).toBe(148_530_679);
    expect(h.gross).toBe(161_776_400);
    expect(h.pax).toBe(2_941);
    expect(h.bills).toBe(2_777);
    expect(h.perBill).toBe(53_487);
    expect(h.perPax).toBe(50_504);
  });

  it("gross ESB dibaca apa adanya, tidak dijatuhkan ke net", () => {
    // Dulu gross dibaca dari daftar nama field tebakan yang tidak satu pun
    // benar, lalu diam-diam jatuh ke net. Keduanya angka yang berbeda, dan
    // pembacaannya tidak boleh menyamakannya sendiri.
    //
    // Catatan istilah: "gross sales" DI APLIKASI INI adalah net sales ESB —
    // itu yang dipakai GWG sehari-hari. Penerjemahan itu dilakukan di
    // `esbFetchSales`, bukan di sini; yang di sini membaca ESB apa adanya.
    const h = bacaHighlight(ASLI);
    expect(h.net).toBe(148_530_679);
    expect(h.gross).toBe(161_776_400);
  });

  it("average transaction = net sales dibagi jumlah struk", () => {
    // Selisih satu rupiah dari angka ESB memang ada dan memang dibiarkan: net
    // sales yang dikirim sudah dibulatkan ke rupiah, sedangkan ESB
    // membaginya dari angka aslinya yang masih berdesimal. Karena itu angka
    // rata-rata dari ESB dipakai apa adanya bila ada, dan hitungan sendiri
    // hanya menjadi cadangan.
    const h = bacaHighlight(ASLI);
    expect(Math.abs(h.net / h.bills - h.perBill)).toBeLessThan(2);
  });
});

describe("rentang tanpa aktivitas", () => {
  it("cabang yang tutup terbaca nol, bukan gagal", () => {
    // Cabang tanpa transaksi datang TANPA fieldnya sama sekali. Melemparkan
    // galat di sini akan menghentikan sinkronisasi satu hari penuh untuk
    // seluruh cabang lain.
    const h = bacaHighlight({});
    expect(h).toEqual({ net: 0, gross: 0, pax: 0, bills: 0, perBill: 0, perPax: 0 });
  });

  it("jumlah struk nol tidak menghasilkan pembagian dengan nol", () => {
    const h = bacaHighlight({ currentSales: "1.000.000" });
    expect(h.perBill).toBe(0);
    expect(Number.isFinite(h.perBill)).toBe(true);
  });

  it("gross yang tidak dikirim terbaca nol, tidak dikarang dari net", () => {
    expect(bacaHighlight({ currentSales: "1.000.000" }).gross).toBe(0);
  });
});

describe("istilah aplikasi vs istilah ESB", () => {
  it("yang disimpan sebagai gross adalah NET SALES ESB", () => {
    // Diluruskan langsung oleh pemiliknya: "gross sales dalam bahasa web ini
    // adalah net sales di ESB". Seluruh angka omset di aplikasi — grafik
    // Musiman, Data Analysis, ROI event Marcomm — memakai angka itu. Kalau
    // penerjemahan ini hilang, semua angka omset berubah tanpa ada yang
    // mengubah datanya.
    const klien = readFileSync(join(process.cwd(), "src/lib/integrations/esb-client.ts"), "utf8");
    const blok = klien.slice(klien.indexOf("export async function esbFetchSales"));
    expect(blok.slice(0, blok.indexOf("\n}"))).toContain("gross: h.net");
  });
});
