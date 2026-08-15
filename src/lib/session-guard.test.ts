import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga terhadap crash saat sesi kedaluwarsa.
 *
 * Halaman dulu menulis `(await getSessionUser())!`. Tanda seru itu hanya
 * membungkam TypeScript; saat aplikasi berjalan nilainya benar-benar null
 * begitu sesi habis, lalu halaman menabrak `user.role` dan pengguna melihat
 * layar error alih-alih halaman login. Redirect di layout tidak menolong,
 * karena layout dan halaman dirender BERSAMAAN.
 *
 * Aturannya: halaman di dalam `(app)` memakai `requireSessionUser()`, yang
 * mengarahkan ke `/clear-session` bila sesinya tidak sah.
 */

const APP = join(process.cwd(), "src/app");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(APP);
const rel = (f: string) => f.replace(process.cwd() + "/", "");

describe("penjaga sesi di halaman", () => {
  it("tidak ada halaman yang memakai tanda seru pada getSessionUser()", () => {
    const offenders = files
      .filter((f) => /getSessionUser\(\)\s*\)?\s*!/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("halaman yang butuh sesi memakai requireSessionUser()", () => {
    const offenders = files
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        if (!src.includes("getSessionUser(")) return false;
        // Boleh dipakai langsung HANYA kalau hasil null-nya benar-benar ditangani.
        if (/if\s*\(!\s*\w+\)/.test(src) || src.includes("requireSessionUser")) return false;
        // Rantai opsional juga menangani null. Rute yang memang boleh diakses
        // tanpa sesi — misalnya penampung laporan galat, yang justru dipanggil
        // dari halaman login — cukup menulis `user?.id`, dan memaksanya memakai
        // `if (!user)` malah membuatnya menolak laporan yang ingin dikumpulkan.
        // Yang diperiksa: variabelnya tidak pernah dibaca dengan titik biasa.
        const nama = /(?:const|let)\s+(\w+)\s*=\s*await\s+getSessionUser\(/.exec(src)?.[1];
        return !nama || new RegExp(`\\b${nama}\\s*\\.`).test(src);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("requireSessionUser mengarahkan ke pembersih sesi, bukan mengembalikan null", () => {
    const auth = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");
    const fn = auth.slice(auth.indexOf("export async function requireSessionUser"));
    expect(fn).toContain('redirect("/clear-session")');
    // Tipe kembaliannya tidak boleh mengizinkan null — itu yang membuat
    // pemanggilnya merasa perlu memakai tanda seru.
    expect(fn).toMatch(/Promise<UserProfile>/);
  });
});
