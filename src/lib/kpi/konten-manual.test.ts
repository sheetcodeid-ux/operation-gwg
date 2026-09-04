import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDIKATOR } from "./indikator";

/**
 * Jumlah Konten Post/Reels/Story DIISI TANGAN.
 *
 * Pernah dibuat otomatis dari Antrian Design, lalu dibatalkan atas permintaan
 * pemiliknya. Alasannya sah dan tidak perlu ditawar: satu permintaan design
 * tidak selalu menjadi satu unggahan, dan angka yang datang sendiri tanpa bisa
 * dicocokkan dengan apa yang benar-benar tayang lebih berbahaya daripada kolom
 * yang jelas-jelas kosong.
 *
 * Berkas ini menjaga keputusan itu. Otomatisasi seperti ini gampang kembali
 * diam-diam — biasanya dengan niat baik "biar tidak perlu diketik" — dan
 * begitu kembali, tidak ada yang akan menyadari angkanya bukan lagi angka yang
 * dilaporkan orang.
 */

const kunci = ["konten_post", "konten_reels", "konten_story"];
const data = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");

describe("sumber angkanya", () => {
  it("ketiganya diisi per brand, bukan dihitung sistem", () => {
    for (const [posisi, daftar] of Object.entries(INDIKATOR)) {
      for (const i of daftar) {
        if (!kunci.includes(i.key)) continue;
        expect(i.actual, `${posisi}/${i.key} tidak lagi manual`).toEqual({ sumber: "manual_brand" });
      }
    }
  });

  it("tidak ada satu pun jalan dari Antrian Design ke Jumlah Konten", () => {
    expect(existsSync(join(process.cwd(), "src/lib/kpi/konten.ts"))).toBe(false);
    for (const jejak of ["INDIKATOR_KONTEN", "kontenDariDesign", "hitungKonten", "kontenOtomatis"]) {
      expect(data, `${jejak} kembali muncul`).not.toContain(jejak);
    }
  });

  it("angka manual yang belum diisi tetap kosong, tidak diisi nol", () => {
    // Nol berarti "tidak ada konten sama sekali bulan ini" — tuduhan yang
    // berbeda jauh dari "belum diisi".
    expect(data).toContain('alasan = "Angkanya belum diisi untuk bulan ini.";');
  });
});
