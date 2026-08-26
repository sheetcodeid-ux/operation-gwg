import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LABEL_MANAJEMEN, LABEL_MANAJEMEN_SINGKAT, kontrakManajemen } from "./kontrak";

/**
 * Kontrak Tracker untuk karyawan yang tidak punya outlet.
 *
 * `outlet_id` dulu NOT NULL, jadi modul ini hanya bisa memuat karyawan cabang.
 * Karyawan kantor pusat dan gudang tidak punya outlet sama sekali — kontrak
 * mereka tidak bisa dicatat dengan cara apa pun, dan satu-satunya modul yang
 * seharusnya menjawab "siapa kontraknya habis bulan depan" menjawabnya hanya
 * untuk sebagian orang.
 *
 * Yang dikunci di sini bukan tampilannya, melainkan dua hal yang kalau salah
 * akibatnya tidak kelihatan sampai terlambat: apa arti NULL, dan siapa yang
 * boleh melihat serta menulisnya.
 */

describe("NULL berarti Manajemen, bukan 'belum diisi'", () => {
  it("baris tanpa outlet adalah baris Manajemen", () => {
    expect(kontrakManajemen(null)).toBe(true);
    expect(kontrakManajemen(undefined)).toBe(true);
    expect(kontrakManajemen("")).toBe(true);
  });

  it("baris dengan outlet bukan Manajemen", () => {
    expect(kontrakManajemen("out_123")).toBe(false);
  });

  it("namanya ditetapkan sekali, bukan diketik ulang tiap layar", () => {
    expect(LABEL_MANAJEMEN).toContain("Manajemen");
    expect(LABEL_MANAJEMEN_SINGKAT).toBe("Manajemen");
  });
});

describe("Manajemen tidak ikut terbawa jangkauan outlet siapa pun", () => {
  const DATA = readFileSync(join(process.cwd(), "src/lib/data/hcmos.ts"), "utf8");
  const fn = DATA.slice(DATA.indexOf("export async function listKontrak"), DATA.indexOf("export async function listUpdateBulanan"));

  it("baris Manajemen dibaca terpisah, dengan syaratnya sendiri", () => {
    // Kalau ikut kueri outlet, seorang supervisor cabang akan melihat kontrak
    // seluruh kantor pusat begitu kolomnya dilonggarkan.
    expect(fn).toContain('.is("outlet_id", null)');
    expect(fn).toContain("bolehUbahHc(user)");
  });

  it("cabang tetap dibatasi outlet yang jadi jangkauannya", () => {
    expect(fn).toContain('.in("outlet_id", ids)');
  });

  it("tidak ada outlet palsu bernama Kantor Pusat", () => {
    // Outlet palsu akan ikut terhitung di rekap cabang, di Update Bulanan
    // Supervisor, dan di setiap angka yang membagi sesuatu per outlet.
    expect(DATA).not.toContain('id: "manajemen"');
    expect(DATA).not.toMatch(/outlets\.push\(/);
  });
});

describe("wewenang menulis baris Manajemen", () => {
  const AKSI = readFileSync(join(process.cwd(), "src/lib/actions/hcmos.ts"), "utf8");

  it("ditentukan wewenang HC, bukan daftar outlet", () => {
    const fn = AKSI.slice(AKSI.indexOf("function bolehTulisBaris"), AKSI.indexOf("function bolehOutlet"));
    expect(fn).toContain("if (!outletId) return bolehUbahHc(user);");
  });

  it("Update Bulanan tetap menolak baris tanpa outlet", () => {
    // Laporan bulanan tanpa cabang bukan laporan apa pun — pemeriksaannya
    // sengaja tidak disatukan dengan pemeriksaan baris kontrak.
    const fn = AKSI.slice(AKSI.indexOf("function bolehOutlet"));
    expect(fn.slice(0, 300)).toContain("outletId: string)");
  });

  it("membedakan 'baris tidak ada' dari 'baris milik Manajemen'", () => {
    // Dicampur jadi satu null, baris Manajemen selalu ditolak dengan pesan
    // "data tidak ditemukan" — padahal ada, dan yang membukanya berhak.
    const DATA = readFileSync(join(process.cwd(), "src/lib/data/hcmos.ts"), "utf8");
    expect(DATA).toContain("export async function pemilikKontrak");
    expect(DATA).toContain("{ ada: false } | { ada: true; outletId: string | null }");
  });
});

describe("berkas diunggah, tidak ditempel sebagai tautan", () => {
  const BOARD = readFileSync(join(process.cwd(), "src/components/hcmos/kontrak-board.tsx"), "utf8");
  const UPLOADS = readFileSync(join(process.cwd(), "src/lib/actions/uploads.ts"), "utf8");

  it("ketiga isian https:// sudah diganti pemilih berkas", () => {
    expect(BOARD).not.toContain('placeholder="https://…"');
    expect(BOARD).toContain("<BerkasKontrak");
    expect(BOARD).toContain('uploadOne("kontrak"');
  });

  it("punya cakupan unggahnya sendiri, terikat menunya", () => {
    expect(UPLOADS).toContain('kontrak: ["hc_kontrak"]');
  });

  it("baris lama yang berisi tautan tetap bisa dibuka", () => {
    // Mengubahnya berarti mengunduh berkas orang lain dari Drive tanpa diminta.
    expect(BOARD).toContain("tautanLuar");
    const RUTE = readFileSync(join(process.cwd(), "src/app/api/berkas/kontrak/[id]/route.ts"), "utf8");
    expect(RUTE).toContain("alihkanKeBerkas(nilai)");
  });

  it("rute berkasnya memeriksa cakupan, bukan sekadar menu", () => {
    const RUTE = readFileSync(join(process.cwd(), "src/app/api/berkas/kontrak/[id]/route.ts"), "utf8");
    expect(RUTE).toContain("canAccessOutlet(user, baris.outletId");
    expect(RUTE).toContain("bolehUbahHc(user)");
  });
});
