import { describe, expect, it } from "vitest";

import { headcountPada, keluarAntara, turnoverBulanan, turnoverYtd, type RiwayatKerja } from "./turnover";

const orang = (masuk: string | null, resign: string | null = null): RiwayatKerja => ({ masuk, resign });
const saat = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

describe("headcountPada", () => {
  it("menghitung yang sudah masuk dan belum keluar", () => {
    const rows = [orang("2024-01-01"), orang("2026-09-01"), orang("2024-01-01", "2026-03-01")];
    expect(headcountPada(rows, saat("2026-08-21"))).toBe(1);
  });

  it("yang keluar tepat hari itu masih terhitung bekerja hari itu", () => {
    expect(headcountPada([orang("2024-01-01", "2026-08-21")], saat("2026-08-21"))).toBe(1);
    expect(headcountPada([orang("2024-01-01", "2026-08-21")], saat("2026-08-22"))).toBe(0);
  });

  it("tanpa tanggal masuk tidak bisa dihitung", () => {
    expect(headcountPada([orang(null)], saat("2026-08-21"))).toBe(0);
  });
});

describe("keluarAntara", () => {
  it("kedua ujung rentangnya ikut terhitung", () => {
    const rows = [orang("2024-01-01", "2026-08-01"), orang("2024-01-01", "2026-08-31")];
    expect(keluarAntara(rows, saat("2026-08-01"), saat("2026-08-31"))).toBe(2);
  });

  it("yang masih bekerja tidak terhitung", () => {
    expect(keluarAntara([orang("2024-01-01")], saat("2026-08-01"), saat("2026-08-31"))).toBe(0);
  });
});

describe("turnoverBulanan", () => {
  const kini = new Date("2026-08-21T00:00:00Z");

  it("mengembalikan bulan sebanyak yang diminta, terlama di depan", () => {
    const t = turnoverBulanan([orang("2024-01-01")], kini, 6);
    expect(t).toHaveLength(6);
    expect(t.map((x) => x.bulan)).toEqual([
      "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08",
    ]);
  });

  it("penyebutnya rata-rata awal dan akhir bulan, bukan sisa akhir bulan", () => {
    // 10 orang di awal Agustus; 2 keluar 15 Agustus → akhir bulan tinggal 8.
    // Rata-rata 9, jadi 2/9 = 22,2% — bukan 2/8 = 25%.
    const rows = [
      ...Array.from({ length: 8 }, () => orang("2024-01-01")),
      orang("2024-01-01", "2026-08-15"),
      orang("2024-01-01", "2026-08-15"),
    ];
    const agustus = turnoverBulanan(rows, kini, 1)[0];
    expect(agustus).toEqual({ bulan: "2026-08", keluar: 2, headcount: 9, persen: 22.2 });
  });

  it("bulan tanpa karyawan tidak menghasilkan pembagian nol", () => {
    expect(turnoverBulanan([], kini, 1)[0]).toEqual({
      bulan: "2026-08",
      keluar: 0,
      headcount: 0,
      persen: 0,
    });
  });

  it("mundur melewati pergantian tahun", () => {
    const t = turnoverBulanan([orang("2020-01-01")], new Date("2026-02-10T00:00:00Z"), 4);
    expect(t.map((x) => x.bulan)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("turnoverYtd", () => {
  it("hanya menghitung kepergian tahun berjalan", () => {
    const rows = [
      ...Array.from({ length: 9 }, () => orang("2020-01-01")),
      orang("2020-01-01", "2025-11-30"),
      orang("2020-01-01", "2026-04-10"),
    ];
    const y = turnoverYtd(rows, new Date("2026-08-21T00:00:00Z"));
    expect(y.keluar).toBe(1);
    expect(y.headcount).toBe(10);
    expect(y.persen).toBe(10);
  });

  it("tanpa karyawan hasilnya nol, bukan NaN", () => {
    expect(turnoverYtd([], new Date("2026-08-21T00:00:00Z")).persen).toBe(0);
  });
});
