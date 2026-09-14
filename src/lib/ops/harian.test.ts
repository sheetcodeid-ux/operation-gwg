import { describe, expect, it } from "vitest";
import { barisHarian, bandingHarian, jumlahHari, kolomHari, totalHarian, urutHarian } from "./harian";

describe("kolom hari", () => {
  it("menghitung panjang bulannya, termasuk Februari kabisat", () => {
    expect(jumlahHari("2026-09")).toBe(30);
    expect(jumlahHari("2026-08")).toBe(31);
    expect(jumlahHari("2026-02")).toBe(28);
    expect(jumlahHari("2024-02")).toBe(29);
  });

  it("menandai akhir pekan", () => {
    const k = kolomHari("2026-09");
    expect(k).toHaveLength(30);
    expect(k[0].tanggal).toBe(1);
    // 1 September 2026 jatuh hari Selasa.
    expect(k[0].hari).toBe("SEL");
    expect(k[0].pekan).toBe(false);
    expect(k.filter((h) => h.pekan).every((h) => h.hari === "SAB" || h.hari === "MIN")).toBe(true);
  });
});

describe("baris harian", () => {
  const sumber = {
    outletId: "o1",
    nama: "Nordu Tebas",
    area: "Deo",
    hari: [100, 120, 90, null, null],
    hariLalu: [80, 100, 100, 100, 100],
  };

  it("pembandingnya sepanjang hari yang SUDAH ada angkanya", () => {
    // Tiga hari dibandingkan dengan tiga hari, bukan dengan lima. Kalau
    // pembandingnya sebulan penuh, setiap outlet selalu terbaca minus besar
    // sepanjang bulan berjalan — angka yang tidak pernah salah dan tidak
    // pernah berguna.
    const b = barisHarian(sumber);
    expect(b.bulanIni).toBe(310);
    expect(b.bulanLalu).toBe(280);
    expect(b.mom).toBeCloseTo((30 / 280) * 100, 6);
  });

  it("perubahan tiap hari dihitung terhadap hari sebelumnya", () => {
    const b = barisHarian(sumber);
    expect(b.ubah[0]).toBeNull();
    expect(b.ubah[1]).toBeCloseTo(20, 6);
    expect(b.ubah[2]).toBeCloseTo(-25, 6);
    // Hari yang belum ditarik tidak menghasilkan perubahan apa pun.
    expect(b.ubah[3]).toBeNull();
  });

  it("tanggal 1 dibandingkan dengan hari terakhir bulan lalu", () => {
    // Satu-satunya kolom yang tidak punya "hari sebelumnya" — dan justru
    // pergantian bulan yang paling sering ditanyakan.
    const b = barisHarian({ ...sumber, akhirBulanLalu: 50 });
    expect(b.ubah[0]).toBeCloseTo(100, 6);
    expect(barisHarian(sumber).ubah[0]).toBeNull();
  });

  it("hari yang belum ditarik bukan nol", () => {
    // Nol berarti outlet itu tidak berjualan sehari penuh — tuduhan yang
    // berbeda jauh dari "angkanya belum sampai".
    const b = barisHarian({ ...sumber, hari: [null, null, null, null, null] });
    expect(b.bulanIni).toBeNull();
    expect(b.mom).toBeNull();
  });
});

describe("banding", () => {
  it("dasar nol atau minus tidak bisa jadi pembagi", () => {
    expect(bandingHarian(0, 100)).toBeNull();
    expect(bandingHarian(-5, 100)).toBeNull();
    expect(bandingHarian(null, 100)).toBeNull();
    expect(bandingHarian(100, null)).toBeNull();
  });
});

describe("urutan dan total", () => {
  const buat = (id: string, hari: (number | null)[]) =>
    barisHarian({ outletId: id, nama: id, area: "", hari, hariLalu: hari.map(() => 10) });

  it("terbesar lebih dulu, yang tanpa angka paling belakang", () => {
    const hasil = urutHarian([buat("a", [10, 10]), buat("b", [null, null]), buat("c", [50, 50])]);
    expect(hasil.map((b) => b.outletId)).toEqual(["c", "a", "b"]);
  });

  it("total dijumlah per tanggal, bukan dirata-rata", () => {
    const t = totalHarian([buat("a", [10, 20]), buat("c", [30, 40])]);
    expect(t?.hari).toEqual([40, 60]);
    expect(t?.bulanIni).toBe(100);
  });

  it("tanpa outlet tidak ada total", () => {
    expect(totalHarian([])).toBeNull();
  });
});
