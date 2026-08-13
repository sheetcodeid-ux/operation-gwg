import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const READ = readFileSync(join(process.cwd(), "src/lib/data/hygiene-read.ts"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(app)/hygiene/page.tsx"), "utf8");
const HYDRATE = readFileSync(join(process.cwd(), "src/lib/data/hydrate.ts"), "utf8");

/**
 * "Sudah upload tapi tidak ada di tabel" — keluhan yang muncul hampir tiap
 * hari dari supervisor yang berbeda-beda.
 *
 * Datanya SELALU tersimpan; yang salah cara membacanya. Tiap instance
 * serverless memegang salinan tabel di memori, dan `router.refresh()` sesudah
 * simpan bisa mendarat di instance lain yang salinannya belum memuat baris
 * baru — instance itu menyajikan snapshot lamanya lebih dulu lalu menyegarkan
 * di latar, sehingga jawabannya terkirim tanpa audit yang barusan dibuat.
 */
describe("audit hygiene dibaca otoritatif", () => {
  it("halaman membaca dari database, bukan dari salinan memori", () => {
    expect(PAGE).toContain("readHygiene(user,");
    expect(PAGE).not.toContain("listHygiene(user)");
  });

  it("cache memori memang menandai dirinya SEGAR setelah menulis", () => {
    // Bukan bug yang tersembunyi — ini disengaja untuk mencegah kedipan di
    // instance yang menulis. Justru karena itu halaman tulis-lalu-baca tidak
    // boleh bergantung padanya.
    expect(HYDRATE).toContain("export function markLocalWrite()");
    expect(HYDRATE).toContain("state.at = Date.now();");
  });

  it("dibatasi outlet yang boleh dilihat, dan daftar kosong berarti kosong", () => {
    // Keliru di sini membuka audit seluruh cabang ke satu supervisor.
    expect(READ).toContain("scopeOutlets(user, getOutlets())");
    expect(READ).toContain("if (ids.length === 0) return [];");
  });

  it("tetap dibatasi per bulan supaya bebannya tidak tumbuh tiap hari", () => {
    expect(READ).toContain('q.gte("date", rentang.mulai).lt("date", rentang.selesai)');
  });

  it("memuat lebih dari 1000 baris tanpa terpotong diam-diam", () => {
    // PostgREST memotong di 1000 baris tanpa error; hygiene sudah 1500+.
    expect(READ).toContain("selectAll<");
  });

  it("database bermasalah TIDAK menghasilkan halaman kosong", () => {
    // Supervisor akan mengira auditnya hilang, lalu mengisi ulang.
    expect(READ).toContain("memakai salinan memori");
    expect(READ).toContain("return listHygiene(user);");
  });

  it("kolom ratings ikut dibaca — lembar PDF memerlukannya", () => {
    // `ratings` sengaja tidak ikut hidrasi karena berat, jadi lembar cetak
    // menampilkan "—" pada SETIAP butir penilaian sampai dibaca di sini.
    expect(READ).toContain("ratings");
    expect(HYDRATE).not.toContain("ratings,findings");
  });
});
