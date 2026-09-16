import { describe, expect, it } from "vitest";
import {
  akhirBulan,
  awalBulan,
  bulanDari,
  bulanIniWib,
  bulanSah,
  bulanSebelum,
  bulanSesudah,
  geserHari,
  hariBerjalan,
  hariIniWib,
  jumlahHari,
  OFFSET_WIB_MS,
  selisihHari,
  sudahLewat,
  tahunIniWib,
  tanggalSah,
} from "./waktu";

/**
 * WAKTU BISNIS — yang diuji di sini PERGANTIAN HARINYA, bukan pemformatannya.
 *
 * Tanggal bisnis GWG berganti tengah malam Jakarta, yaitu pukul 17.00 UTC hari
 * sebelumnya. Satu milidetik di sisi yang salah membuat penjualan satu hari
 * penuh tercatat di hari yang keliru — dan itu tidak akan terlihat dari layar,
 * karena angkanya tetap masuk akal di kedua hari.
 */

/** Tengah malam WIB sebuah tanggal, dalam milidetik epoch. */
const tengahMalamWib = (tanggal: string) => Date.parse(`${tanggal}T00:00:00Z`) - OFFSET_WIB_MS;

describe("pergantian hari WIB", () => {
  it("satu milidetik SEBELUM tengah malam masih hari kemarin", () => {
    expect(hariIniWib(tengahMalamWib("2026-09-16") - 1)).toBe("2026-09-15");
  });

  it("tepat tengah malam sudah hari baru", () => {
    expect(hariIniWib(tengahMalamWib("2026-09-16"))).toBe("2026-09-16");
  });

  it("satu milidetik SESUDAH tengah malam tetap hari baru", () => {
    expect(hariIniWib(tengahMalamWib("2026-09-16") + 1)).toBe("2026-09-16");
  });

  it("pukul 23.59 UTC sudah masuk hari berikutnya menurut WIB", () => {
    // Inilah jebakan yang dijaga: memakai UTC apa adanya, ini masih 16 Sep.
    expect(hariIniWib(Date.parse("2026-09-16T23:59:00Z"))).toBe("2026-09-17");
  });

  it("pukul 00.30 UTC masih hari sebelumnya menurut WIB", () => {
    expect(hariIniWib(Date.parse("2026-09-16T00:30:00Z"))).toBe("2026-09-16");
    expect(hariIniWib(Date.parse("2026-09-16T16:59:00Z"))).toBe("2026-09-16");
  });
});

describe("batas bulan dan tahun", () => {
  it("tengah malam 1 September memindahkan bulannya", () => {
    const t = tengahMalamWib("2026-09-01");
    expect(hariIniWib(t - 1)).toBe("2026-08-31");
    expect(bulanIniWib(t - 1)).toBe("2026-08");
    expect(hariIniWib(t)).toBe("2026-09-01");
    expect(bulanIniWib(t)).toBe("2026-09");
  });

  it("tengah malam 1 Januari memindahkan tahunnya", () => {
    const t = tengahMalamWib("2027-01-01");
    expect(tahunIniWib(t - 1)).toBe("2026");
    expect(tahunIniWib(t)).toBe("2027");
  });
});

describe("jumlah hari sebulan", () => {
  it("memakai fungsi yang sama dengan Daily, bukan salinannya", () => {
    // `jumlahHari` di-ekspor ulang dari `./harian`. Rumus jumlah hari yang
    // ditulis dua kali adalah rumus yang berbeda di Februari tahun kabisat —
    // satu-satunya bulan yang tidak pernah diperiksa siapa pun.
    expect(jumlahHari("2026-02")).toBe(28);
    expect(jumlahHari("2024-02")).toBe(29);
    expect(jumlahHari("2026-01")).toBe(31);
    expect(jumlahHari("2026-04")).toBe(30);
  });

  it("akhirBulan sepakat dengan jumlahHari", () => {
    for (const p of ["2026-01", "2026-02", "2024-02", "2026-04", "2026-12"]) {
      expect(akhirBulan(p), p).toBe(`${p}-${String(jumlahHari(p)).padStart(2, "0")}`);
    }
    expect(awalBulan("2026-09")).toBe("2026-09-01");
  });
});

