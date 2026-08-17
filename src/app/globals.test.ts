import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga terhadap halaman yang bisa digeser ke samping.
 *
 * Keluhannya berulang dan selalu sama: normal di Android, tembus layar di
 * iPhone. Sebabnya bukan tata letaknya — sudah diukur dengan peramban sungguhan
 * di lebar 360/375/390 dan bersih, bahkan saat seluruh teksnya diganti kalimat
 * panjang. Sebabnya CSS:
 *
 *  • `overflow-x: clip` baru dikenal Safari 16. Di iPhone yang lebih lama
 *    barisnya dibuang mentah-mentah, dan halamannya kembali bisa digeser.
 *  • `dvh` juga baru ada di Safari 15.4. Tanpanya tinggi kerangka jatuh ke
 *    `auto` dan seluruh patokan tingginya hilang.
 *
 * Cadangannya TIDAK boleh ditulis sebagai dua baris berturut-turut. Pengecil
 * CSS menggabungkan dua deklarasi properti yang sama menjadi satu, dan yang
 * tersisa justru yang modern — cadangannya lenyap tepat di peramban yang
 * membutuhkannya. Itu benar-benar terjadi dan baru ketahuan setelah hasil build
 * diperiksa. Karena itu semuanya dibungkus `@supports`, yang tidak bisa
 * digabung.
 *
 * Uji ini membaca sumbernya, bukan hasil buildnya, supaya berjalan cepat —
 * dan berteriak begitu ada yang "merapikan" pasangan yang terlihat mubazir.
 */
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Buang komentar supaya penjelasan di dalamnya tidak ikut terbaca sebagai aturan. */
const isi = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

describe("cadangan CSS untuk Safari lama", () => {
  it("html dan body dikunci dengan `hidden`, bukan hanya `clip`", () => {
    expect(isi).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it("versi `clip` dibungkus @supports, bukan ditulis berdampingan", () => {
    expect(isi).toMatch(/@supports\s*\(overflow-x:\s*clip\)/);
    // Dua deklarasi berdampingan = pasti digabung pengecil CSS.
    expect(isi).not.toMatch(/overflow-x:\s*hidden;\s*overflow-x:\s*clip/);
  });

  it("utility clip-x punya cadangan dan versi modernnya", () => {
    expect(isi).toMatch(/@utility\s+clip-x\s*\{[^}]*overflow-x:\s*hidden/);
    expect(isi).toMatch(/@supports\s*\(overflow-x:\s*clip\)\s*\{\s*\.clip-x/);
  });

  it("tinggi satu layar punya cadangan vh sebelum dvh", () => {
    expect(isi).toMatch(/@utility\s+h-layar\s*\{[^}]*height:\s*100vh/);
    expect(isi).toMatch(/@supports\s*\(height:\s*100dvh\)\s*\{\s*\.h-layar/);
    expect(isi).not.toMatch(/height:\s*100vh;\s*height:\s*100dvh/);
  });

  it("body tetap punya tinggi minimum walau dvh tidak dikenal", () => {
    expect(isi).toMatch(/min-height:\s*100vh/);
    expect(isi).toMatch(/@supports\s*\(min-height:\s*100dvh\)/);
  });
});
