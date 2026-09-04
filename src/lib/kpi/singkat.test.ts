import { describe, expect, it } from "vitest";
import { singkatUnik } from "@/components/kpi/kpi-charts";
import { INDIKATOR } from "./indikator";

/**
 * Label sumbu X grafik KPI.
 *
 * Tiga huruf dari kata pertama menghasilkan "KON, KON, KON" untuk Jumlah Konten
 * Post, Reels, dan Story — sumbu yang tiga batangnya bernama sama tidak bisa
 * dibaca sama sekali, dan orang yang membacanya akan menyimpulkan grafiknya
 * salah hitung.
 */
describe("singkatan sumbu X", () => {
  it("tidak pernah kembar dalam satu posisi", () => {
    for (const [posisi, daftar] of Object.entries(INDIKATOR)) {
      const kode = singkatUnik(daftar.map((i) => i.label));
      expect(new Set(kode).size, `${posisi}: ${kode.join(", ")}`).toBe(kode.length);
    }
  });

  it("melewati kata pembuka yang dipakai bersama-sama", () => {
    // "Jumlah" ada di tiga indikator sekaligus — memakainya sebagai singkatan
    // membuang satu-satunya bagian yang membedakan.
    const kode = singkatUnik(["Jumlah Konten Post", "Jumlah Konten Reels", "Jumlah Konten Story"]);
    expect(kode.every((k) => !k.startsWith("JUM"))).toBe(true);
    expect(new Set(kode).size).toBe(3);
  });

  it("label berisi beberapa kata disingkat jadi huruf awalnya", () => {
    // "Gross Sales" jadi GS dan "Harga Pokok Penjualan" jadi HPP. Tiga huruf
    // dari kata pertama menghasilkan "GRO" dan "HAR" — tidak ada yang mengenali
    // itu sebagai nama indikatornya.
    expect(singkatUnik(["Gross Sales", "Net Profit", "Harga Pokok Penjualan"])).toEqual(["GS", "NP", "HPP"]);
  });

  it("label satu kata tetap tiga huruf", () => {
    expect(singkatUnik(["Views", "Kecepatan", "Interaksi"])).toEqual(["VIE", "KEC", "INT"]);
  });

  it("label kosong tidak membuatnya berhenti", () => {
    expect(singkatUnik(["", "Views"]).length).toBe(2);
  });
});