describe("hari berjalan", () => {
  const kini = tengahMalamWib("2026-09-16") + 3_600_000 * 10; // 16 Sep, pukul 10 WIB

  it("bulan berjalan: sampai tanggal hari ini", () => {
    expect(hariBerjalan("2026-09", kini)).toBe(16);
  });

  it("bulan yang sudah selesai: seluruh harinya", () => {
    expect(hariBerjalan("2026-08", kini)).toBe(31);
    expect(hariBerjalan("2026-02", kini)).toBe(28);
  });

  it("bulan yang belum datang: nol", () => {
    expect(hariBerjalan("2026-10", kini)).toBe(0);
    expect(hariBerjalan("2027-01", kini)).toBe(0);
  });

  it("tanggal 1 pukul 00.00 WIB berarti satu hari berjalan, bukan nol", () => {
    // Nol akan membuat pembagi kelengkapan jadi nol pada hari pertama tiap
    // bulan, dan seluruh persentase hari itu tidak terdefinisi.
    expect(hariBerjalan("2026-09", tengahMalamWib("2026-09-01"))).toBe(1);
  });
});

describe("geser dan selisih", () => {
  it("melewati batas bulan", () => {
    expect(geserHari("2026-08-31", 1)).toBe("2026-09-01");
    expect(geserHari("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("melewati batas tahun", () => {
    expect(geserHari("2026-12-31", 1)).toBe("2027-01-01");
    expect(geserHari("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("melewati 29 Februari tahun kabisat", () => {
    expect(geserHari("2024-02-28", 1)).toBe("2024-02-29");
    expect(geserHari("2024-02-29", 1)).toBe("2024-03-01");
    expect(geserHari("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("selisih hari dihitung utuh", () => {
    expect(selisihHari("2026-09-01", "2026-09-16")).toBe(15);
    expect(selisihHari("2026-09-16", "2026-09-01")).toBe(-15);
    expect(selisihHari("2026-09-16", "2026-09-16")).toBe(0);
  });

  it("bulan sebelum dan sesudah melewati pergantian tahun", () => {
    expect(bulanSebelum("2026-01")).toBe("2025-12");
    expect(bulanSesudah("2026-12")).toBe("2027-01");
    expect(bulanSebelum("2026-09")).toBe("2026-08");
    expect(bulanDari("2026-09-16")).toBe("2026-09");
  });
});

describe("sudah lewat", () => {
  const kini = tengahMalamWib("2026-09-16") + 3_600_000 * 10;

  it("HARI INI belum lewat — jualannya masih berjalan", () => {
    expect(sudahLewat("2026-09-16", kini)).toBe(false);
  });

  it("kemarin sudah lewat", () => {
    expect(sudahLewat("2026-09-15", kini)).toBe(true);
  });

  it("besok belum lewat", () => {
    expect(sudahLewat("2026-09-17", kini)).toBe(false);
  });
});

describe("bentuk yang sah", () => {
  it("tanggal", () => {
    expect(tanggalSah("2026-09-16")).toBe(true);
    expect(tanggalSah("2026-9-16")).toBe(false);
    expect(tanggalSah("16-09-2026")).toBe(false);
    expect(tanggalSah("besok")).toBe(false);
    expect(tanggalSah("")).toBe(false);
  });

  it("bulan", () => {
    expect(bulanSah("2026-09")).toBe(true);
    expect(bulanSah("2026-13")).toBe(false);
    expect(bulanSah("2026-00")).toBe(false);
    expect(bulanSah("2026-9")).toBe(false);
  });
});
