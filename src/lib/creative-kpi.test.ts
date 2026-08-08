import { describe, expect, it } from "vitest";

import {
  CREATIVE_KPI_INDICATORS,
  DEFAULT_CREATIVE_WEIGHTS,
  classifyContent,
  EMPTY_METRICS,
  creativeAktual,
  creativeCapaian,
  creativeKpiCategory,
  creativePeriod,
  creativeTotalScore,
  engagementOf,
  growthTarget,
  inPeriod,
  mergeCreativeSettings,
  metricValue,
  previousPeriod,
  type CreativeKpiRow,
} from "./creative-kpi";
import { DESIGN_TYPES } from "./hc-request";

/**
 * KPI ini dipakai menilai orang tiap bulan, jadi yang diuji di sini bukan
 * "apakah fungsinya jalan" tapi kasus-kasus yang diam-diam menghasilkan angka
 * SALAH TAPI MASUK AKAL — itu yang tidak akan ketahuan sampai ada yang protes
 * nilainya.
 */

const row = (over: Partial<CreativeKpiRow> = {}): CreativeKpiRow => ({
  indicator: CREATIVE_KPI_INDICATORS[0],
  weight: 10,
  target: 20,
  realisasi: 20,
  capaian: 100,
  aktual: 10,
  scored: true,
  ...over,
});

describe("capaian satu indikator", () => {
  it("realisasi setengah target = 50%", () => {
    expect(creativeCapaian(20, 10)).toBe(50);
  });

  it("kelebihan capaian TIDAK menambah nilai", () => {
    // MIN(actual/target, 1) — 40 dari target 20 tetap 100, bukan 200.
    expect(creativeCapaian(20, 40)).toBe(100);
  });

  it("realisasi nol = 0%", () => {
    expect(creativeCapaian(20, 0)).toBe(0);
  });

  it("target nol dengan realisasi nyata = tercapai penuh, BUKAN nol", () => {
    // Ini beda yang disengaja dari rumus spreadsheet. Bulan lalu 0 interaksi
    // membuat target 0; memberi nilai 0 kepada tim yang naik ke 5.000 interaksi
    // adalah menghukum justru saat mereka berhasil.
    expect(creativeCapaian(0, 5000)).toBe(100);
  });

  it("target nol dan realisasi nol tetap 0%", () => {
    expect(creativeCapaian(0, 0)).toBe(0);
  });

  it("tidak pernah mengembalikan Infinity atau NaN", () => {
    for (const [t, r] of [[0, 0], [0, 1], [1, 0], [-5, 10], [20, -3]]) {
      const v = creativeCapaian(t, r);
      expect(Number.isFinite(v), `target=${t} realisasi=${r}`).toBe(true);
    }
  });
});

describe("target bergerak bulan lalu + 10%", () => {
  it("menaikkan capaian bulan lalu sepersepuluh", () => {
    expect(growthTarget(1000)).toBe(1100);
    expect(growthTarget(163)).toBe(179); // 179,3 dibulatkan
  });

  it("baseline nol tetap nol — bukan angka karangan", () => {
    expect(growthTarget(0)).toBe(0);
  });
});

