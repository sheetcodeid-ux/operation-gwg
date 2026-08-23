import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isChunkLoadError, isVersiBasi, pesanGalatAksi } from "./chunk-recovery";
import { canReachMenu } from "./nav";

/**
 * Pengajuan Dokumen yang gagal tanpa menyebut sebabnya.
 *
 * Satu supervisor tidak bisa mengirim berhari-hari sementara supervisor lain
 * lancar di hari yang sama. Yang tampil di layarnya cuma "An error occurred in
 * the Server Components render. The specific message is omitted in production
 * builds" — kalimat yang tidak menyebut apa pun yang bisa ditindaklanjuti, dan
 * membuat orang menekan tombolnya berulang-ulang.
 *
 * Yang dikunci di sini bukan satu penyebab tunggal, melainkan dua hal yang
 * membuat kegagalan seperti itu mustahil dibiarkan buram lagi.
 */

describe("versi basi dikenali dari penanda yang benar-benar khas", () => {
  const PESAN_PRODUKSI =
    "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.";

  it("pesan produksi bawaan Next BUKAN penanda versi basi", () => {
    // Ini pernah salah, dan salahnya mahal: kalimat itu adalah pesan bawaan
    // untuk SETIAP kegagalan sisi server di produksi. Diperlakukan sebagai
    // versi basi, aplikasi memuat ulang halaman pada kegagalan apa pun — dan
    // formulir yang sudah diisi belasan baris hilang. Bagi yang mengisinya itu
    // lebih buruk daripada galat aslinya.
    expect(isVersiBasi(new Error(PESAN_PRODUKSI))).toBe(false);
  });

  it("tetap mengenali server action milik build lama", () => {
    expect(isVersiBasi(new Error("Failed to find Server Action 'abc123'."))).toBe(true);
  });

  it("chunk mati tetap ikut — pemulihannya sama", () => {
    const e = new Error("Loading chunk 4821 failed");
    expect(isChunkLoadError(e)).toBe(true);
    expect(isVersiBasi(e)).toBe(true);
  });

  it("galat biasa tidak pernah memicu muat ulang", () => {
    expect(isVersiBasi(new Error("Nama karyawan wajib diisi."))).toBe(false);
    expect(isVersiBasi(new Error("Cabang di luar cakupan Anda."))).toBe(false);
    expect(isVersiBasi(null)).toBe(false);
  });

  it("kegagalan server memberi tahu bahwa isiannya masih utuh", () => {
    // Yang berguna bagi pembacanya bukan pesan teknis yang sudah disunting,
    // melainkan bahwa pekerjaannya tidak hilang dan tombolnya boleh ditekan lagi.
    const pesan = pesanGalatAksi(new Error(PESAN_PRODUKSI));
    expect(pesan).toContain("masih utuh");
    expect(pesan).not.toContain("dimuat ulang");
  });
});

describe("berkas naik langsung ke R2, tidak singgah di server", () => {
  const KLIEN = readFileSync(join(process.cwd(), "src/lib/upload-client.ts"), "utf8");
  const fn = KLIEN.slice(KLIEN.indexOf("export async function uploadOne"));

  it("dicoba untuk SEMUA ukuran, bukan hanya berkas besar", () => {
    // Lubang yang paling sering kena justru di bawah ambang lama: foto KTP dari
    // HP hampir selalu 1–3 MB, jadi selalu menempuh badan permintaan fungsi
    // serverless — tempat kegagalannya ditolak sebelum kode kita sempat jalan.
    expect(fn).not.toContain("if (file.size > DIRECT_MIN) {\n    const up = await direct");
    expect(fn.indexOf("await direct(scope, file)")).toBeLessThan(fn.indexOf("legacy(fd)"));
  });

  it("berkas besar tidak mundur ke server action saat R2 menolak", () => {
    expect(fn).toContain("if (file.size > DIRECT_MIN) throw e;");
  });
});

describe("jalur pengajuan dokumen tidak bisa gagal buram", () => {
  const FORM = readFileSync(join(process.cwd(), "src/components/hc/hc-submit.tsx"), "utf8");
  const AKSI = readFileSync(join(process.cwd(), "src/lib/actions/hc.ts"), "utf8");

  it("seluruh pengiriman di layar terbungkus dan memakai pesan yang bisa dibaca", () => {
    const fn = FORM.slice(FORM.indexOf("function submit()"), FORM.indexOf("return (", FORM.indexOf("function submit()")));
    expect(fn).toContain("try {");
    expect(fn).toContain("pesanGalatAksi(e)");
  });

  it("kedua aksi servernya terbungkus, apa pun yang meledak", () => {
    for (const nama of ["uploadHcKtpAction", "submitHcRequestAction"]) {
      const mulai = AKSI.indexOf(`export async function ${nama}`);
      expect(mulai, `${nama} tidak ditemukan`).toBeGreaterThan(-1);
      const badan = AKSI.slice(mulai, mulai + 900);
      expect(badan, `${nama} tidak terbungkus`).toContain("try {");
      expect(badan).toContain("catch (e)");
    }
  });

  it("penyimpanan yang menolak tetap menyebut alasannya", () => {
    expect(AKSI).toContain("penyimpanan tidak merespons");
    expect(AKSI).toContain("server tidak merespons");
  });
});

describe("siapa yang boleh mengajukan dokumen", () => {
  const spv = { role: "supervisor" as const, department: "Supervisor", grants: [] };
  const ca = { role: "area_coordinator" as const, department: "Operational", grants: [] };
  const barista = { role: "member" as const, department: "Creative", grants: [] };

  it("supervisor cabang — seperti sebelumnya", () => {
    expect(canReachMenu(spv, "hc_submit")).toBe(true);
  });

  it("Coordinator Area juga, karena ia membawahi beberapa cabang", () => {
    // Tanpa ini ia harus menitipkan berkas ke orang lain, dan pengajuannya
    // tercatat atas nama yang salah.
    expect(canReachMenu(ca, "hc_submit")).toBe(true);
  });

  it("departemen yang tidak mengurus cabang tetap tidak dapat", () => {
    expect(canReachMenu(barista, "hc_submit")).toBe(false);
  });
});
