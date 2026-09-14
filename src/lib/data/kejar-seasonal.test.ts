import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PENARIK LUBANG DAILY yang dipakai dua pintu sekaligus: tombol di layar dan
 * cron. Perbedaan kedua pintu itulah yang sudah sekali menjatuhkannya.
 *
 * Lewat layar, daftar outlet sudah dimuat sebelum halamannya dirender — sesi
 * yang masuk memicunya. Lewat cron tidak ada yang memicunya, karena rutenya
 * memang tidak membaca sesi siapa pun. Jadi penarikan yang benar di layar bisa
 * pulang kosong tiap sepuluh menit di cron, dan itu benar-benar terjadi:
 * "Tidak ada outlet ber-ID cabang ESB" pada dua jalan pertama sesudah tayang.
 */

const kejar = readFileSync(join(process.cwd(), "src/lib/data/kejar-seasonal.ts"), "utf8");
const rute = readFileSync(join(process.cwd(), "src/app/api/cron/fraud-sync/route.ts"), "utf8");
const aksi = readFileSync(join(process.cwd(), "src/lib/actions/kejar-daily.ts"), "utf8");

describe("daftar outlet dimuat lebih dulu", () => {
  it("hidrasi dipanggil SEBELUM outlet dibaca", () => {
    const iHidrasi = kejar.indexOf("await ensureHydrated();");
    const iCabang = kejar.indexOf("const cabang = cabangDaily();");
    expect(iHidrasi).toBeGreaterThan(-1);
    expect(iCabang).toBeGreaterThan(iHidrasi);
  });

  it("hidrasi yang belum pernah berhasil menghentikan penarikan", () => {
    // Data contoh punya outlet juga. Menariknya berarti mengisi Daily dengan
    // cabang yang tidak ada — lebih buruk daripada tidak menarik sama sekali.
    expect(kejar).toContain("if (!hidrasiPernahBerhasil())");
    expect(kejar).toContain("Data outlet belum termuat dari basis data.");
  });
});

describe("satu penarik untuk dua pintu", () => {
  it("cron memakainya, bukan salinan perulangannya sendiri", () => {
    expect(rute).toContain('await import("@/lib/data/kejar-seasonal")');
    // Kursor cabang lama sudah tidak dipakai di mana pun: lubangnya sendiri
    // yang jadi penunjuk tempat, jadi dua jalan yang tumpang tindih tidak bisa
    // saling melewatkan bagian.
    expect(rute).not.toContain("seasonal_branch_cursor");
  });

  it("tombol di layar memakai penarik yang sama", () => {
    expect(aksi).toContain('import { kejarLubangDaily } from "@/lib/data/kejar-seasonal"');
  });

  it("tombol MENUNGGU kunci ESB, tidak langsung menyerah", () => {
    // Berpapasan dengan cron tidak boleh menghentikan pengejaran otomatis:
    // cron lepas dalam hitungan detik.
    expect(aksi).toContain("async function tungguKunci()");
    expect(aksi).toContain("if (Date.now() >= batas) return false;");
  });
});
