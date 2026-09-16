import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RUMUS_TARGET,
  RUMUS_TARGET_VERSI,
  TANGGAL_BATAS_BUKA,
  bulanMulaiBerjalan,
  hitungTargetSales,
  sudahTigaBulan,
  tigaBulanSebelum,
  type OutletTarget,
} from "./target-sales";

/**
 * TARGET adalah angka yang menentukan siapa dianggap berhasil.
 *
 * Yang diuji di sini bukan aritmetikanya — rata-rata tiga angka tidak pernah
 * salah. Yang diuji SIAPA YANG BOLEH DIBERI TARGET dan APA YANG TERJADI KALAU
 * DATANYA KURANG, karena dua hal itulah yang menghukum orang tanpa kelihatan
 * menghukum siapa pun.
 */

const outlet = (id: string, bukaTanggal: string | null = null): OutletTarget => ({ id, bukaTanggal });

const riwayat = (isi: Record<string, number | null>): Map<string, number | null> => new Map(Object.entries(isi));

describe("tiga bulan sebelumnya", () => {
  it("terbaru dulu, dan menembus pergantian tahun", () => {
    expect(tigaBulanSebelum("2026-08")).toEqual(["2026-07", "2026-06", "2026-05"]);
    expect(tigaBulanSebelum("2026-02")).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(tigaBulanSebelum("2026-01")).toEqual(["2025-12", "2025-11", "2025-10"]);
  });

  it("bulan berjalan TIDAK ikut", () => {
    // Kalau ikut, targetnya bergerak tiap hari dan tidak pernah bisa jadi
    // patokan bagi siapa pun.
    expect(tigaBulanSebelum("2026-08")).not.toContain("2026-08");
  });
});

describe("bulan mulai berjalan", () => {
  it("buka sebelum atau pada tanggal batas: bulan itu terhitung", () => {
    expect(bulanMulaiBerjalan("2026-05-01")).toBe("2026-05");
    expect(bulanMulaiBerjalan("2026-05-15")).toBe("2026-05");
  });

  it("buka setelah tanggal batas: hitungannya mulai bulan berikutnya", () => {
    expect(bulanMulaiBerjalan("2026-05-16")).toBe("2026-06");
    expect(bulanMulaiBerjalan("2026-05-31")).toBe("2026-06");
  });

  it("Desember akhir jatuh ke Januari tahun berikutnya", () => {
    expect(bulanMulaiBerjalan("2025-12-20")).toBe("2026-01");
    expect(bulanMulaiBerjalan("2025-12-15")).toBe("2025-12");
  });

  it("tanggal yang tidak ada berarti tidak diketahui, bukan hari ini", () => {
    expect(bulanMulaiBerjalan(null)).toBeNull();
    expect(bulanMulaiBerjalan("")).toBeNull();
    expect(bulanMulaiBerjalan("bukan tanggal")).toBeNull();
  });
});

describe("aturan tiga bulan", () => {
  it("tanggal buka yang menentukan, bukan ada-tidaknya penjualan", () => {
    const baru = outlet("o1", "2026-07-01");
    // Punya tiga bulan angka, tapi baru buka Juli — tetap belum dinilai.
    expect(sudahTigaBulan(baru, "2026-08", [9, 9, 9])).toBe(false);
  });

  it("outlet lama tetap lolos walau satu bulannya kosong", () => {
    const lama = outlet("o1", "2024-01-10");
    expect(sudahTigaBulan(lama, "2026-08", [9, null, 9])).toBe(true);
  });

  it("tanpa tanggal buka, ada-tidaknya penjualan jadi cadangan", () => {
    const tanpa = outlet("o1", null);
    expect(sudahTigaBulan(tanpa, "2026-08", [9, 9, 9])).toBe(true);
    expect(sudahTigaBulan(tanpa, "2026-08", [9, 0, 9])).toBe(false);
    expect(sudahTigaBulan(tanpa, "2026-08", [9, null, 9])).toBe(false);
  });

  it("nol dari ESB BUKAN bulan berjalan", () => {
    // ESB tetap membalas untuk cabang yang belum buka, dan balasannya nol.
    expect(sudahTigaBulan(outlet("o1"), "2026-08", [0, 0, 0])).toBe(false);
  });
});

