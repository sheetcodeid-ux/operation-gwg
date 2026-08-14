import { describe, expect, it } from "vitest";
import {
  brandOutlet,
  bulanKeluar,
  durasiBulan,
  masaKerja,
  periodeLabel,
  sisaHari,
  statusKontrak,
} from "./kontrak";

const NOW = new Date("2026-08-14T05:00:00Z");

describe("status kontrak dihitung dari tanggal, bukan diketik", () => {
  const pkwt = (mulai: string, berakhir: string) => ({
    jenis: "PKWT" as const,
    tglMulai: mulai,
    tglBerakhir: berakhir,
    tglResign: null,
  });

  it("aktif selama masih jauh dari tanggal berakhir", () => {
    expect(statusKontrak(pkwt("2026-01-01", "2027-01-01"), NOW)).toBe("aktif");
  });

  it("segera berakhir bila tersisa 60 hari atau kurang", () => {
    expect(statusKontrak(pkwt("2025-10-13", "2026-10-13"), NOW)).toBe("segera_berakhir");
    // 61 hari — persis di luar ambang, jadi masih aktif.
    expect(statusKontrak(pkwt("2025-10-14", "2026-10-14"), NOW)).toBe("aktif");
  });

  it("berakhir begitu tanggalnya lewat", () => {
    expect(statusKontrak(pkwt("2025-01-01", "2026-08-13"), NOW)).toBe("berakhir");
  });

  it("hari terakhir kontrak masih terhitung belum berakhir", () => {
    expect(statusKontrak(pkwt("2025-01-01", "2026-08-14"), NOW)).toBe("segera_berakhir");
  });

  it("PKWTT selalu aktif — memang tidak punya tanggal berakhir", () => {
    expect(
      statusKontrak({ jenis: "PKWTT", tglMulai: "2020-01-01", tglBerakhir: null, tglResign: null }, NOW),
    ).toBe("aktif");
  });

  it("tanpa jenis atau tanggal mulai berarti kontraknya memang belum ada", () => {
    expect(statusKontrak({ jenis: null, tglMulai: null, tglBerakhir: null, tglResign: null }, NOW)).toBe("belum_ada");
    expect(statusKontrak({ jenis: "PKWT", tglMulai: null, tglBerakhir: "2027-01-01", tglResign: null }, NOW)).toBe(
      "belum_ada",
    );
  });
});

describe("sisa hari", () => {
  it("negatif bila sudah lewat", () => {
    const k = { jenis: "PKWT" as const, tglMulai: "2025-01-01", tglBerakhir: "2026-08-01", tglResign: null };
    expect(sisaHari(k, NOW)).toBe(-13);
  });

  it("nol tepat pada hari terakhir", () => {
    const k = { jenis: "PKWT" as const, tglMulai: "2025-01-01", tglBerakhir: "2026-08-14", tglResign: null };
    expect(sisaHari(k, NOW)).toBe(0);
  });

  it("null bila tanggal berakhirnya tidak ada", () => {
    expect(sisaHari({ jenis: "PKWTT", tglMulai: "2020-01-01", tglBerakhir: null, tglResign: null }, NOW)).toBeNull();
  });
});

describe("durasi kontrak", () => {
  it("setahun terbaca 12 bulan", () => {
    expect(durasiBulan({ jenis: "PKWT", tglMulai: "2026-05-30", tglBerakhir: "2027-05-30", tglResign: null })).toBe(12);
  });

  it("tiga bulan terbaca 3 bulan", () => {
    expect(durasiBulan({ jenis: "PKWT", tglMulai: "2026-05-30", tglBerakhir: "2026-08-30", tglResign: null })).toBe(3);
  });

  it("null bila tanggalnya terbalik — bukan angka negatif yang menyesatkan", () => {
    expect(durasiBulan({ jenis: "PKWT", tglMulai: "2027-01-01", tglBerakhir: "2026-01-01", tglResign: null })).toBeNull();
  });
});

describe("masa kerja", () => {
  it("dihitung sampai hari ini bila masih bekerja", () => {
    expect(masaKerja("2024-05-14", null, NOW)).toBe("2 tahun 3 bulan");
  });

  it("berhenti di tanggal keluar bila sudah keluar", () => {
    expect(masaKerja("2024-05-14", "2026-04-28", NOW)).toBe("1 tahun 11 bulan");
  });

  it("di bawah setahun ditulis dalam bulan", () => {
    expect(masaKerja("2026-04-29", null, NOW)).toBe("3 bulan");
  });

  it("tanpa tanggal masuk tidak mengarang angka", () => {
    expect(masaKerja(null, null, NOW)).toBe("—");
  });
});

describe("pengelompokan waktu", () => {
  it("bulan keluar memakai nama bulan Indonesia", () => {
    expect(bulanKeluar("2026-04-28")).toBe("April 2026");
  });

  it("tanpa tanggal keluar berarti belum keluar", () => {
    expect(bulanKeluar(null)).toBeNull();
  });

  it("periode diterjemahkan ke label yang terbaca", () => {
    expect(periodeLabel("2026-08")).toBe("Agustus 2026");
  });
});

describe("brand outlet dari namanya", () => {
  it("mengenali keempat brand", () => {
    expect(brandOutlet("Nordu Sampit")).toBe("Nordu");
    expect(brandOutlet("Cattu Sintang")).toBe("Cattu");
    expect(brandOutlet("Ayam Busari I")).toBe("Busari");
    expect(brandOutlet("Lesung Pipi")).toBe("Lesung Pipi");
  });

  it("Bakes ikut Nordu — memang gerai Nordu", () => {
    expect(brandOutlet("Bakes Mujahidin")).toBe("Nordu");
  });

  it("nama yang tidak dikenali dikembalikan null, tidak dipaksa ke brand terbesar", () => {
    expect(brandOutlet("Gerai Baru")).toBeNull();
  });
});
