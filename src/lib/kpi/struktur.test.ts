import { describe, expect, it } from "vitest";
import { DEPARTEMEN, POSISI, posisiDari } from "./struktur";

/**
 * Penjaga struktur KPI — hal-hal yang sekali salah membuat orang dibayar dua
 * kali, atau tidak dibayar sama sekali.
 */

describe("satu orang, satu posisi", () => {
  it("tidak ada nama yang tercantum di dua posisi sekaligus", () => {
    // Dita dan Marta pernah tercantum di Marketing Communication DAN Sosial
    // Media. Akibatnya keduanya muncul dua kali di daftar pencairan, dengan
    // angka yang berbeda — dan yang membayar tidak punya cara tahu mana yang
    // benar. Keduanya Social Media; barisnya di Marketing Communication yang
    // dihapus.
    const dimana = new Map<string, string[]>();
    for (const p of POSISI) {
      for (const n of p.pic) {
        const k = n.trim().toLowerCase();
        dimana.set(k, [...(dimana.get(k) ?? []), p.nama]);
      }
    }
    const ganda = [...dimana.entries()].filter(([, ps]) => ps.length > 1);
    expect(ganda).toEqual([]);
  });

  it("Dita dan Marta hanya di Sosial Media", () => {
    const sosmed = posisiDari("creative_sosmed")!;
    const marcomm = posisiDari("marcomm")!;
    expect(sosmed.pic).toContain("Dita");
    expect(sosmed.pic).toContain("Marta");
    expect(marcomm.pic).not.toContain("Dita");
    expect(marcomm.pic).not.toContain("Marta");
  });

  it("Nanda tidak tercantum di posisi mana pun", () => {
    // Sudah resign. Nama yang tertinggal di dasar pembayaran adalah kesalahan
    // yang paling mahal dari seluruh berkas ini.
    const semua = POSISI.flatMap((p) => p.pic).map((n) => n.trim().toLowerCase());
    expect(semua).not.toContain("nanda");
  });
});

describe("Head tidak punya posisi KPI sendiri", () => {
  it("tidak ada posisi bernama Head", () => {
    // Capaian Head adalah rata-rata KPI orang-orang divisinya — keputusan
    // pemilik. Posisi Head dengan indikatornya sendiri berarti dua angka untuk
    // satu orang.
    expect(POSISI.filter((p) => /head/i.test(p.nama))).toEqual([]);
  });

  it("Product Development & Quality tinggal tiga posisi staf", () => {
    const pdq = DEPARTEMEN.find((d) => d.kode === "pdq")!;
    expect([...pdq.posisi].sort()).toEqual(["pdq_beverage", "pdq_food", "pdq_qc"]);
  });
});

describe("daftar posisi tetap utuh", () => {
  it("tiap posisi yang didaftar departemen benar-benar ada", () => {
    for (const d of DEPARTEMEN) {
      for (const kode of d.posisi) expect(posisiDari(kode), `${d.nama} → ${kode}`).toBeTruthy();
    }
  });

  it("tiap posisi terdaftar di departemennya", () => {
    for (const p of POSISI) {
      const d = DEPARTEMEN.find((x) => x.kode === p.departemen);
      expect(d?.posisi, `${p.nama}`).toContain(p.kode);
    }
  });
});
