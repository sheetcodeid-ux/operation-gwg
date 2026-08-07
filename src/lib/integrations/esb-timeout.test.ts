import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga terhadap cron yang mati di detik ke-60.
 *
 * `fetch` bawaan Node TIDAK punya batas waktu. Satu permintaan ESB yang
 * menggantung ikut menahan seluruh cron: pemeriksaan anggaran waktu tidak
 * pernah kebagian jalan, Vercel mematikan fungsinya, dan seluruh hasil kerja
 * pada jalannya itu hangus.
 *
 * Penyebab kedua yang sama fatalnya: loop menunggu ekspor siap bisa
 * menghabiskan 22 × 2 detik sendirian — sudah lewat batas sebelum sempat
 * menyimpan apa pun. Loop itu wajib memeriksa tenggat.
 */

const CLIENT = join(process.cwd(), "src/lib/integrations/esb-client.ts");
const src = readFileSync(CLIENT, "utf8");

/** Kode tanpa komentar — penjelasan di atas menyebut `fetch(` sebagai contoh. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("klien ESB selalu punya batas waktu", () => {
  it("tidak ada fetch mentah — semuanya lewat pembungkus esbFetch", () => {
    // Satu-satunya `fetch(` polos yang boleh ada adalah yang DI DALAM esbFetch.
    const inside = code.slice(code.indexOf("function esbFetch"));
    const wrapperCall = /return fetch\(url, \{ \.\.\.init, signal: AbortSignal\.timeout\(/.test(inside);
    expect(wrapperCall).toBe(true);

    const raw = [...code.matchAll(/(?<![a-zA-Z.])fetch\(/g)].length;
    expect(raw).toBe(1); // hanya yang di dalam esbFetch
  });

  it("esbFetch selalu memasang AbortSignal.timeout", () => {
    const fn = code.slice(code.indexOf("function esbFetch"), code.indexOf("const CSRF_META"));
    expect(fn).toContain("AbortSignal.timeout(");
    // Batas per permintaan tidak boleh melewati sisa tenggat permintaan.
    expect(fn).toContain("esbTimeLeft()");
  });

  it("loop menunggu ekspor berhenti sebelum tenggat habis", () => {
    const loop = code.slice(code.indexOf("async function readExportPageRaw"));
    expect(loop).toContain("esbTimeLeft()");
  });

  it("lapisan data tidak memperpendek tenggat permintaan", () => {
    // esbSetDeadline hanya boleh dipanggil dari titik masuk (route), karena
    // memotong panggilan ESB di tengah membuang seluruh hasilnya.
    for (const f of ["fraud.ts", "seasonal.ts", "esb-menu.ts"]) {
      const data = readFileSync(join(process.cwd(), "src/lib/data", f), "utf8");
      expect(data.includes("esbSetDeadline(")).toBe(false);
      expect(data).toContain("esbEnsureDeadline(");
    }
  });

  it("route cron memasang tenggat sebelum bekerja", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/cron/fraud-sync/route.ts"), "utf8");
    expect(route).toContain("esbSetDeadline(");
  });
});
