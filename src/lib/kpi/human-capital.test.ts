import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indikatorPosisi } from "./indikator";
import { persentaseCapaian } from "./hitung";

/**
 * KPI Human Capital — dikunci ke Petunjuk Teknis yang disahkan Head Human
 * Capital, berlaku Januari 2026.
 *
 * Versi sebelumnya memakai enam indikator yang sama sekali berbeda (Pemenuhan
 * Permintaan, Kepatuhan Kontrak, Onboarding, Turnover) — bukan yang ada di
 * Juknis. Uji ini ada supaya penggantian itu tidak terjadi lagi tanpa ada yang
 * menyadarinya.
 */

const hc = indikatorPosisi("hc");
const cari = (key: string) => hc.find((i) => i.key === key)!;

describe("keenam indikator sesuai Juknis", () => {
  it("bobotnya 10-10-20-20-20-20 dan berjumlah 100", () => {
    expect(hc.map((i) => [i.key, i.bobot])).toEqual([
      ["hc_jumlah_rekrutmen", 10],
      ["hc_waktu_rekrutmen", 10],
      ["hc_kualitas_rekrutmen", 20],
      ["hc_development", 20],
      ["hc_manajemen_kinerja", 20],
      ["hc_administrasi", 20],
    ]);
    expect(hc.reduce((a, i) => a + i.bobot, 0)).toBe(100);
  });

  it("targetnya 21 hari, 10 orang, 4 program, 20% kinerja, 20 dokumen", () => {
    const nilai = (k: string) => {
      const t = cari(k).target;
      return t.jenis === "tetap" ? t.nilai : null;
    };
    expect(nilai("hc_waktu_rekrutmen")).toBe(21);
    expect(nilai("hc_kualitas_rekrutmen")).toBe(10);
    expect(nilai("hc_development")).toBe(4);
    expect(nilai("hc_manajemen_kinerja")).toBe(20);
    expect(nilai("hc_administrasi")).toBe(20);
  });

  it("hanya Manajemen Kinerja dan Administrasi yang otomatis", () => {
    // Diputuskan pemiliknya. Empat sisanya belum punya tempat pencatatan yang
    // dipakai orang — memaksanya otomatis berarti menampilkan nol tiap bulan
    // untuk pekerjaan yang sebenarnya berjalan.
    expect(hc.filter((i) => i.actual.sumber === "otomatis").map((i) => i.key)).toEqual([
      "hc_manajemen_kinerja",
      "hc_administrasi",
    ]);
    expect(hc.filter((i) => i.actual.sumber === "manual")).toHaveLength(4);
  });
});

describe("arah penilaian", () => {
  it("Waktu Rekrutmen: makin cepat makin baik, bukan sebaliknya", () => {
    // Juknis Bab V menulis satu rumus untuk semua indikator; Bab VI menulis
    // "semakin cepat semakin baik". Dengan rumus Bab V, 10 hari dari batas 21
    // bernilai 47% — makin cepat kerjanya makin jelek nilainya. Yang dipakai
    // kalimat Bab VI.
    expect(cari("hc_waktu_rekrutmen").penilaian).toBe("batas_maks");
    expect(persentaseCapaian(10, 21, "batas_maks")).toBe(100);
    expect(persentaseCapaian(21, 21, "batas_maks")).toBe(100);
    expect(Math.round(persentaseCapaian(42, 21, "batas_maks")!)).toBe(50);
  });

  it("Administrasi melebihi target tetap dipotong 100%", () => {
    // September 2026: 72 dokumen selesai dari target 20. Juknis: total maksimal
    // 100%, jadi kelebihannya tidak boleh mengangkat indikator lain.
    expect(persentaseCapaian(72, 20)).toBe(100);
  });
});

describe("contoh perhitungan di Juknis harus keluar angka yang sama", () => {
  // Bab VIII: KPI Maret 2026 = 93,18% — Development 3 dari 4 program, dan
  // Manajemen Kinerja 90,90% dari bobot 20.
  const capaian = [100, 100, 100, 75, 90.9, 100];

  it("totalnya 93,18%", () => {
    const total = hc.reduce((a, ind, n) => a + (ind.bobot * capaian[n]) / 100, 0);
    expect(Math.round(total * 100) / 100).toBe(93.18);
  });

  it("Development 3 dari 4 memberi capaian 75% dan %Actual 15%", () => {
    const p = persentaseCapaian(3, 4)!;
    expect(p).toBe(75);
    expect((cari("hc_development").bobot * p) / 100).toBe(15);
  });

  it("rata-rata departemen 90,9% menjadi actual 18,18 terhadap target 20", () => {
    // Bentuk yang sama dengan dasbor yang sudah dipakai Human Capital, supaya
    // angkanya bisa langsung dicocokkan dengan laporan mereka.
    const actual = Math.round((90.9 / 100) * 20 * 100) / 100;
    expect(actual).toBe(18.18);
    expect(Math.round(persentaseCapaian(actual, 20)! * 100) / 100).toBe(90.9);
  });
});

describe("Manajemen Kinerja tidak menghitung dirinya sendiri", () => {
  const kode = readFileSync(join(process.cwd(), "src/lib/data/kpi-hc.ts"), "utf8");

  it("departemen Human Capital dikeluarkan dari rata-rata", () => {
    // Bukan kelonggaran: ikut menghitung diri sendiri berarti nilai HC jadi
    // bahan untuk menghitung nilai HC — berputar tanpa ujung, dan halaman
    // KPI-nya tidak akan pernah selesai dimuat.
    expect(kode).toContain('const DEP_HC = "hrd"');
    expect(kode).toContain("d.kode === DEP_HC");
  });

  it("Administrasi dihitung dari tanggal SELESAI, bukan tanggal masuk", () => {
    expect(kode).toContain('.eq("status", "done")');
    expect(kode).toContain('.gte("completed_at", mulai)');
  });
});
