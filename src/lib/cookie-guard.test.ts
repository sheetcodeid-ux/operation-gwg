import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga atas penanda keamanan cookie sesi.
 *
 * Cookie `gwg_uid` setara dengan kata sandi: memegang nilainya berarti masuk
 * sebagai orang itu selama seminggu. Tiga penanda yang menjaganya, dan
 * ketiganya pernah atau bisa hilang tanpa terlihat karena semuanya hanya satu
 * baris di satu objek:
 *
 *  • httpOnly — menghalangi skrip di halaman membacanya.
 *  • sameSite — menghalangi situs lain ikut mengirimkannya.
 *  • secure   — menghalangi peramban mengirimkannya lewat http biasa.
 *
 *  `secure` yang paling mudah terlupa, dan akibatnya paling sunyi: aplikasinya
 *  tetap berjalan normal, hanya saja cookie-nya bisa tersalin oleh siapa pun
 *  yang sejaringan begitu ada satu permintaan http yang lewat.
 */
const AUTH = join(process.cwd(), "src/lib/actions/auth.ts");

describe("penanda keamanan cookie sesi", () => {
  const src = readFileSync(AUTH, "utf8");
  const opts = src.slice(src.indexOf("const COOKIE_OPTS"), src.indexOf("/** Demo sign-in"));

  it("cookie sesi hanya boleh dikirim lewat https saat produksi", () => {
    expect(opts).toMatch(/secure:\s*process\.env\.NODE_ENV\s*===\s*"production"/);
  });

  it("cookie sesi tidak boleh terbaca oleh skrip halaman", () => {
    expect(opts).toMatch(/httpOnly:\s*true/);
  });

  it("cookie sesi tidak boleh ikut terkirim dari situs lain", () => {
    expect(opts).toMatch(/sameSite:\s*"(lax|strict)"/);
  });

  it("hanya ada SATU tempat yang menyetel cookie sesi", () => {
    // Kalau muncul objek pilihan kedua, penanda di atas bisa benar di satu
    // tempat dan hilang di tempat lain tanpa ketahuan uji ini.
    expect(src.match(/const COOKIE_OPTS/g)?.length ?? 0).toBe(1);
    // Sampai akhir baris, bukan sampai kurung tutup pertama — kurung tutup itu
    // milik `signSession(...)` di dalamnya, bukan penutup `.set(...)`.
    const penyetel = src.match(/\.set\(SESSION_COOKIE.*$/gm) ?? [];
    expect(penyetel.length).toBeGreaterThan(0);
    for (const s of penyetel) expect(s).toContain("COOKIE_OPTS");
  });
});