describe("skor akhir dinormalkan", () => {
  it("bobot bawaan berjumlah 90, bukan 100", () => {
    // Bukan salah ketik: ini memang bobot yang diminta. Normalisasilah yang
    // membuat nilai 100 tetap bisa dicapai.
    const total = Object.values(DEFAULT_CREATIVE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(90);
  });

  it("semua indikator tercapai penuh = 100, walau bobotnya berjumlah 90", () => {
    const rows = CREATIVE_KPI_INDICATORS.map((indicator) => {
      const weight = DEFAULT_CREATIVE_WEIGHTS[indicator.key];
      return row({ indicator, weight, capaian: 100, aktual: creativeAktual(weight, 100) });
    });
    expect(creativeTotalScore(rows)).toBe(100);
  });

  it("indikator tanpa baseline tidak menekan skor", () => {
    // Bulan pertama: empat indikator Instagram belum punya target. Kalau ikut
    // dihitung sebagai nol, tim yang bekerja sempurna dapat nilai 44 — dan
    // angka itu akan dipakai orang untuk mengambil keputusan.
    const rows = CREATIVE_KPI_INDICATORS.map((indicator) => {
      const weight = DEFAULT_CREATIVE_WEIGHTS[indicator.key];
      const scored = indicator.source === "design";
      return row({
        indicator,
        weight,
        scored,
        capaian: scored ? 100 : 0,
        aktual: scored ? creativeAktual(weight, 100) : 0,
      });
    });
    expect(creativeTotalScore(rows)).toBe(100);
  });

  it("setengah tercapai = 50", () => {
    const rows = CREATIVE_KPI_INDICATORS.map((indicator) => {
      const weight = DEFAULT_CREATIVE_WEIGHTS[indicator.key];
      return row({ indicator, weight, capaian: 50, aktual: creativeAktual(weight, 50) });
    });
    expect(creativeTotalScore(rows)).toBe(50);
  });

  it("tidak ada satu pun indikator yang bisa dinilai = 0, bukan pembagian nol", () => {
    const rows = CREATIVE_KPI_INDICATORS.map((indicator) => row({ indicator, scored: false, aktual: 0 }));
    const score = creativeTotalScore(rows);
    expect(score).toBe(0);
    expect(Number.isFinite(score)).toBe(true);
  });
});

describe("gabungan angka Instagram", () => {
  it("engagement = like + komentar + share + save", () => {
    expect(engagementOf({ ...EMPTY_METRICS, likes: 100, comments: 20, shares: 8, saves: 35 })).toBe(163);
  });

  it("tiap indikator Instagram mengambil angkanya sendiri", () => {
    const m = { ...EMPTY_METRICS, likes: 10, followerGrowth: 200, views: 9000, profileVisits: 480 };
    expect(metricValue("engagement", m)).toBe(10);
    expect(metricValue("follower_growth", m)).toBe(200);
    expect(metricValue("views", m)).toBe(9000);
    expect(metricValue("profile_visit", m)).toBe(480);
  });
});

describe("pengenalan jenis konten dari teks bebas", () => {
  it("mengenali pilihan resmi dari DESIGN_TYPES", () => {
    expect(classifyContent("Instagram Post")).toBe("konten_post");
    expect(classifyContent("Instagram Reels")).toBe("konten_reels");
    expect(classifyContent("Instagram Story")).toBe("konten_story");
  });

  it("mengenali tulisan bebas dari opsi Lainnya", () => {
    // Form Pengajuan Design punya pilihan "Lainnya" dengan isian bebas, dan
    // datanya memang sudah berisi tulisan tangan. Pencocokan persis akan
    // melewatkan ini — dan KPI seseorang turun tanpa sebab yang kelihatan.
    expect(classifyContent("IG Story")).toBe("konten_story");
    expect(classifyContent("story instagram")).toBe("konten_story");
    expect(classifyContent("Instagram Stories")).toBe("konten_story");
    expect(classifyContent("ig reels")).toBe("konten_reels");
    expect(classifyContent("Reel")).toBe("konten_reels");
    expect(classifyContent("feed IG")).toBe("konten_post");
    expect(classifyContent("POST")).toBe("konten_post");
  });

  it("TIDAK tertipu kata yang kebetulan memuat 'post'", () => {
    // "Poster" memuat huruf p-o-s-t. Pencocokan per potongan huruf akan
    // menghitung setiap poster cetak sebagai konten Instagram.
    expect(classifyContent("Poster / Print Out")).toBeNull();
    expect(classifyContent("poster A3")).toBeNull();
  });

  it("mengabaikan jenis design yang bukan konten sosmed", () => {
    // Nilai-nilai ini nyata ada di basis data.
    expect(classifyContent("Menu / Daftar Harga")).toBeNull();
    expect(classifyContent("Flayer A4")).toBeNull();
    expect(classifyContent("Card seperti beans sebelumnya")).toBeNull();
    expect(classifyContent("2 Sticker untuk pendingin showcase logo cattu")).toBeNull();
    expect(classifyContent("Banner / Spanduk")).toBeNull();
    expect(classifyContent("Logo & Branding")).toBeNull();
    expect(classifyContent("Gojek / Website")).toBeNull();
  });

  it("aman terhadap nilai kosong", () => {
    expect(classifyContent(null)).toBeNull();
    expect(classifyContent(undefined)).toBeNull();
    expect(classifyContent("")).toBeNull();
    expect(classifyContent("   ")).toBeNull();
  });

  it("Reels menang atas Post kalau keduanya disebut", () => {
    expect(classifyContent("Reels untuk feed")).toBe("konten_reels");
  });

  it("tiap jenis resmi terpetakan ke indikator yang ada", () => {
    for (const t of ["Instagram Post", "Instagram Reels", "Instagram Story"]) {
      const kind = classifyContent(t);
      expect(CREATIVE_KPI_INDICATORS.some((i) => i.key === kind), `${t}`).toBe(true);
    }
  });
});

describe("periode", () => {
  it("bulan disusun dari indeks nol", () => {
    expect(creativePeriod(2026, 0)).toBe("2026-01");
    expect(creativePeriod(2026, 11)).toBe("2026-12");
  });

  it("mundur satu bulan menyeberangi pergantian tahun", () => {
    expect(previousPeriod("2026-08")).toBe("2026-07");
    expect(previousPeriod("2026-01")).toBe("2025-12");
  });

  it("mencocokkan tanggal ISO ke periodenya", () => {
    expect(inPeriod("2026-08-14T09:00:00.000Z", "2026-08")).toBe(true);
    expect(inPeriod("2026-07-31T23:00:00.000Z", "2026-08")).toBe(false);
    expect(inPeriod(null, "2026-08")).toBe(false);
    expect(inPeriod("", "2026-08")).toBe(false);
  });
});

describe("pengaturan dari basis data", () => {
  it("kembali ke bawaan saat kosong", () => {
    expect(mergeCreativeSettings(null).weights).toEqual(DEFAULT_CREATIVE_WEIGHTS);
    expect(mergeCreativeSettings(undefined).teamIds).toEqual([]);
  });

  it("membuang kunci asing dan nilai tak masuk akal", () => {
    const s = mergeCreativeSettings({
      weights: { konten_post: 25, views: -4, tidak_dikenal: 99, engagement: "bukan angka" },
      teamIds: ["usr_1", "usr_1", "", "usr_2"],
    });
    expect(s.weights.konten_post).toBe(25);
    expect(s.weights.views).toBe(DEFAULT_CREATIVE_WEIGHTS.views); // negatif ditolak
    expect(s.weights.engagement).toBe(DEFAULT_CREATIVE_WEIGHTS.engagement); // bukan angka ditolak
    expect("tidak_dikenal" in s.weights).toBe(false);
    expect(s.teamIds).toEqual(["usr_1", "usr_2"]); // duplikat & kosong dibuang
  });
});

describe("kategori nilai", () => {
  it("ambangnya berurutan dan tidak bolong", () => {
    expect(creativeKpiCategory(100).label).toBe("SANGAT BAIK");
    expect(creativeKpiCategory(95).label).toBe("SANGAT BAIK");
    expect(creativeKpiCategory(94.99).label).toBe("BAIK");
    expect(creativeKpiCategory(80).label).toBe("BAIK");
    expect(creativeKpiCategory(79.99).label).toBe("CUKUP");
    expect(creativeKpiCategory(65).label).toBe("CUKUP");
    expect(creativeKpiCategory(64.99).label).toBe("PERLU PERBAIKAN");
    expect(creativeKpiCategory(0).label).toBe("PERLU PERBAIKAN");
  });
});

describe("susunan indikator", () => {
  it("delapan indikator, nomornya urut, kuncinya unik", () => {
    expect(CREATIVE_KPI_INDICATORS).toHaveLength(8);
    expect(CREATIVE_KPI_INDICATORS.map((i) => i.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(CREATIVE_KPI_INDICATORS.map((i) => i.key)).size).toBe(8);
  });

  it("tiap indikator punya bobot bawaan", () => {
    for (const i of CREATIVE_KPI_INDICATORS) {
      expect(DEFAULT_CREATIVE_WEIGHTS[i.key], `${i.key} tanpa bobot`).toBeGreaterThan(0);
    }
  });

  it("jenis konten cocok PERSIS dengan DESIGN_TYPES", () => {
    // Dicocokkan ke sumber aslinya, bukan ke salinan tulisan tangan: satu huruf
    // beda membuat hitungannya diam-diam nol dan tidak ada yang sadar.
    const konten = CREATIVE_KPI_INDICATORS.filter((i) => i.key.startsWith("konten_"));
    expect(konten).toHaveLength(3);
    for (const i of konten) {
      expect(DESIGN_TYPES, `${i.key}: "${i.designType}" tidak ada di DESIGN_TYPES`).toContain(i.designType);
    }
    expect(konten.map((i) => i.designType)).toEqual(["Instagram Post", "Instagram Reels", "Instagram Story"]);
  });

  it("hanya indikator Instagram yang memakai target bergerak", () => {
    for (const i of CREATIVE_KPI_INDICATORS) {
      if (i.source === "instagram") expect(i.fixedTarget, `${i.key}`).toBeNull();
      else expect(i.fixedTarget, `${i.key}`).toBeGreaterThan(0);
    }
  });
});
