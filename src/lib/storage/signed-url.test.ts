import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga terhadap satu kelas bug yang sudah pernah menjatuhkan produksi:
 * menambahkan parameter query ke URL penyimpanan yang SUDAH ditandatangani.
 *
 * R2 memakai AWS SigV4 — tanda tangannya dihitung dari seluruh query string.
 * Satu parameter tambahan membuat R2 menghitung tanda tangan yang berbeda lalu
 * menolak dengan SignatureDoesNotMatch, dan SELURUH tautan unduh mati. Dulu ini
 * lolos karena Supabase memaafkan parameter tambahan, sehingga kodenya terlihat
 * benar sampai berkas dipindah ke R2.
 *
 * Nama unduhan harus ditandatangani di server lewat `presignGet(key, ttl, nama)`.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("URL penyimpanan bertanda tangan", () => {
  const files = walk(SRC);

  it("tidak ada kode yang menempelkan ?download= ke URL", () => {
    const offenders = files.filter((f) => /[?&]download=/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
  });

  it("tidak menghidupkan kembali pembungkus forceDownload", () => {
    const offenders = files.filter((f) => /\bforceDownload\b/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.replace(SRC, "src"))).toEqual([]);
  });

  it("presignGet menandatangani nama unduhan lewat response-content-disposition", () => {
    const r2 = readFileSync(join(SRC, "lib/storage/r2.ts"), "utf8");
    // Nama harus masuk SEBELUM penandatanganan, bukan ditempel setelahnya.
    expect(r2).toContain("response-content-disposition");
    const signIndex = r2.indexOf("aws: { signQuery: true }", r2.indexOf("export async function presignGet"));
    const dispositionIndex = r2.indexOf("response-content-disposition");
    expect(dispositionIndex).toBeGreaterThan(-1);
    expect(dispositionIndex).toBeLessThan(signIndex);
  });

  it("r2Put mengirim content-length — R2 menolak PUT tanpa itu dengan 411", () => {
    const r2 = readFileSync(join(SRC, "lib/storage/r2.ts"), "utf8");
    const put = r2.slice(r2.indexOf("export async function r2Put"));
    expect(put).toContain("content-length");
    // Body berupa Blob dialirkan tanpa Content-Length; itu yang dulu memicu 411.
    expect(put).not.toContain("new Blob(");
  });
});
