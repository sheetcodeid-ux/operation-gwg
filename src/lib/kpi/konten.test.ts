import { describe, expect, it } from "vitest";
import { brandOutlet, brandPemohon, hitungKonten, jenisKonten, type PermintaanKonten } from "./konten";

/**
 * Pembacaan Antrian Design menjadi angka Jumlah Konten.
 *
 * Kolom jenis design diketik bebas, dan itu bukan kelalaian yang bisa
 * dibereskan belakangan — 192 permintaan yang sudah ada memang tertulis dengan
 * puluhan variasi. Yang dijaga di sini: pembacaannya cukup longgar untuk
 * menangkap variasi itu, tapi tidak sampai menghitung yang bukan konten.
 */

describe("membaca jenis konten dari teks bebas", () => {
  it("bentuk bakunya terbaca", () => {
    expect(jenisKonten("Instagram Post")).toEqual(["post"]);
    expect(jenisKonten("Instagram Story")).toEqual(["story"]);
    expect(jenisKonten("Instagram Reels")).toEqual(["reels"]);
  });

  it("singkatan dan huruf besar-kecil yang dipakai sehari-hari ikut terbaca", () => {
    // Semua ini benar-benar ada di data: "igs", "FEED DAN IGS", "Feeds & IGS".
    expect(jenisKonten("igs")).toEqual(["story"]);
    expect(jenisKonten("FEED DAN IGS").sort()).toEqual(["post", "story"]);
    expect(jenisKonten("Feeds & IGS").sort()).toEqual(["post", "story"]);
  });

  it("satu permintaan berisi dua jenis dihitung dua-duanya", () => {
    // "Instagram Post dan Story" memang menghasilkan dua materi; menghitungnya
    // satu berarti separuh pekerjaannya hilang.
    expect(jenisKonten("Instagram Post dan Story").sort()).toEqual(["post", "story"]);
  });

  it("yang bukan konten media sosial tidak ikut terhitung", () => {
    // Ini yang paling berbahaya: kalau spanduk ikut terhitung sebagai konten
    // Instagram, capaiannya naik tanpa ada satu unggahan pun.
    expect(jenisKonten("Banner / Spanduk")).toEqual([]);
    expect(jenisKonten("Menu / Daftar Harga")).toEqual([]);
    expect(jenisKonten("Name Tag Pastry")).toEqual([]);
    expect(jenisKonten("")).toEqual([]);
  });
});

describe("brand ditentukan dari cabang pemohon", () => {
  it("empat brand dikenali dari nama cabangnya", () => {
    expect(brandOutlet("Nordu Coffee Siantan")).toBe("Nordu");
    expect(brandOutlet("Cattu A. Yani")).toBe("Cattu");
    expect(brandOutlet("Ayam Goreng Busari Serdam")).toBe("Busari");
    expect(brandOutlet("Lesung Pipi Bogor")).toBe("Lesung Pipi");
  });

  it("permintaan tanpa cabang tidak dipaksa masuk brand mana pun", () => {
    // Permintaan kantor memang tidak mewakili brand; menebaknya akan menambah
    // angka ke brand yang tidak pernah memintanya.
    expect(brandOutlet(null)).toBeNull();
    expect(brandOutlet("")).toBeNull();
    expect(brandOutlet("HEAD OFFICE")).toBeNull();
  });
});

describe("hanya permintaan SELESAI yang dihitung", () => {
  const baris: PermintaanKonten[] = [
    { designType: "Instagram Post", outletNama: "Nordu Coffee Siantan", status: "terlaksana", periode: "2026-09" },
    { designType: "Instagram Post", outletNama: "Nordu Coffee Siantan", status: "disetujui_hc", periode: "2026-09" },
    { designType: "Instagram Story", outletNama: "Cattu A. Yani", status: "terlaksana", periode: "2026-09" },
    { designType: "Instagram Post dan Story", outletNama: "Lesung Pipi Bogor", status: "terlaksana", periode: "2026-09" },
    { designType: "Instagram Post", outletNama: "Nordu Coffee Siantan", status: "terlaksana", periode: "2026-08" },
  ];

  it("yang masih dikerjakan belum menghasilkan konten", () => {
    const h = hitungKonten(baris, "2026-09");
    expect(h.post.Nordu).toBe(1);
  });

  it("bulan lain tidak ikut terbawa", () => {
    expect(hitungKonten(baris, "2026-09").post.Nordu).toBe(1);
    expect(hitungKonten(baris, "2026-08").post.Nordu).toBe(1);
  });

  it("masuk ke brand cabang yang meminta", () => {
    const h = hitungKonten(baris, "2026-09");
    expect(h.story.Cattu).toBe(1);
    expect(h.post["Lesung Pipi"]).toBe(1);
    expect(h.story["Lesung Pipi"]).toBe(1);
    expect(h.post.Busari).toBe(0);
  });

  it("seluruh brand selalu ada barisnya, walau nol", () => {
    // Brand yang hilang dari hasil akan terbaca sebagai "belum diisi" di layar,
    // padahal jawabannya memang nol.
    const h = hitungKonten([], "2026-09");
    expect(Object.keys(h.post).sort()).toEqual(["Busari", "Cattu", "Lesung Pipi", "Nordu"]);
  });
});


describe("brand diambil dari cabang PEMOHON saat permintaannya tanpa cabang", () => {
  it("permintaan tanpa cabang tetap terhitung lewat cabang pemohonnya", () => {
    // Ini bukan kemungkinan teoretis: kolom outlet pada permintaan design
    // KOSONG di seluruh 224 permintaan yang ada — formulirnya memang tidak
    // menanyakannya. Tanpa cadangan ini setiap baris dibuang sebelum sempat
    // dihitung, dan Jumlah Konten selalu nol padahal antriannya penuh.
    const h = hitungKonten(
      [
        {
          designType: "Instagram Post",
          outletNama: null,
          outletPemohon: ["Nordu Coffee Banjarbaru"],
          status: "terlaksana",
          periode: "2026-09",
        },
      ],
      "2026-09",
    );
    expect(h.post.Nordu).toBe(1);
  });

  it("cabang pada permintaannya menang atas cabang pemohonnya", () => {
    // Permintaan yang menyebut cabangnya sendiri lebih tahu tujuannya daripada
    // tempat orang yang mengetikkannya.
    const h = hitungKonten(
      [
        {
          designType: "Instagram Post",
          outletNama: "Cattu A. Yani",
          outletPemohon: ["Nordu Coffee Banjarbaru"],
          status: "terlaksana",
          periode: "2026-09",
        },
      ],
      "2026-09",
    );
    expect(h.post.Cattu).toBe(1);
    expect(h.post.Nordu).toBe(0);
  });

  it("pemohon yang memegang beberapa brand tidak ditebak salah satunya", () => {
    // Menebak berarti menambah angka ke brand yang tidak pernah memintanya —
    // dan itu tidak akan pernah terlihat salah.
    expect(brandPemohon(["Nordu Coffee Sambas", "Cattu A. Yani"])).toBeNull();
    expect(brandPemohon(["Nordu Coffee Sambas", "Nordu Coffee Sampit"])).toBe("Nordu");
    expect(brandPemohon([])).toBeNull();
    expect(brandPemohon([null, undefined])).toBeNull();
  });
});
