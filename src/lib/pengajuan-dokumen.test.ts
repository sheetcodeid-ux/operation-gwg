import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isChunkLoadError, isVersiBasi } from "./chunk-recovery";
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

describe("halaman versi lama dikenali, bukan cuma chunk mati", () => {
  const PESAN_PRODUKSI =
    "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.";

  it("mengenali kalimat yang PERSIS dilihat pengguna", () => {
    expect(isVersiBasi(new Error(PESAN_PRODUKSI))).toBe(true);
  });

  it("mengenali server action milik build lama", () => {
    expect(isVersiBasi(new Error("Failed to find Server Action 'abc123'."))).toBe(true);
    expect(isVersiBasi(new Error("Connection closed."))).toBe(true);
  });

  it("chunk mati tetap ikut — pemulihannya sama", () => {
    const e = new Error("Loading chunk 4821 failed");
    expect(isChunkLoadError(e)).toBe(true);
    expect(isVersiBasi(e)).toBe(true);
  });

  it("galat biasa TIDAK diperlakukan sebagai versi basi", () => {
    // Kalau ini keliru, tiap kegagalan wajar akan memuat ulang halaman dan
    // menghapus isian orang — jauh lebih buruk daripada bug aslinya.
    expect(isVersiBasi(new Error("Nama karyawan wajib diisi."))).toBe(false);
    expect(isVersiBasi(new Error("Cabang di luar cakupan Anda."))).toBe(false);
    expect(isVersiBasi(null)).toBe(false);
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
