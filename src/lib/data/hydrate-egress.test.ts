import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HYDRATE = readFileSync(join(process.cwd(), "src/lib/data/hydrate.ts"), "utf8");

/**
 * Penjaga terhadap kejadian yang mematikan produksi pada 20 Agustus 2026.
 *
 * Hidrasi menarik seluruh isi enam tabel sekaligus (±1,5 MB mentah, lebih besar
 * setelah jadi JSON). Dengan TTL 3 detik, satu instance yang terus dipakai
 * menarik puluhan MB per menit, dan Vercel menjalankan banyak instance. Jatah
 * egress Supabase paket gratis — 5 GB — terpakai 38,5 GB, dan Supabase
 * memblokir SELURUH project: tidak ada yang bisa login, dan aplikasi jatuh ke
 * data contoh tanpa satu pun peringatan.
 *
 * Uji ini tidak bisa mencegah kuota habis. Yang dijaganya lebih sempit dan
 * lebih penting: angka TTL tidak boleh dikecilkan lagi tanpa seseorang membaca
 * alasannya lebih dulu. Nilai kecil di sana terlihat seperti pilihan yang wajar
 * — "supaya datanya segar" — dan justru itu yang membuatnya berbahaya.
 */
describe("egress hidrasi", () => {
  it("TTL punya lantai minimal, tidak bisa disetel jadi sangat kecil", () => {
    // Batas bawahnya ditegakkan di kode, bukan sekadar dianjurkan di komentar:
    // variabel lingkungan bisa diisi siapa saja yang memegang akses Vercel.
    expect(HYDRATE).toMatch(/HYDRATION_TTL_MS\s*=\s*Math\.max\(\s*5_?000/);
  });

  it("TTL bawaannya puluhan detik, bukan hitungan detik", () => {
    const cocok = HYDRATE.match(/HYDRATION_TTL_MS\s*=\s*Math\.max\(.*\|\|\s*([0-9_]+)/);
    expect(cocok, "bentuk penulisan TTL berubah — perbarui ujinya").toBeTruthy();
    expect(Number(cocok![1].replace(/_/g, ""))).toBeGreaterThanOrEqual(30_000);
  });

  it("alasannya ikut tertulis, supaya yang mengubahnya tahu taruhannya", () => {
    expect(HYDRATE).toContain("egress");
    expect(HYDRATE).toContain("5 GB");
  });

  it("data acuan tetap punya jam yang lebih lambat daripada data harian", () => {
    const ref = HYDRATE.match(/REFERENCE_TTL_MS\s*=\s*([0-9_]+)/);
    expect(ref).toBeTruthy();
    expect(Number(ref![1].replace(/_/g, ""))).toBeGreaterThanOrEqual(30_000);
  });

  it("kolom berat tetap tidak ikut ditarik tiap hidrasi", () => {
    // Avatar (base64 200 kB+) dan foto hygiene adalah dua hal terberat di
    // basis data ini. Sekali saja keduanya masuk daftar kolom hidrasi,
    // egress-nya melonjak berkali-kali lipat lagi.
    expect(HYDRATE).not.toMatch(/HYGIENE_COLUMNS\s*=\s*"[^"]*photos/);
    expect(HYDRATE).not.toMatch(/USER_COLUMNS\s*=\s*"[^"]*avatar/);
  });
});
