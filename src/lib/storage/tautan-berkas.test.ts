import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga terhadap "ExpiredRequest — Request has expired".
 *
 * Foto hasil design dibuka beberapa hari setelah selesai, dan yang muncul
 * bukan gambarnya melainkan jawaban mentah dari penyimpanan. Sebabnya: halaman
 * menanam presigned URL berumur satu jam, sementara tab PWA-nya bisa
 * menganggur berhari-hari.
 *
 * Uji ini menjaga bentuk perbaikannya, bukan sekadar gejalanya: yang ditanam
 * ke halaman harus alamat aplikasi, dan penandatanganan harus terjadi di rute
 * yang memeriksa hak akses lebih dulu.
 */

const baca = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const DATA = baca("src/lib/data/hc-requests.ts");
const RUTE = baca("src/app/api/berkas/pengajuan/[id]/route.ts");
const TIKET = baca("src/app/api/berkas/tiket/[id]/route.ts");
const BERSAMA = baca("src/lib/storage/berkas-rute.ts");

describe("daftar pengajuan tidak menanam tanda tangan", () => {
  it("tidak lagi menandatangani lampiran saat memuat daftar", () => {
    expect(DATA).not.toContain("presignGet");
    expect(DATA).not.toContain("createSignedUrls");
  });

  it("menanam alamat aplikasi yang tidak punya masa berlaku", () => {
    expect(DATA).toContain("/api/berkas/pengajuan/");
  });

  it("jalur berkas dikodekan, bukan disambung apa adanya", () => {
    // Nama berkas mengandung spasi, tanda kurung, dan tanda tanya. Menyambung
    // tanpa encodeURIComponent memotong jalurnya di karakter pertama yang
    // punya arti khusus di URL, dan berkasnya tidak pernah ketemu.
    expect(DATA).toMatch(/encodeURIComponent\(r\.id\)/);
    expect(DATA).toMatch(/encodeURIComponent\(a\.path\)/);
  });
});

describe("rute berkas memeriksa dulu, menandatangani kemudian", () => {
  it("menolak tanpa sesi", () => {
    expect(RUTE).toContain("getSessionUser");
    expect(RUTE).toMatch(/if\s*\(!user\)/);
  });

  it("memeriksa hak akses atas pengajuannya", () => {
    expect(RUTE).toContain("canSeeRequest");
  });

  it("hanya melayani berkas yang memang milik pengajuan itu", () => {
    // Tanpa ini, siapa pun yang boleh membuka SATU pengajuan bisa menukar
    // parameter `p` dengan kunci apa pun di dalam bucket.
    expect(RUTE).toMatch(/attachments\.find\(/);
  });

  it("menandatangani saat diklik, dengan umur pendek", () => {
    expect(BERSAMA).toContain("presignGet");
    const ttl = /const BERKAS_TTL = ([^;]+);/.exec(BERSAMA)?.[1] ?? "";
    expect(ttl, "BERKAS_TTL tidak ditemukan").not.toBe("");
    // eslint-disable-next-line no-eval
    const detik = eval(ttl) as number;
    // Cukup untuk satu pengalihan, tidak cukup untuk dipakai ulang esok hari.
    expect(detik).toBeGreaterThan(0);
    expect(detik).toBeLessThanOrEqual(60 * 15);
  });

  it("kegagalan dijawab sebagai halaman, bukan JSON mentah", () => {
    // Tautan ini dibuka di tab peramban; JSON di sana terbaca sebagai teks
    // mentah yang membingungkan — persis kesalahan yang sedang diperbaiki.
    expect(BERSAMA).toContain("text/html");
    for (const src of [RUTE, TIKET, BERSAMA]) expect(src).not.toMatch(/NextResponse\.json/);
  });

  it("pengalihan hanya boleh disimpan lebih pendek dari tanda tangannya", () => {
    // Kalau peramban boleh memakai ulang pengalihan LEBIH LAMA dari umur tanda
    // tangannya, ia akan mengantar ke tautan yang sudah mati — kegagalan yang
    // sedang diperbaiki, hanya dengan jeda yang lebih pendek.
    expect(BERSAMA).toContain("private");
    // eslint-disable-next-line no-eval
    const ttl = eval(/const BERKAS_TTL = ([^;]+);/.exec(BERSAMA)![1]) as number;
    const cache = Number(/const CACHE_DETIK = (\d+);/.exec(BERSAMA)?.[1] ?? NaN);
    expect(Number.isFinite(cache)).toBe(true);
    expect(cache).toBeLessThan(ttl);
  });
});

describe("tiket System & IT Help Desk memakai jalan yang sama", () => {
  it("daftar tiket tidak lagi menanam tanda tangan", () => {
    const data = baca("src/lib/data/system.ts");
    expect(data).not.toContain("presignGet");
    expect(data).toContain("/api/berkas/tiket/");
  });

  it("rutenya memeriksa pemohon atau penangan mejanya", () => {
    expect(TIKET).toMatch(/if\s*\(!user\)/);
    expect(TIKET).toContain("bolehBukaTiket");
  });

  it("hanya melayani berkas yang tercatat pada tiket itu", () => {
    expect(TIKET).toContain("berkasSah");
  });
});
