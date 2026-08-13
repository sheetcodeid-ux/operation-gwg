import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ACTION = readFileSync(join(process.cwd(), "src/lib/actions/hc-requests.ts"), "utf8");
const SHARED = readFileSync(join(process.cwd(), "src/components/hc/request-shared.tsx"), "utf8");
const INSTR = readFileSync(join(process.cwd(), "instrumentation.ts"), "utf8");

/**
 * Kegagalan mengirim Pengajuan Design muncul sebagai "An error occurred in the
 * Server Components render. The specific message is omitted in production
 * builds" — kalimat yang tidak memberi tahu apa pun, tidak kepada pemakainya
 * maupun kepada yang memperbaikinya.
 *
 * Yang dikunci di sini bukan satu penyebab, tapi kelasnya: jalur unggah tidak
 * boleh lagi bisa gagal secara buram.
 */
describe("unggah lampiran pengajuan tidak gagal buram", () => {
  const fn = ACTION.slice(
    ACTION.indexOf("export async function uploadHcRequestFileAction"),
    ACTION.indexOf("export async function presignHcUploadAction"),
  );

  it("seluruh badan aksinya terbungkus, apa pun yang meledak", () => {
    // Server action yang melempar galat tak tertangkap = pesan buram di layar.
    expect(fn).toContain("try {");
    expect(fn).toContain("Gagal mengunggah");
    expect(fn).toContain("penyimpanan tidak merespons");
  });

  it("kegagalan R2 masih punya jalur cadangan lewat Supabase", () => {
    expect(fn).toContain("fallback Supabase");
  });
});

describe("berkas naik langsung ke R2", () => {
  const fn = SHARED.slice(SHARED.indexOf("export async function uploadAll"));

  it("dicoba untuk SEMUA ukuran, bukan hanya berkas besar", () => {
    // Foto 1,9 MB dari HP tidak punya alasan singgah di fungsi serverless,
    // yang badan permintaannya dibatasi platform.
    expect(fn).toContain("direct = await uploadDirect(file, report);");
    expect(fn).not.toContain("if (file.size > DIRECT_UPLOAD_MIN) {\n      const direct");
  });

  it("berkas kecil tetap punya jalur server bila R2 menolak", () => {
    expect(fn).toContain("if (file.size > DIRECT_UPLOAD_MIN) throw e;");
    expect(fn).toContain("uploadHcRequestFileAction(fd)");
  });

  it("berkas besar tanpa R2 berhenti dengan alasan, bukan diam-diam gagal", () => {
    expect(fn).toContain("terlalu besar untuk diunggah selagi penyimpanan R2 belum aktif");
  });
});

describe("galat server tercatat utuh", () => {
  it("hook onRequestError menyimpan pesan aslinya", () => {
    // Tanpa ini, satu-satunya sumber adalah log platform — dan dua kali ekspor
    // log datang kosong.
    expect(INSTR).toContain("export async function onRequestError");
    expect(INSTR).toContain("app_errors");
    expect(INSTR).toContain("e?.digest");
  });

  it("mencatat tidak boleh menggagalkan atau menahan permintaannya", () => {
    expect(INSTR).toContain("AbortSignal.timeout(3000)");
    expect(INSTR).toContain("} catch {");
  });
});
