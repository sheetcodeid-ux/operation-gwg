import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PAGE_SIZE, selectAll } from "./paged";

/**
 * Penjaga terhadap kelas bug yang membuat audit hygiene "hilang".
 *
 * API Supabase memotong setiap permintaan pada 1.000 baris TANPA error.
 * `.limit(10000)` tidak menaikkan batas itu — ia hanya membuat kodenya terlihat
 * aman. Begitu sebuah tabel melewati seribu baris, data yang baru berhenti
 * muncul di aplikasi meski tersimpan rapi di database.
 *
 * Dua aturan yang dijaga di sini:
 *   1. Tidak ada `.limit(n)` dengan n > 1000 — angka itu selalu bohong.
 *   2. Setiap `.range(` dipasangkan dengan `.order(` — tanpa urutan yang stabil,
 *      baris bisa bergeser antar halaman lalu terlewat atau terbaca dua kali.
 */

const DATA = join(process.cwd(), "src/lib/data");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.ts$/.test(entry) && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const files = walk(DATA);
const rel = (f: string) => f.replace(process.cwd() + "/", "");

/** Komentar dibuang dulu — penjelasan tentang bug ini menyebut `.limit(10000)`. */
const code = (f: string) =>
  readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("selectAll", () => {
  const page = (rows: number[], size = PAGE_SIZE) => {
    let call = 0;
    const pages: number[][] = [];
    for (let i = 0; i < rows.length; i += size) pages.push(rows.slice(i, i + size));
    // Halaman penuh yang PERSIS habis tetap butuh satu permintaan kosong lagi.
    if (rows.length % size === 0) pages.push([]);
    return {
      fetch: (): Promise<{ data: unknown[]; error: null }> => Promise.resolve({ data: pages[call++] ?? [], error: null }),
      calls: () => call,
    };
  };

  it("menggabungkan seluruh halaman, bukan seribu baris pertama", async () => {
    const rows = Array.from({ length: 2_350 }, (_, i) => i);
    const p = page(rows);
    await expect(selectAll<number>("t", p.fetch)).resolves.toEqual(rows);
    expect(p.calls()).toBe(3);
  });

  it("berhenti pada halaman pertama saat datanya sedikit", async () => {
    const p = page([1, 2, 3]);
    await expect(selectAll<number>("t", p.fetch)).resolves.toEqual([1, 2, 3]);
    expect(p.calls()).toBe(1);
  });

  it("tidak kehilangan baris saat jumlahnya pas kelipatan halaman", async () => {
    const rows = Array.from({ length: PAGE_SIZE * 2 }, (_, i) => i);
    const p = page(rows);
    await expect(selectAll<number>("t", p.fetch)).resolves.toHaveLength(PAGE_SIZE * 2);
  });

  it("melempar dengan nama tabelnya saat satu halaman gagal", async () => {
    await expect(
      selectAll("hygiene", () => Promise.resolve({ data: null, error: { message: "boom" } })),
    ).rejects.toThrow("hygiene: boom");
  });

  it("berhenti di pagar maxRows alih-alih membaca tanpa batas", async () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => i);
    const p = page(rows);
    await expect(selectAll<number>("t", p.fetch, PAGE_SIZE * 2)).resolves.toHaveLength(PAGE_SIZE * 2);
  });
});

describe("lapisan data tidak memakai batas semu", () => {
  it("tidak ada .limit(n) dengan n di atas batas API 1000", () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of code(f).matchAll(/\.limit\(\s*(\d[\d_]*)\s*\)/g)) {
        if (Number(m[1].replace(/_/g, "")) > PAGE_SIZE) offenders.push(`${rel(f)} → ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("setiap pembacaan .range() punya .order() supaya halamannya stabil", () => {
    const offenders: string[] = [];
    for (const f of files) {
      // Satu pemanggilan kueri berakhir di titik koma / koma penutup argumen.
      for (const stmt of code(f).split(/;\n|\),\n/)) {
        if (stmt.includes(".range(") && !stmt.includes(".order(")) offenders.push(rel(f));
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