describe("siapa yang diberi target", () => {
  const isi = riwayat({ "o1|2026-07": 100, "o1|2026-06": 200, "o1|2026-05": 300 });

  it("rata-rata tiga bulan ditambah pertumbuhan", () => {
    const [t] = hitungTargetSales({ periode: "2026-08", outlets: [outlet("o1", "2024-01-01")], riwayat: isi, pertumbuhan: 15 });
    expect(t.nilai).toBeCloseTo(200 * 1.15, 6);
    expect(t.dipakai).toEqual([100, 200, 300]);
    expect(t.pertumbuhan).toBe(15);
  });

  it("pertumbuhan nol berarti rata-ratanya apa adanya", () => {
    const [t] = hitungTargetSales({ periode: "2026-08", outlets: [outlet("o1", "2024-01-01")], riwayat: isi, pertumbuhan: 0 });
    expect(t.nilai).toBe(200);
  });

  it("outlet baru TIDAK diberi target, dan alasannya disebut", () => {
    // Memberinya target berarti menghukum outlet yang baru buka dengan
    // patokan yang tidak pernah dimilikinya.
    const [t] = hitungTargetSales({ periode: "2026-08", outlets: [outlet("o1", "2026-07-01")], riwayat: isi, pertumbuhan: 15 });
    expect(t.nilai).toBeNull();
    expect(t.alasan).toBe("belum-tiga-bulan");
  });

  it("outlet tanpa satu bulan pun yang sah tidak diberi target", () => {
    const kosong = riwayat({ "o1|2026-07": 0, "o1|2026-06": null, "o1|2026-05": 0 });
    const [t] = hitungTargetSales({ periode: "2026-08", outlets: [outlet("o1", "2024-01-01")], riwayat: kosong, pertumbuhan: 15 });
    expect(t.nilai).toBeNull();
    expect(t.alasan).toBe("tanpa-riwayat");
  });

  it("bulan yang kosong TIDAK ikut dirata-rata", () => {
    // Ikut menghitungnya sebagai nol berarti outlet yang datanya hilang satu
    // bulan mendapat target sepertiga lebih rendah — hadiah untuk data hilang.
    const bolong = riwayat({ "o1|2026-07": 300, "o1|2026-06": null, "o1|2026-05": 300 });
    const [t] = hitungTargetSales({ periode: "2026-08", outlets: [outlet("o1", "2024-01-01")], riwayat: bolong, pertumbuhan: 0 });
    expect(t.nilai).toBe(300);
    expect(t.dipakai).toEqual([300, 300]);
  });

  it("outlet yang tidak berhak TETAP dikembalikan, tidak dibuang diam-diam", () => {
    // Outlet yang hilang dari hasil tidak bisa dibedakan dari outlet yang
    // terlewat dihitung.
    const h = hitungTargetSales({
      periode: "2026-08",
      outlets: [outlet("o1", "2024-01-01"), outlet("o2", "2026-08-01")],
      riwayat: isi,
      pertumbuhan: 15,
    });
    expect(h).toHaveLength(2);
    expect(h.map((t) => t.outletId)).toEqual(["o1", "o2"]);
  });

  it("seluruh angka pembentuknya ikut dikembalikan supaya bisa dijelaskan", () => {
    const [t] = hitungTargetSales({ periode: "2026-08", outlets: [outlet("o1", "2024-01-01")], riwayat: isi, pertumbuhan: 15 });
    expect(t.bulan).toEqual(["2026-07", "2026-06", "2026-05"]);
    expect(t.riwayat).toEqual([100, 200, 300]);
  });
});

describe("penjaga: aturan V.1 tidak boleh menyimpang dari aturan yang berlaku", () => {
  /**
   * Aturan yang sama hidup di dua berkas — alasannya ditulis lengkap di
   * `target-sales.ts`. Yang dijaga di sini: keduanya tetap SEPAKAT. Begitu
   * salah satunya diubah tanpa yang lain, uji ini gagal dan yang mengubahnya
   * tahu ada tempat kedua yang harus ikut.
   */
  const lama = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");

  it("tanggal batas buka masih 15 di kedua tempat", () => {
    expect(TANGGAL_BATAS_BUKA).toBe(15);
    expect(lama).toContain("const TANGGAL_BATAS_BUKA = 15;");
  });

  it("aturan tanggal buka masih berbunyi sama", () => {
    expect(lama).toContain("return Number(tg) <= TANGGAL_BATAS_BUKA ? bulan : bulanSetelah(bulan);");
    expect(lama).toContain("return mulai <= tigaBulanSebelum(periode)[2];");
    expect(lama).toContain("return nilaiTigaBulan.every(berjalan);");
  });

  it("rumus pertumbuhannya masih rata-rata dikali (1 + persen/100)", () => {
    expect(lama).toContain("(ada.reduce((a, b) => a + b, 0) / ada.length) * (1 + tumbuh / 100)");
  });

  it("bulan yang nol atau kosong masih dibuang sebelum dirata-rata", () => {
    expect(lama).toContain("const ada = tiga.filter((v): v is number => v !== null && v > 0);");
  });

  it("laju pertumbuhan masih dibaca dari indikatornya, bukan ditulis tetap", () => {
    expect(lama).toContain('indikatorPosisi("operational_ca").find((i) => i.key === "gross_sales")?.target');
    // Dan tidak ada angka 15 yang ditanam di berkas V.1.
    const baru = readFileSync(join(process.cwd(), "src/lib/ops/target-sales.ts"), "utf8");
    const kode = baru.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(kode).not.toMatch(/pertumbuhan\s*[:=]\s*15/);
  });
});

describe("nama rumus ikut tersimpan", () => {
  it("punya nama dan versi, supaya angka lama bisa dijelaskan", () => {
    expect(RUMUS_TARGET).toBe("avg3-tumbuh");
    expect(RUMUS_TARGET_VERSI).toBeGreaterThanOrEqual(1);
  });
});
