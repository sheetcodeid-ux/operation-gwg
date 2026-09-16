import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HIDRASI EXISTING TIDAK BOLEH MENYENTUH OPERATIONAL V.1.
 *
 * `hydrate.ts` menarik SELURUH isi sembilan tabel ke dalam array di memori dan
 * menyegarkannya tiap TTL (`src/lib/data/hydrate.ts`). Itu keputusan lama yang
 * masuk akal untuk tabel master berukuran ratusan baris.
 *
 * Tabel Operational V.1 bukan tabel master. Signal, action, evidence, dan
 * kpi_values tumbuh sebanding jumlah outlet dikali jumlah hari dikali jumlah
 * rule — puluhan ribu baris dalam hitungan bulan. Satu import yang tidak
 * disengaja dari `hydrate.ts` ke modul V.1 cukup untuk menyeretnya ke dalam
 * jalur itu.
 *
 * Berkas `hydrate.ts` sendiri mencatat kenapa ini gawat: TTL-nya pernah
 * bernilai tiga detik, dan itu mematikan produksi. Uji ini menjaga supaya
 * pelajaran itu tidak perlu diulang.
 *
 * Diperiksa TRANSITIF, bukan hanya baris import teratas. Modul V.1 bisa ikut
 * terbawa lewat perantara — dan justru lewat perantara itulah hal semacam ini
 * biasanya masuk.
 */

const AKAR = process.cwd();

/** Modul Operational V.1 yang tidak boleh terjangkau dari hidrasi. */
const MODUL_V1 = [
  "src/lib/ops/scope-v1.ts",
  "src/lib/ops/waktu.ts",
  "src/lib/ops/sales-fact.ts",
  "src/lib/ops/kelengkapan.ts",
  "src/lib/ops/kpi-sales.ts",
  "src/lib/ops/target-sales.ts",
];

/** Pintu masuk yang dijaga. */
const PINTU = ["src/lib/data/hydrate.ts", "src/lib/data/seed.ts", "src/lib/data/store.ts"];

/** Ubah sebuah specifier import jadi jalur berkas di dalam `src/`, kalau bisa. */
function jalurDari(dari: string, spec: string): string | null {
  let mentah: string;
  if (spec.startsWith("@/")) mentah = join("src", spec.slice(2));
  else if (spec.startsWith(".")) mentah = join(dari, "..", spec);
  else return null; // paket npm, `server-only`, dan sejenisnya

  for (const akhiran of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const calon = `${mentah}${akhiran}`;
    if (existsSync(join(AKAR, calon)) && /\.(ts|tsx)$/.test(calon)) return calon.replace(/\\/g, "/");
  }
  return null;
}

/** Seluruh specifier import/export-from dalam satu berkas. */
function importDalam(berkas: string): string[] {
  const isi = readFileSync(join(AKAR, berkas), "utf8");
  const hasil: string[] = [];
  // `import … from "x"`, `export … from "x"`, dan `import("x")` dinamis.
  const pola = /(?:^|\n)\s*(?:import|export)[^;\n]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of isi.matchAll(pola)) hasil.push(m[1] ?? m[2]);
  return hasil;
}

/** Telusuri seluruh berkas yang terjangkau dari `awal`, beserta jalannya. */
function jangkauan(awal: string): Map<string, string[]> {
  const terlihat = new Map<string, string[]>([[awal, [awal]]]);
  const antre = [awal];
  while (antre.length) {
    const kini = antre.shift()!;
    const jalan = terlihat.get(kini)!;
    for (const spec of importDalam(kini)) {
      const berikut = jalurDari(kini, spec);
      if (!berikut || terlihat.has(berikut)) continue;
      terlihat.set(berikut, [...jalan, berikut]);
      antre.push(berikut);
    }
  }
  return terlihat;
}

describe("modul V.1 tidak terjangkau dari lapisan hidrasi", () => {
  for (const pintu of PINTU) {
    it(`${pintu} tidak menyeret satu pun modul V.1`, () => {
      const terjangkau = jangkauan(pintu);
      const tertangkap = MODUL_V1.filter((m) => terjangkau.has(m)).map(
        (m) => `${m} lewat: ${terjangkau.get(m)!.join(" → ")}`,
      );
      expect(tertangkap).toEqual([]);
    });
  }
});

describe("penelusurnya sendiri benar", () => {
  it("benar-benar menemukan import yang ADA", () => {
    // Kalau penelusurnya rusak, uji di atas lulus tanpa memeriksa apa pun.
    const t = jangkauan("src/lib/data/hydrate.ts");
    expect(t.has("src/lib/data/seed.ts")).toBe(true);
    expect(t.has("src/lib/data/rows.ts")).toBe(true);
    expect(t.size).toBeGreaterThan(3);
  });

  it("menembus perantara, bukan cuma satu tingkat", () => {
    // `sales-fact.ts` mengimpor `@/lib/types`; penelusur harus sampai ke sana.
    const t = jangkauan("src/lib/ops/sales-fact.ts");
    expect(t.has("src/lib/types.ts")).toBe(true);
  });

  it("modul V.1 memang bisa tertangkap kalau benar-benar terjangkau", () => {
    // Dibuktikan dari sisi sebaliknya: `scope-v1.ts` menjangkau `bidang.ts`,
    // jadi mekanismenya terbukti bisa menemukan sesuatu.
    const t = jangkauan("src/lib/ops/scope-v1.ts");
    expect(t.has("src/lib/ops/bidang.ts")).toBe(true);
    expect(t.has("src/lib/rbac.ts")).toBe(true);
  });
});

describe("arah ketergantungan V.1", () => {
  it("modul V.1 tidak mengimpor lapisan hidrasi", () => {
    // Arah sebaliknya juga dijaga: kalau `sales-fact.ts` mengimpor `store.ts`,
    // ia ikut menarik seluruh SEED ke mana pun ia dipakai — termasuk ke rute
    // cron yang sengaja tidak menghidrasi apa pun.
    for (const m of MODUL_V1) {
      const t = jangkauan(m);
      expect(t.has("src/lib/data/hydrate.ts"), `${m} → hydrate`).toBe(false);
      expect(t.has("src/lib/data/seed.ts"), `${m} → seed`).toBe(false);
      expect(t.has("src/lib/data/store.ts"), `${m} → store`).toBe(false);
      expect(t.has("src/lib/data/db.ts"), `${m} → db`).toBe(false);
    }
  });

  it("seluruhnya murni — tidak ada yang ber-server-only", () => {
    // Komentar yang MENYEBUT larangannya tidak dihitung melanggar; yang
    // diperiksa kodenya. Kalau tidak, satu berkas jadi tidak boleh
    // menjelaskan kenapa ia tidak boleh ber-server-only.
    for (const m of MODUL_V1) {
      const kode = readFileSync(join(AKAR, m), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(kode, m).not.toContain('import "server-only"');
    }
  });
});
