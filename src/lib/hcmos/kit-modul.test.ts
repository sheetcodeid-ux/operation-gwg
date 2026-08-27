import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const baca = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

/**
 * Kit modul HC-MOS — bentuk yang sama untuk semua halaman Human Capital.
 *
 * Struktur Organisasi dan Matriks RACI dinaikkan lebih dulu dan keduanya
 * berakhir pada bentuk yang sama. Menyalin bentuk itu halaman demi halaman
 * berarti menyalin juga setiap perbaikan kecilnya satu per satu — dan halaman
 * yang terlewat perlahan berbeda sendiri tanpa ada yang menyadarinya.
 *
 * Yang dikunci di sini perilakunya, bukan tampilannya.
 */

describe("perilaku yang dijanjikan bingkai modul", () => {
  const KIT = baca("src/components/hcmos/kit-modul.tsx");

  it("penghitung n/total hanya muncul saat memang sedang menyaring", () => {
    // Ditampilkan terus, ia cuma mengulang jumlah yang sudah tertulis di
    // ringkasan — dan pembacanya berhenti mempercayainya sebagai penanda.
    expect(KIT).toContain("{menyaring && hitung && (");
  });

  it("tombol bersihkan tahu kapan dirinya berguna", () => {
    expect(KIT).toContain("{menyaring && onBersihkan && (");
  });

  it("layar penuh mendengarkan perubahannya, bukan cuma menyalakannya", () => {
    // Tanpa ini, keluar lewat Esc menyisakan tombol yang masih berkata
    // "keluar layar penuh" padahal sudah keluar.
    expect(KIT).toContain('document.addEventListener("fullscreenchange"');
    expect(KIT).toContain('document.removeEventListener("fullscreenchange"');
  });

  it("batang legenda dibandingkan terhadap yang terbesar, bukan terhadap total", () => {
    // Terhadap total, kategori kecil jadi garis tak terlihat dan legendanya
    // berhenti menjawab "mana yang paling banyak, seberapa jauh jaraknya".
    expect(KIT).toContain("const puncak = Math.max(1, ...butir.map((b) => b.jumlah));");
  });

  it("bingkainya tetap punya tinggi di halaman yang bukan layar penuh", () => {
    expect(KIT).toContain("min-h-[70vh]");
    expect(KIT).toContain("[&:fullscreen]:h-screen");
  });
});

describe("Kontrak Tracker memakai bingkai itu", () => {
  const BOARD = baca("src/components/hcmos/kontrak-board.tsx");
  const HALAMAN = baca("src/app/(app)/hc-mos/kontrak/page.tsx");

  it("bingkai, batang alat, legenda, dan layar penuh terpasang", () => {
    for (const bagian of ["KerangkaModul", "BilahModul", "LegendaHitung", "useLayarPenuh"]) {
      expect(BOARD, bagian).toContain(bagian);
    }
  });

  it("hanya ada satu kotak pencarian di layar", () => {
    // Dua kotak cari yang menyaring hal berbeda, dan yang satu tidak
    // menghitung yang lain, adalah cara tercepat membuat orang salah baca.
    expect(BOARD).toContain("showSearch={false}");
    expect(BOARD).not.toContain('searchPlaceholder="Cari karyawan…"');
  });

  it("legenda status dihitung dari seluruh baris, bukan dari yang tampak", () => {
    // Dihitung dari yang tampak, menyorot satu status membuat tiga lainnya
    // jatuh ke nol — dan legendanya tidak bisa dipakai untuk kembali.
    const fn = BOARD.slice(BOARD.indexOf("const rekapStatus"), BOARD.indexOf("const bersihkan"));
    expect(fn).toContain("[kontrak, brand]");
    expect(fn).not.toContain("kontrakTersaring");
  });

  it("halamannya tidak lagi punya kepala halaman yang mengulang judul", () => {
    expect(HALAMAN).not.toContain("PageHeader");
    // Konteks pilarnya tetap ada — itu tidak dibawa batang alat modulnya.
    expect(HALAMAN).toContain("KonteksModul");
  });
});
