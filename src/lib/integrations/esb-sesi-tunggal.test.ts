import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SATU SESI ESB, walau panggilannya dibarengkan.
 *
 * ESB melayani satu sesi per akun: login kedua mematikan cookie login pertama.
 * Selama semua panggilan ESB berurutan hal itu tidak pernah terlihat — dan
 * memang tidak pernah terlihat, selama bertahun-tahun kode ini berjalan
 * berurutan. Penarikan Daily kini menembak beberapa hari sekaligus, jadi
 * penjaga di bawah ini yang menentukan apakah percepatannya berguna atau malah
 * membuat semuanya gagal berbarengan.
 *
 * Diuji dari teks sumbernya karena satu-satunya cara mengujinya dengan menjalankan
 * adalah benar-benar login ke ESB.
 */

const klien = readFileSync(join(process.cwd(), "src/lib/integrations/esb-client.ts"), "utf8");
const seasonal = readFileSync(join(process.cwd(), "src/lib/data/seasonal.ts"), "utf8");

describe("login tunggal", () => {
  it("login yang sedang jalan dipakai bersama, tidak dimulai lagi", () => {
    // Tanpa ini, rombongan pertama yang berangkat dingin memulai sebanyak itu
    // login berbarengan, dan semuanya kecuali yang terakhir dibalas halaman
    // login — lalu dicatat sebagai hari yang tidak bisa ditarik.
    expect(klien).toContain("let sedangLogin: Promise<Session> | null = null;");
    expect(klien).toContain("sedangLogin ??= login()");
    expect(klien).toContain("sedangLogin = null;");
  });

  it("sesi yang dibuang hanya sesi yang memang dipakai saat gagal", () => {
    // `session = null` polos membuat pemanggil yang lambat membuang sesi BARU
    // milik pemanggil lain, dan rombongan berikutnya login lagi dari nol —
    // berulang, sampai anggaran waktunya habis tanpa satu hari pun bertambah.
    expect(klien).toContain("function buangSesi(dipakai: Session | null)");
    expect(klien).toContain("if (!dipakai || session === dipakai) session = null;");
  });

  it("tidak ada lagi pembuangan sesi polos di mana pun", () => {
    // Satu-satunya tempat yang boleh menulis `session = null` adalah
    // `buangSesi`, dan di sana penulisannya bersyarat — bukan pernyataan
    // berdiri sendiri seperti yang dicari di bawah ini.
    const polos = klien.split("\n").filter((b) => /^\s*session = null;/.test(b));
    expect(polos).toHaveLength(0);
  });
});

describe("batas yang tetap dijaga", () => {
  it("ekspor TETAP berurutan — yang dibarengkan hanya highlight", () => {
    // Ekspor adalah berkas yang dibangkitkan di sisi ESB lalu diambil per
    // halaman, dan pernah benar-benar tertukar antar hari di produksi.
    // Highlight bukan ekspor: satu permintaan, satu balasan, di sambungan yang
    // sama — tidak ada yang bisa tertukar.
    expect(klien).toContain("function serialized<T>");
    expect(klien).toMatch(/esbFetchCancelRows[\s\S]{0,200}return serialized\(/);
    expect(klien).not.toMatch(/esbFetchHighlight[\s\S]{0,400}return serialized\(/);
  });

  it("jumlah panggilan berbarengan berbatas, dan mengecil saat ESB mengerem", () => {
    expect(seasonal).toContain("export const KONKUREN_MAKS = 10;");
    expect(seasonal).toContain("if (gagalBeruntun >= 3 && hidup > 1) { hidup -= 1; break; }");
  });
});
