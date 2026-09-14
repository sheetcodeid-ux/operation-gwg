import { describe, expect, it } from "vitest";
import { angkaKetik, angkaKetikNol } from "./input-satuan";

/**
 * Angka yang diketik orang Indonesia — titik ribuan, koma desimal.
 *
 * Pembacaan sebelumnya memakai aturan Inggris, dan akibatnya sudah tersimpan:
 * Like+Komentar+Share+Save bulan Agustus tercatat 27,908 padahal yang diketik
 * dua puluh tujuh ribu sembilan ratus delapan. Angka seribu kali lebih kecil
 * seperti itu tetap terlihat sah di layar, dan tidak ada yang memeriksanya lagi.
 */
describe("angkaKetik", () => {
  it("titik memisahkan ribuan", () => {
    expect(angkaKetik("27.908")).toBe(27908);
    expect(angkaKetik("1.234.567")).toBe(1234567);
    expect(angkaKetik("159.729")).toBe(159729);
  });

  it("koma memisahkan desimal", () => {
    expect(angkaKetik("7,5")).toBe(7.5);
    expect(angkaKetik("-178,50")).toBe(-178.5);
    expect(angkaKetik("1.234,5")).toBe(1234.5);
  });

  it("titik yang jelas bukan ribuan tetap dibaca desimal", () => {
    // Dua angka di belakang titik bukan bentuk pemisah ribuan mana pun.
    expect(angkaKetik("-178.50")).toBe(-178.5);
    expect(angkaKetik("0.5")).toBe(0.5);
    expect(angkaKetik("7.5")).toBe(7.5);
  });

  it("minus terbaca apa adanya", () => {
    expect(angkaKetik("-25")).toBe(-25);
    expect(angkaKetik("-1.000")).toBe(-1000);
  });

  it("kosong bukan nol", () => {
    // Kosong berarti belum diisi; nol berarti diisi nol. Keduanya ditangani
    // berbeda oleh mesin hitungnya, jadi tidak boleh disamakan di sini.
    expect(angkaKetik("")).toBeNull();
    expect(angkaKetik("   ")).toBeNull();
    expect(angkaKetik("-")).toBeNull();
    expect(angkaKetikNol("")).toBe(0);
  });

  it("satuan yang ikut terketik tidak membatalkan angkanya", () => {
    expect(angkaKetik("Rp 1.500.000")).toBe(1500000);
    expect(angkaKetik("25%")).toBe(25);
    expect(angkaKetik("-25 %")).toBe(-25);
  });
});
