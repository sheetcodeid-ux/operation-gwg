import { describe, expect, it } from "vitest";
import { actualBersatuan, bersatuan } from "./satuan";

/**
 * Kolom Actual: kosong ditulis NOL, bukan tanda pisah.
 *
 * Diminta pemiliknya. Yang dijaga di sini bukan cuma bentuk tulisannya,
 * melainkan bahwa perubahan itu TIDAK merembet ke kolom Target — target yang
 * belum ditetapkan bukan target nol, dan menulisnya nol membuat setiap
 * indikator terbaca tercapai penuh oleh mata sebelum angkanya dibaca.
 */
describe("actualBersatuan", () => {
  it("kosong jadi nol, mengikuti satuan indikatornya", () => {
    expect(actualBersatuan(null)).toBe("0");
    expect(actualBersatuan(null, "angka")).toBe("0");
    expect(actualBersatuan(null, "persen")).toBe("0%");
  });

  it("nol sungguhan ditulis sama dengan kosong — keduanya memang nol capaian", () => {
    expect(actualBersatuan(0, "persen")).toBe(actualBersatuan(null, "persen"));
    expect(actualBersatuan(0)).toBe(actualBersatuan(null));
  });

  it("angka yang ada tetap ditulis apa adanya — desimalnya tidak dibulatkan hilang", () => {
    // Dibulatkan ke bilangan bulat, Manajemen Kinerja 18,18% muncul sebagai
    // "18%" dan tidak lagi cocok dengan laporan Human Capital yang menulis dua
    // angka di belakang koma. Yang bulat tetap ditulis bulat.
    expect(actualBersatuan(83.87, "persen")).toBe("83,87%");
    expect(actualBersatuan(18.18, "persen")).toBe("18,18%");
    expect(actualBersatuan(100, "persen")).toBe("100%");
    expect(actualBersatuan(4)).toBe("4");
  });

  it("Target tetap memakai tanda pisah saat belum ada", () => {
    expect(bersatuan(null)).toBe("—");
    expect(bersatuan(null, "persen")).toBe("—");
  });
});
