import { describe, expect, it } from "vitest";

import {
  belumTerdaftarKeduanya,
  cutiAktif,
  masaKerja,
  periodeBulanLalu,
  persenKehadiran,
  programTerpenuhi,
  rekapBpjs,
  rekapPayroll,
  type BarisBpjs,
  type BarisCuti,
  type BarisPayroll,
} from "./kompensasi";

const cuti = (p: Partial<BarisCuti>): BarisCuti => ({
  nama: "A",
  divisi: "",
  scope: "manajemen",
  jenis: "cuti",
  status: "disetujui",
  mulai: "2026-08-01",
  selesai: "2026-08-05",
  ...p,
});

describe("cutiAktif", () => {
  it("mengambil yang tanggalnya melingkupi hari itu", () => {
    const rows = [cuti({ nama: "Rina" }), cuti({ nama: "Budi", mulai: "2026-09-01", selesai: "2026-09-02" })];
    expect(cutiAktif(rows, "2026-08-03").map((r) => r.nama)).toEqual(["Rina"]);
  });

  it("hari pertama dan hari terakhir ikut terhitung", () => {
    const rows = [cuti({})];
    expect(cutiAktif(rows, "2026-08-01")).toHaveLength(1);
    expect(cutiAktif(rows, "2026-08-05")).toHaveLength(1);
    expect(cutiAktif(rows, "2026-08-06")).toHaveLength(0);
  });

  it("cuti sehari tanpa tanggal selesai tetap terbaca", () => {
    expect(cutiAktif([cuti({ selesai: null })], "2026-08-01")).toHaveLength(1);
  });

  it("yang belum disetujui tidak mengurangi kehadiran", () => {
    expect(cutiAktif([cuti({ status: "diajukan" }), cuti({ status: "ditolak" })], "2026-08-03")).toHaveLength(0);
  });

  it("tanggal atau baris yang cacat diabaikan, bukan bikin gagal", () => {
    expect(cutiAktif([cuti({})], "bukan-tanggal")).toEqual([]);
    expect(cutiAktif([cuti({ mulai: null })], "2026-08-03")).toEqual([]);
  });
});

describe("persenKehadiran", () => {
  it("tanpa yang cuti berarti penuh", () => {
    expect(persenKehadiran(109, 0)).toBe(100);
  });

  it("penyebutnya jumlah karyawan, bukan jumlah baris cuti", () => {
    expect(persenKehadiran(100, 9)).toBe(91);
  });

  it("tidak ada karyawan terpantau tidak menghasilkan pembagian nol", () => {
    expect(persenKehadiran(0, 0)).toBe(0);
  });

  it("cuti lebih banyak dari karyawan tidak menghasilkan angka minus", () => {
    expect(persenKehadiran(5, 9)).toBe(0);
  });
});

describe("periodeBulanLalu", () => {
  it("mundur satu bulan", () => {
    expect(periodeBulanLalu(new Date("2026-08-21T00:00:00Z"))).toBe("2026-07");
  });

  it("Januari mundur ke Desember tahun sebelumnya", () => {
    expect(periodeBulanLalu(new Date("2026-01-09T00:00:00Z"))).toBe("2025-12");
  });
});

const gaji = (p: Partial<BarisPayroll>): BarisPayroll => ({
  nama: "A",
  scope: "manajemen",
  periode: "2026-07",
  sumber: "office",
  outletName: null,
  status: "selesai",
  ...p,
});

