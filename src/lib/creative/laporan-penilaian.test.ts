import { describe, expect, it } from "vitest";
import { BATAS_NASKAH, MAKS_NAMA_PER_AREA, judulLaporan, susunLaporan } from "./laporan-penilaian";
import { rekapArea, type BarisNilai } from "./penilaian-request";

/**
 * Naskah laporan yang mendarat di Pesan seorang Coordinator Area.
 *
 * Yang dikunci di sini bukan susunan kalimatnya, melainkan hal-hal yang membuat
 * laporannya bisa ditindaklanjuti: angkanya utuh tanpa membuka aplikasi, cara
 * hitungnya ikut terkirim, dan naskahnya tidak pernah melebihi satu pesan.
 */

const baris = (n: number, area: string, nama: string, skor: number, mendadak: boolean): BarisNilai[] =>
  Array.from({ length: n }, () => ({
    pemohonId: nama,
    pemohonNama: nama,
    areaId: area,
    areaNama: area,
    outletNama: null,
    periode: "2026-08",
    skor,
    hari: mendadak ? 0 : 10,
    waktu: mendadak ? ("mendadak" as const) : ("wajar" as const),
  }));

const isi = {
  periode: "2026-08",
  area: rekapArea([...baris(3, "Area Poetri", "Kayla", 20, true), ...baris(1, "Area Poetri", "Sari", 90, false)]),
  catatan: "",
  pengirim: "Dimas",
};

describe("laporan berdiri sendiri tanpa membuka aplikasi", () => {
  it("judulnya menyebut bulannya dalam bahasa Indonesia", () => {
    expect(judulLaporan("2026-08")).toContain("Agustus 2026");
    expect(judulLaporan("")).toContain("seluruh periode");
  });

  it("membawa angka per orang, bukan cuma total wilayah", () => {
    // Total wilayah tidak bisa ditindaklanjuti: CA perlu tahu SIAPA yang
    // permintaannya mendadak untuk bisa bicara dengan orangnya.
    const t = susunLaporan(isi);
    expect(t).toContain("Kayla");
    expect(t).toContain("75% mendadak");
    expect(t).toMatch(/Kayla — Merah/);
  });

  it("cara hitungnya ikut terkirim", () => {
    // Angka yang sampai tanpa penjelasan akan dijawab "dari mana angkanya?",
    // dan pertanyaan itu tidak bisa dijawab lewat notifikasi.
    const t = susunLaporan(isi);
    expect(t).toContain("60 poin");
    expect(t).toContain("40 poin");
    expect(t).toContain("Hijau ≥ 75");
  });

  it("catatan pengirim ikut, dan namanya jelas", () => {
    const t = susunLaporan({ ...isi, catatan: "Mohon minimal H-7." });
    expect(t).toContain("Catatan Dimas: Mohon minimal H-7.");
  });

  it("periode kosong tetap terbaca, bukan tanggal kosong", () => {
    expect(susunLaporan({ ...isi, periode: "" })).toContain("seluruh periode");
  });

  it("wilayah tanpa penilaian tidak dikarang jadi nol", () => {
    const t = susunLaporan({ ...isi, area: [] });
    expect(t).toContain("Belum ada permintaan design yang dinilai");
  });
});

describe("naskahnya selalu muat satu pesan", () => {
  it("dipotong di batas baris, bukan di tengah angka", () => {
    // Laporan yang terputus di tengah angka terbaca seperti data yang salah.
    const banyak = Array.from({ length: 60 }, (_, i) =>
      baris(2, `Area ${i}`, `Pemohon dengan nama yang cukup panjang ${i}`, 20, true),
    ).flat();
    const t = susunLaporan({ ...isi, area: rekapArea(banyak) });
    expect(t.length).toBeLessThanOrEqual(BATAS_NASKAH);
    expect(t).toContain("terlalu panjang untuk satu pesan");
  });

  it("satu wilayah dengan banyak orang diringkas, bukan dibuang diam-diam", () => {
    const ramai = Array.from({ length: MAKS_NAMA_PER_AREA + 5 }, (_, i) =>
      baris(1, "Area Poetri", `Orang ${i}`, 20, true),
    ).flat();
    const t = susunLaporan({ ...isi, area: rekapArea(ramai) });
    expect(t).toContain("dan 5 pemohon lain");
  });
});
