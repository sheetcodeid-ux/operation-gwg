import { describe, expect, it } from "vitest";
import {
  alasanKeluar,
  keluarPerBrand,
  eskalasiValid,
  lamaHari,
  rataWaktuSelesai,
  ringkasKasus,
  ringkasKeluar,
  TAHAP_OFFBOARDING,
  type PerkaraRingkas,
} from "./relasi";

const p = (x: Partial<PerkaraRingkas>): PerkaraRingkas => ({
  nama: "Budi",
  scope: "manajemen",
  kategori: "Resign",
  status: "terbuka",
  eskalasi: "normal",
  tanggal: "2026-01-10",
  tglSelesai: null,
  exitInterview: false,
  serahAset: false,
  payrollFinal: false,
  ...x,
});

describe("lamaHari", () => {
  it("menghitung selisih hari", () => {
    expect(lamaHari("2026-01-01", "2026-01-05")).toBe(4);
  });

  it("null bila salah satu tanggalnya tidak ada", () => {
    expect(lamaHari("2026-01-01", null)).toBeNull();
    expect(lamaHari(null, "2026-01-05")).toBeNull();
  });

  it("null bila selesainya mendahului mulainya", () => {
    // Data seperti ini memang salah; mengembalikan angka negatif berarti
    // rata-ratanya ikut tertarik ke bawah tanpa ada yang menyadarinya.
    expect(lamaHari("2026-01-05", "2026-01-01")).toBeNull();
  });
});

describe("rataWaktuSelesai", () => {
  it("hanya menghitung perkara yang sudah punya kedua tanggalnya", () => {
    // Kalau yang belum selesai ikut dihitung nol hari, semakin menumpuk
    // perkara yang belum kelar semakin cepat rata-ratanya terlihat.
    const hasil = rataWaktuSelesai([
      p({ tanggal: "2026-01-01", tglSelesai: "2026-01-05" }),
      p({ tanggal: "2026-02-01", tglSelesai: null }),
    ]);
    expect(hasil).toBe(4);
  });

  it("null bila belum ada satu pun yang selesai", () => {
    expect(rataWaktuSelesai([p({ tglSelesai: null })])).toBeNull();
  });
});

describe("ringkasKasus", () => {
  it("berjalan menghitung yang statusnya belum selesai", () => {
    const r = ringkasKasus([p({ status: "terbuka" }), p({ status: "proses" }), p({ status: "selesai" })], 2026);
    expect(r.berjalan).toBe(2);
  });

  it("selesai tahun ini memakai tanggal selesai, bukan tanggal masuk", () => {
    // Perkara lama yang baru ditutup tahun ini memang termasuk pencapaian
    // tahun ini.
    const r = ringkasKasus(
      [p({ status: "selesai", tanggal: "2025-11-01", tglSelesai: "2026-01-20" })],
      2026,
    );
    expect(r.selesaiTahunIni).toBe(1);
  });

  it("eskalasi tinggi hanya menghitung yang belum selesai", () => {
    const r = ringkasKasus(
      [p({ eskalasi: "tinggi", status: "proses" }), p({ eskalasi: "tinggi", status: "selesai" })],
      2026,
    );
    expect(r.eskalasiTinggi).toBe(1);
  });

  it("tanpa data seluruh angkanya nol dan rata-ratanya null", () => {
    const r = ringkasKasus([], 2026);
    expect(r).toMatchObject({ berjalan: 0, selesaiTahunIni: 0, eskalasiTinggi: 0, total: 0 });
    expect(r.rataHari).toBeNull();
  });
});