describe("rekapPayroll", () => {
  it("mengelompokkan dan mengurutkan dari yang terbanyak", () => {
    const rows = [
      gaji({ sumber: "office" }),
      gaji({ sumber: "office" }),
      gaji({ sumber: "warehouse" }),
    ];
    expect(rekapPayroll(rows, "2026-07", (r) => r.sumber)).toEqual([
      { nama: "office", jumlah: 2, status: "selesai" },
      { nama: "warehouse", jumlah: 1, status: "selesai" },
    ]);
  });

  it("satu baris belum selesai membuat kelompoknya belum selesai", () => {
    const rows = [gaji({}), gaji({ status: "proses" })];
    expect(rekapPayroll(rows, "2026-07", (r) => r.sumber)[0].status).toBe("proses");
  });

  it("periode lain tidak ikut terhitung", () => {
    expect(rekapPayroll([gaji({ periode: "2026-06" })], "2026-07", (r) => r.sumber)).toEqual([]);
  });

  it("kunci kosong jatuh ke Lainnya, bukan hilang", () => {
    expect(rekapPayroll([gaji({ sumber: "" })], "2026-07", (r) => r.sumber)).toEqual([
      { nama: "Lainnya", jumlah: 1, status: "selesai" },
    ]);
  });
});

const bpjs = (p: Partial<BarisBpjs>): BarisBpjs => ({
  nama: "A",
  scope: "manajemen",
  tk: "terdaftar",
  kes: "terdaftar",
  tglMasuk: null,
  ...p,
});

describe("rekapBpjs", () => {
  it("memisahkan yang kurang satu program dari yang belum tersentuh", () => {
    const rows = [
      bpjs({}),
      bpjs({ kes: "belum" }),
      bpjs({ tk: "belum", kes: "belum" }),
      bpjs({ tk: "proses", kes: "belum" }),
    ];
    expect(rekapBpjs(rows)).toEqual({
      total: 4,
      tkSelesai: 2,
      kesSelesai: 1,
      keduanya: 1,
      belumSamaSekali: 2,
    });
  });

  it("tanpa baris semuanya nol", () => {
    expect(rekapBpjs([])).toEqual({ total: 0, tkSelesai: 0, kesSelesai: 0, keduanya: 0, belumSamaSekali: 0 });
  });

  it("belumTerdaftarKeduanya hanya yang dua-duanya belum", () => {
    const rows = [bpjs({ nama: "Ada" }), bpjs({ nama: "Riva", tk: "belum", kes: "proses" })];
    expect(belumTerdaftarKeduanya(rows).map((r) => r.nama)).toEqual(["Riva"]);
  });
});

describe("masaKerja", () => {
  const kini = new Date("2026-08-21T00:00:00Z");

  it("menyusun tahun, bulan, dan hari", () => {
    expect(masaKerja("2023-11-08", kini)).toBe("2 Tahun 9 Bulan 13 Hari");
  });

  it("kurang dari setahun tidak menyebut tahun", () => {
    expect(masaKerja("2025-11-14", kini)).toBe("9 Bulan 7 Hari");
  });

  it("meminjam hari dari panjang bulan sebelumnya, bukan 30 tetap", () => {
    // 31 Januari → 1 Maret 2026: Februari 2026 panjangnya 28 hari.
    expect(masaKerja("2026-01-31", new Date("2026-03-01T00:00:00Z"))).toBe("1 Bulan 1 Hari");
  });

  it("baru masuk hari ini bukan '0 Hari'", () => {
    expect(masaKerja("2026-08-21", kini)).toBe("Karyawan baru");
  });

  it("tanggal masuk di masa depan dianggap karyawan baru", () => {
    expect(masaKerja("2026-12-01", kini)).toBe("Karyawan baru");
  });

  it("tanpa tanggal masuk ditandai, bukan ditebak", () => {
    expect(masaKerja(null, kini)).toBe("—");
    expect(masaKerja("bukan-tanggal", kini)).toBe("—");
  });
});

describe("programTerpenuhi", () => {
  it("terpenuhi kalau peserta mencapai sasaran", () => {
    expect(programTerpenuhi({ program: "THR", peserta: 219, target: 219 })).toBe(true);
  });

  it("belum terpenuhi kalau masih kurang", () => {
    expect(programTerpenuhi({ program: "THR", peserta: 218, target: 219 })).toBe(false);
  });

  it("sasaran nol bukan berarti terpenuhi", () => {
    expect(programTerpenuhi({ program: "THR", peserta: 0, target: 0 })).toBe(false);
  });
});
