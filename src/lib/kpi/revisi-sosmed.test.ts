import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEPARTEMEN, POSISI } from "./struktur";

describe("Sosial Media berdiri sendiri", () => {
  const dep = (kode: string) => DEPARTEMEN.find((d) => d.kode === kode);

  it("punya departemennya sendiri di Detail KPI Divisi", () => {
    // Digabung dengan Marketing Communication, satu angka rata-rata menutupi
    // sisi mana yang sebenarnya turun — dan yang membaca tidak punya cara tahu
    // harus memperbaiki yang mana.
    expect(dep("sosmed")?.posisi).toEqual(["creative_sosmed"]);
  });

  it("Marketing Communication tinggal posisinya sendiri", () => {
    expect(dep("marcomm")?.posisi).toEqual(["marcomm"]);
  });

  it("kode posisinya tidak berubah, supaya riwayatnya tidak putus", () => {
    // Seluruh kpi_entri dan kpi_actual tersimpan dengan kode ini. Menggantinya
    // membuat bulan-bulan sebelumnya terbaca kosong.
    const p = POSISI.find((x) => x.kode === "creative_sosmed");
    expect(p?.departemen).toBe("sosmed");
  });
});

describe("angka minus dan satuannya", () => {
  const mesin = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");

  it("keterangan actual minus menyebut angkanya lengkap dengan satuan", () => {
    expect(mesin).toContain("Actual-nya minus");
    expect(mesin).toContain("bersatuan(actual, i.satuan)");
  });

  it("target pertumbuhan yang buntu tidak menyuruh hal yang tidak bisa dikerjakan", () => {
    // Kolom Target indikator "tumbuh" TERKUNCI di dialog Pengaturan — menyuruh
    // orang menetapkan target tetap di situ adalah perintah yang tidak mungkin
    // dijalankan, dan itulah yang membuat keterangannya terbaca ngawur.
    expect(mesin).not.toContain("tetapkan target tetap lewat Pengaturan");
    expect(mesin).toContain("baru terhitung lagi begitu ada bulan yang capaiannya positif");
  });
});
