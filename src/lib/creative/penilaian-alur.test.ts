import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Yang dijaga di sini bukan rumus skornya (itu ada di `penilaian-request.test.ts`),
 * melainkan hal-hal yang membuat dashboard-nya bisa dipercaya sebagai bahan
 * evaluasi: dari mana angkanya datang, kapan disimpan, dan siapa yang mengisi.
 * Semuanya tersebar di berkas yang berbeda, jadi tidak ada satu fungsi pun yang
 * bisa mengujinya — yang diperiksa bentuk sambungannya.
 */

const baca = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const aksi = baca("src/lib/actions/hc-requests.ts");
const data = baca("src/lib/data/creative-penilaian.ts");
const layar = baca("src/components/hc/request-review.tsx");
const nav = baca("src/lib/nav.ts");
const halaman = baca("src/app/(app)/creative/penilaian/page.tsx");
const migrasi = baca("supabase/migrations/0069_penilaian_request_design.sql");

describe("selisih hari tidak pernah disimpan", () => {
  it("tabelnya hanya menyimpan ceklis, bukan angka harinya", () => {
    // Angka yang disimpan bisa berbeda dari sumbernya begitu tanggalnya
    // diperbaiki, dan angka yang tidak cocok dengan sumbernya justru jadi bahan
    // perdebatan baru — persis yang hendak dihentikan dashboard ini.
    const kolom = migrasi.slice(migrasi.indexOf("create table"), migrasi.indexOf(");"));
    expect(kolom).toContain("tujuan_jelas");
    expect(kolom).not.toMatch(/\bhari\b|selisih|\bskor\b|\blabel\b/i);
  });

  it("dihitung ulang dari hc_requests setiap dibaca", () => {
    expect(data).toContain("nilaiPermintaan(dibuat, deadline, ceklis)");
    expect(data).toContain("planned_date");
    expect(data).toContain("created_at");
  });
});

describe("penilaian menempel pada penutupan permintaan", () => {
  it("disimpan SESUDAH hasilnya terkirim, tidak sebelum", () => {
    // Kalau disimpan lebih dulu, permintaan yang gagal terkirim tetap
    // meninggalkan nilai — pemohonnya kena angka atas desain yang tidak pernah
    // ia terima.
    for (const nama of ["submitDesignResultAction", "accDesignResultAction"]) {
      const blok = aksi.slice(aksi.indexOf(`export async function ${nama}`));
      const badan = blok.slice(0, blok.indexOf("\nexport async function", 1));
      const kirim = badan.indexOf("kirimHasilKePemohon");
      const simpan = badan.indexOf("simpanPenilaian");
      expect(kirim, `${nama}: pengiriman hasil tidak ditemukan`).toBeGreaterThan(-1);
      expect(simpan, `${nama}: penyimpanan penilaian tidak ditemukan`).toBeGreaterThan(kirim);
    }
  });

  it("gagal menyimpan nilai tidak menahan desainnya", () => {
    // Yang menunggu desainnya tidak boleh ikut tertahan gara-gara catatan
    // evaluasi gagal tersimpan.
    const blok = aksi.slice(aksi.indexOf("await simpanPenilaian("));
    expect(blok.slice(0, 600)).toContain("console.error");
    expect(aksi).not.toMatch(/if \(!nilai\.ok\) return/);
  });

  it("dua pintu penutup permintaan, dua-duanya menilai", () => {
    // Pengelola antrian yang mengerjakan sendiri hasilnya langsung terkirim
    // tanpa tahap ACC. Kalau penilaiannya cuma dipasang di dialog ACC, setiap
    // permintaan yang kebetulan ia kerjakan hilang dari dashboard.
    expect(aksi.match(/simpanPenilaian\(/g)?.length).toBe(2);
    expect(layar).toContain("function PenilaianPemohonPanel");
    expect(layar.match(/<PenilaianPemohonPanel/g)?.length).toBe(2);
  });

  it("hasil yang DIKEMBALIKAN ke designer tidak ikut menilai pemohon", () => {
    // Permintaannya belum selesai di titik itu; menilai pemohon berarti menilai
    // sesuatu yang belum berakhir.
    expect(layar).toContain("...(approve ? { ceklis, catatanNilai } : {})");
  });

  it("yang belum boleh meloloskan hasil tidak diminta menilai", () => {
    // Designer biasa mengirim hasilnya untuk diperiksa. Ia bukan penilainya,
    // dan penilai yang berbeda-beda membuat angka antar-outlet tidak bisa
    // dibandingkan sama sekali.
    expect(layar).toContain("...(kelola ? { ceklis, catatanNilai } : {})");
    expect(layar).toContain("{kelola && (\n            <PenilaianPemohonPanel");
  });
});

describe("hanya permintaan selesai yang masuk hitungan", () => {
  it("yang masih berjalan tidak dihitung nol", () => {
    // Memasukkannya sebagai nol berarti menuduh orang atas pekerjaan yang belum
    // kelar.
    expect(data).toContain('String(r.status ?? "") === "terlaksana"');
  });

  it("yang selesai tapi belum dinilai dihitung terpisah, bukan dibuang", () => {
    // Itulah sisa pekerjaan penilainya — kalau disembunyikan, dashboard tampak
    // lengkap padahal separuh permintaannya belum pernah dilihat.
    expect(data).toContain("belumDinilai");
  });
});

describe("menunya terdaftar utuh", () => {
  it("terdaftar di union, sidebar, dan daftar menu divisi", () => {
    // Menu yang lupa didaftarkan di salah satunya tetap bisa dibuka lewat URL
    // tapi tidak pernah muncul di sidebar siapa pun.
    expect(nav).toContain('| "creative_penilaian"');
    expect(nav).toContain('key: "creative_penilaian"');
    expect(nav).toMatch(/menus: \["creative_penilaian"\]/);
    expect(nav).toContain('{ division: "Creative", menus: ["work", "creative_design", "creative_penilaian"] }');
  });

  it("halamannya dijaga menunya sendiri", () => {
    expect(halaman).toContain('canReachMenu(user, "creative_penilaian")');
    expect(halaman).toContain("redirect(\"/dashboard\")");
  });
});
