import { describe, expect, it } from "vitest";
import { periodeTerbanyak, rekapUnit, statusSesiValid, sudahDinilai, type ReviewRingkas } from "./penilaian";

const r = (p: Partial<ReviewRingkas>): ReviewRingkas => ({
  nama: "Budi",
  scope: "manajemen",
  periode: "Juli-Agustus 2026",
  status: "selesai",
  ...p,
});

describe("sudahDinilai", () => {
  it("selesai dan ditinjau dihitung sudah dinilai", () => {
    expect(sudahDinilai("selesai")).toBe(true);
    expect(sudahDinilai("ditinjau")).toBe(true);
  });

  it("draf belum dihitung", () => {
    expect(sudahDinilai("draf")).toBe(false);
  });

  it("huruf besar dan spasi tidak mengubah artinya", () => {
    expect(sudahDinilai("  SELESAI ")).toBe(true);
  });
});

describe("rekapUnit", () => {
  it("pembaginya jumlah karyawan, bukan jumlah baris penilaian", () => {
    // Inti persoalannya: kalau penyebutnya diambil dari tabel penilaian, orang
    // yang belum dinilai ikut hilang dan angkanya selalu 100%.
    const u = rekapUnit("Manajemen (GWG)", "manajemen", 10, [r({ nama: "A" }), r({ nama: "B" })]);
    expect(u.totalKaryawan).toBe(10);
    expect(u.selesai).toBe(2);
    expect(u.belum).toBe(8);
    expect(u.persen).toBe(20);
  });

  it("satu orang dengan beberapa periode tetap dihitung sekali", () => {
    const u = rekapUnit("Manajemen (GWG)", "manajemen", 5, [
      r({ nama: "Budi", periode: "2026-07" }),
      r({ nama: "budi", periode: "2026-08" }),
    ]);
    expect(u.selesai).toBe(1);
  });

  it("penilaian scope lain tidak ikut terhitung", () => {
    const u = rekapUnit("Manajemen (GWG)", "manajemen", 5, [r({ nama: "A", scope: "outlet" })]);
    expect(u.selesai).toBe(0);
  });

  it("draf belum dihitung selesai", () => {
    const u = rekapUnit("Outlet", "outlet", 4, [r({ nama: "A", scope: "outlet", status: "draf" })]);
    expect(u.selesai).toBe(0);
    expect(u.belum).toBe(4);
  });

  it("penilaian karyawan yang sudah keluar tidak membuat persennya lewat 100", () => {
    const u = rekapUnit("Outlet", "outlet", 2, [
      r({ nama: "A", scope: "outlet" }),
      r({ nama: "B", scope: "outlet" }),
      r({ nama: "C", scope: "outlet" }),
    ]);
    expect(u.selesai).toBe(2);
    expect(u.persen).toBe(100);
    expect(u.belum).toBe(0);
  });

  it("unit tanpa karyawan memberi persen null, bukan nol atau NaN", () => {
    expect(rekapUnit("Outlet", "outlet", 0, []).persen).toBeNull();
  });
});

describe("periodeTerbanyak", () => {
  it("mengambil yang paling sering muncul", () => {
    expect(
      periodeTerbanyak([r({ periode: "2026-07" }), r({ periode: "2026-08" }), r({ periode: "2026-08" })]),
    ).toBe("2026-08");
  });

  it("mengabaikan periode kosong", () => {
    expect(periodeTerbanyak([r({ periode: "  " }), r({ periode: "2026-08" })])).toBe("2026-08");
  });

  it("tanpa data memberi teks kosong", () => {
    expect(periodeTerbanyak([])).toBe("");
  });
});

describe("statusSesiValid", () => {
  it("hanya menerima status yang dikenal", () => {
    expect(statusSesiValid("terjadwal")).toBe(true);
    expect(statusSesiValid("selesai")).toBe(true);
    expect(statusSesiValid("entah")).toBe(false);
  });
});