describe("ringkasKeluar", () => {
  it("ketiga langkahnya dihitung terhadap yang keluar tahun ini saja", () => {
    const r = ringkasKeluar(
      [
        p({ tanggal: "2026-04-05", exitInterview: true, serahAset: true, payrollFinal: true }),
        p({ tanggal: "2026-07-28", exitInterview: true, serahAset: true, payrollFinal: false }),
        p({ tanggal: "2026-03-18", exitInterview: true, serahAset: true, payrollFinal: true }),
        // Arsip lama tidak boleh ikut menarik penyebutnya.
        p({ tanggal: "2024-02-02", exitInterview: true, serahAset: true, payrollFinal: true }),
      ],
      2026,
    );
    expect(r.keluarTahunIni).toBe(3);
    expect(r.exitInterview).toBe(3);
    expect(r.serahAset).toBe(3);
    expect(r.payrollFinal).toBe(2);
    expect(r.total).toBe(4);
  });

  it("tanpa tanggal tidak dihitung sebagai keluar tahun ini", () => {
    expect(ringkasKeluar([p({ tanggal: null })], 2026).keluarTahunIni).toBe(0);
  });
});

describe("alasanKeluar", () => {
  it("mengelompokkan dan mengurutkan dari yang terbanyak", () => {
    expect(
      alasanKeluar([p({ kategori: "Resign" }), p({ kategori: "PHK" }), p({ kategori: "Resign" })]),
    ).toEqual([
      { nama: "Resign", nilai: 2 },
      { nama: "PHK", nilai: 1 },
    ]);
  });

  it("kategori kosong dikelompokkan sebagai Tidak dicatat", () => {
    expect(alasanKeluar([p({ kategori: "  " })])).toEqual([{ nama: "Tidak dicatat", nilai: 1 }]);
  });
});

describe("eskalasiValid", () => {
  it("hanya menerima tingkat yang dikenal", () => {
    expect(eskalasiValid("tinggi")).toBe(true);
    expect(eskalasiValid("gawat")).toBe(false);
  });
});

describe("TAHAP_OFFBOARDING", () => {
  it("lima tahap, urut dari notifikasi sampai update database", () => {
    expect(TAHAP_OFFBOARDING).toHaveLength(5);
    expect(TAHAP_OFFBOARDING[0].judul).toContain("Notifikasi");
    expect(TAHAP_OFFBOARDING[4].judul).toContain("Database Karyawan");
  });

  it("setiap tahap punya penjelasannya", () => {
    for (const t of TAHAP_OFFBOARDING) expect(t.isi.length).toBeGreaterThan(10);
  });
});

describe("keluarPerBrand", () => {
  const b = (brand: string, kategori: string) => ({ brand, kategori });

  it("menjumlah per brand dan mengurutkan dari yang terbanyak", () => {
    expect(
      keluarPerBrand([b("Nordu", "Resign"), b("Nordu", "Resign"), b("Cattu", "PHK")]),
    ).toEqual([
      { brand: "Nordu", jumlah: 2, alasanTerbanyak: "Resign" },
      { brand: "Cattu", jumlah: 1, alasanTerbanyak: "PHK" },
    ]);
  });

  it("alasan terbanyak dipilih per brand, bukan menyeluruh", () => {
    const rows = [
      b("Nordu", "Resign"),
      b("Cattu", "Tidak dilanjutkan"),
      b("Cattu", "Tidak dilanjutkan"),
      b("Cattu", "Resign"),
    ];
    expect(keluarPerBrand(rows)[0]).toEqual({
      brand: "Cattu",
      jumlah: 3,
      alasanTerbanyak: "Tidak dilanjutkan",
    });
  });

  it("seri alasan dipecah menurut abjad supaya hasilnya tidak berubah-ubah", () => {
    const rows = [b("Nordu", "Resign"), b("Nordu", "PHK")];
    expect(keluarPerBrand(rows)[0].alasanTerbanyak).toBe("PHK");
    // Urutan baris dibalik — jawabannya harus tetap sama.
    expect(keluarPerBrand([...rows].reverse())[0].alasanTerbanyak).toBe("PHK");
  });

  it("brand dan alasan yang kosong ditandai, bukan dibuang", () => {
    expect(keluarPerBrand([b("  ", "  ")])).toEqual([
      { brand: "Tanpa Brand", jumlah: 1, alasanTerbanyak: "Tidak dicatat" },
    ]);
  });

  it("tanpa baris menghasilkan daftar kosong", () => {
    expect(keluarPerBrand([])).toEqual([]);
  });
});
