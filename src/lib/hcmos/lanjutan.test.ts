import { describe, expect, it } from "vitest";
import {
  ASPEK_KINERJA,
  lamaCuti,
  lulus,
  peningkatan,
  predikatKinerja,
  senjangKompetensi,
  skorKinerja,
  takeHomePay,
} from "./lanjutan";
import { capaian, KPI_HC, nadaCapaian } from "./kpi";
import { progresOnboarding } from "./rekrutmen";
import { sisaBerlaku, statusBerlaku } from "./dokumen";

describe("bobot penilaian kinerja", () => {
  it("berjumlah tepat 100 — kalau tidak, skor antar periode tidak sebanding", () => {
    expect(ASPEK_KINERJA.reduce((a, x) => a + x.bobot, 0)).toBe(100);
  });

  it("nilai penuh menghasilkan 100", () => {
    const penuh = Object.fromEntries(ASPEK_KINERJA.map((a) => [a.key, 5]));
    expect(skorKinerja(penuh)).toBe(100);
  });

  it("aspek yang belum dinilai dihitung nol, bukan diabaikan", () => {
    expect(skorKinerja({ hasil: 5 })).toBe(35);
  });

  it("predikat mengikuti ambangnya", () => {
    expect(predikatKinerja(90).label).toBe("Sangat Baik");
    expect(predikatKinerja(85).label).toBe("Sangat Baik");
    expect(predikatKinerja(84).label).toBe("Baik");
    expect(predikatKinerja(40).label).toBe("Perlu Perbaikan");
  });
});

describe("Fast Start & Fast Track", () => {
  it("lulus tepat di ambang 65", () => {
    expect(lulus(65)).toBe(true);
    expect(lulus(64.9)).toBe(false);
  });

  it("belum dinilai bukan berarti tidak lulus", () => {
    expect(lulus(null)).toBeNull();
  });

  it("peningkatan dihitung dari selisih pre ke post", () => {
    expect(peningkatan(55, 82)).toBe(27);
    expect(peningkatan(null, 82)).toBeNull();
  });
});

describe("kompetensi", () => {
  it("negatif berarti di bawah standar", () => {
    expect(senjangKompetensi(4, 2)).toBe(-2);
    expect(senjangKompetensi(3, 3)).toBe(0);
  });
});

describe("cuti & payroll", () => {
  it("lama cuti menghitung hari pertama dan terakhir", () => {
    expect(lamaCuti("2026-08-10", "2026-08-12")).toBe(3);
    expect(lamaCuti("2026-08-10", "2026-08-10")).toBe(1);
  });

  it("tanggal terbalik dianggap nol, bukan angka negatif", () => {
    expect(lamaCuti("2026-08-12", "2026-08-10")).toBe(0);
  });

  it("take-home pay = pokok + tunjangan + lembur - potongan", () => {
    expect(takeHomePay({ gajiPokok: 5_000_000, tunjangan: 750_000, lembur: 200_000, potongan: 150_000 })).toBe(5_800_000);
  });
});

describe("onboarding", () => {
  it("ceklis kosong berarti nol persen", () => {
    expect(progresOnboarding("outlet", {})).toBe(0);
  });

  it("butir yang tidak dikenal tidak menaikkan progres", () => {
    expect(progresOnboarding("outlet", { butir_hantu: true })).toBe(0);
  });
});

describe("masa berlaku dokumen", () => {
  const now = new Date("2026-08-14T00:00:00Z");

  it("segera habis bila tersisa 90 hari atau kurang", () => {
    expect(statusBerlaku("2026-11-12", now)).toBe("segera_habis");
    expect(statusBerlaku("2026-11-13", now)).toBe("berlaku");
  });

  it("habis begitu tanggalnya lewat", () => {
    expect(statusBerlaku("2026-08-13", now)).toBe("habis");
    expect(sisaBerlaku("2026-08-13", now)).toBe(-1);
  });

  it("tanpa tanggal berarti tanpa masa berlaku, bukan habis", () => {
    expect(statusBerlaku(null, now)).toBe("tanpa_masa");
  });
});

describe("capaian KPI", () => {
  const pemenuhan = KPI_HC.find((k) => k.key === "pemenuhan_rekrutmen")!;
  const turnover = KPI_HC.find((k) => k.key === "turnover")!;

  it("indikator biasa: realisasi dibagi target", () => {
    expect(capaian(pemenuhan, 90)).toBe(100);
    expect(capaian(pemenuhan, 45)).toBe(50);
  });

  it("turnover dihitung terbalik — makin kecil makin baik", () => {
    expect(capaian(turnover, 10)).toBe(100);
    expect(capaian(turnover, 5)).toBe(150);
    expect(capaian(turnover, 20)).toBe(50);
  });

  it("tanpa data tidak menghasilkan nol — nol berarti gagal, bukan belum diukur", () => {
    expect(capaian(pemenuhan, null)).toBeNull();
    expect(nadaCapaian(null)).toBe("brand");
  });
});
