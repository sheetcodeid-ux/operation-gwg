import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTable, getCoreRowModel, getSortedRowModel, type ColumnDef, type SortingState } from "@tanstack/table-core";

/**
 * KONTRAK PENGURUTAN SKOR — UNKNOWN SELALU DI BELAKANG, DUA ARAH.
 *
 * ┌─ KENAPA DIUJI LEWAT MESIN TABELNYA, BUKAN PEMBANDING BUATAN SENDIRI ────┐
 * │                                                                        │
 * │ Bugnya bukan di pembanding kita — kita tidak punya satu pun. Bugnya di  │
 * │ perilaku BAWAAN TanStack: kolom angka jatuh ke `sortingFns.basic`, dan  │
 * │ `compareBasic` membandingkan `null` dengan `>`. Karena `null > 0` dan   │
 * │ `null > 75` sama-sama false, urutannya tidak transitif dan baris tanpa  │
 * │ skor mendarat di antara skor nyata.                                     │
 * │                                                                        │
 * │ Jadi yang diuji di sini tabel sungguhan dari `@tanstack/table-core`     │
 * │ dengan opsi yang SAMA PERSIS seperti yang dipakai kedua komponen —      │
 * │ bukan tiruan pembandingnya. Menguji tiruan berarti membuktikan tiruan   │
 * │ itu benar, bukan layarnya.                                              │
 * │                                                                        │
 * │ Bagian yang tidak bisa dijangkau dari sini — bahwa komponennya memang   │
 * │ memakai opsi itu — dijaga dengan membaca berkas sumbernya di bawah.     │
 * └────────────────────────────────────────────────────────────────────────┘
 */

interface Baris {
  nama: string;
  skor: number | null;
}

/** Persis pola kedua komponen: `null` keluar sebagai `undefined`. */
const nilaiSkor = (v: number | null): number | undefined => v ?? undefined;

function urutkan(data: Baris[], desc: boolean): (number | null)[] {
  const columns: ColumnDef<Baris>[] = [
    { id: "nama", accessorKey: "nama" },
    { id: "skor", accessorFn: (r) => nilaiSkor(r.skor), sortUndefined: "last" },
  ];
  const sorting: SortingState = [{ id: "skor", desc }];
  const table = createTable<Baris>({
    data,
    columns,
    state: { sorting },
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return table.getSortedRowModel().rows.map((r) => (r.original as Baris).skor);
}

describe("pengurutan kolom skor", () => {
  const data: Baris[] = [
    { nama: "a", skor: 90 },
    { nama: "b", skor: null },
    { nama: "c", skor: 0 },
    { nama: "d", skor: 70 },
  ];

  it("X-08 · menaik: 0, 70, 90, lalu UNKNOWN", () => {
    expect(urutkan(data, false)).toEqual([0, 70, 90, null]);
  });

  it("X-09 · menurun: 90, 70, 0, lalu UNKNOWN", () => {
    expect(urutkan(data, true)).toEqual([90, 70, 0, null]);
  });

  it("X-13 · nol yang dinilai TIDAK diperlakukan sebagai UNKNOWN", () => {
    // Menaik, nol berada di paling depan sebagai skor terendah — bukan di
    // belakang bersama yang belum dinilai.
    expect(urutkan(data, false)[0]).toBe(0);
    expect(urutkan(data, true).at(-1)).toBeNull();
  });

  it("beberapa UNKNOWN sekaligus tetap di belakang, dua arah", () => {
    const banyak: Baris[] = [
      { nama: "a", skor: null },
      { nama: "b", skor: 55 },
      { nama: "c", skor: null },
      { nama: "d", skor: 0 },
    ];
    expect(urutkan(banyak, false)).toEqual([0, 55, null, null]);
    expect(urutkan(banyak, true)).toEqual([55, 0, null, null]);
  });

  it("tanpa opsi itu, bug-nya nyata — UNKNOWN terselip di antara angka", () => {
    // Pembuktian bahwa `sortUndefined: "last"` memang yang menahannya, bukan
    // kebetulan urutan datanya.
    const columns: ColumnDef<Baris>[] = [
      { id: "nama", accessorKey: "nama" },
      { id: "skor", accessorFn: (r) => r.skor },
    ];
    const table = createTable<Baris>({
      data,
      columns,
      state: { sorting: [{ id: "skor", desc: false }] },
      onStateChange: () => {},
      renderFallbackValue: null,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    });
    const hasil = table.getSortedRowModel().rows.map((r) => (r.original as Baris).skor);
    expect(hasil.at(-1)).not.toBeNull(); // UNKNOWN tidak berada di belakang
  });
});

describe("kedua tabel memakai aturan yang sama", () => {
  const berkas = {
    "/outlets": "../outlets/outlets-explorer.tsx",
    "/reports": "../reports/reports-outlet-table.tsx",
  };

  for (const [layar, rel] of Object.entries(berkas)) {
    const src = readFileSync(new URL(rel, import.meta.url), "utf8");

    it(`${layar} memakai sortUndefined "last"`, () => {
      expect(src).toContain('const skorSort = { sortUndefined: "last" } as const;');
    });

    it(`${layar} memetakan skor hilang menjadi undefined`, () => {
      expect(src).toContain("const nilaiSkor = (v: number | null): number | undefined => v ?? undefined;");
    });

    it(`${layar} tidak lagi memakai accessorKey untuk kolom skor`, () => {
      // `accessorKey` mengembalikan `null` apa adanya, dan `sortUndefined`
      // tidak pernah berlaku untuknya.
      for (const kolom of ["hospitality", "hygiene"]) {
        expect(src, kolom).not.toContain(`accessorKey: "${kolom}"`);
        expect(src, kolom).toContain(`accessorFn: (r) => nilaiSkor(r.${kolom})`);
      }
    });
  }

  it("/outlets menerapkannya juga pada Composite Score", () => {
    const src = readFileSync(new URL("../outlets/outlets-explorer.tsx", import.meta.url), "utf8");
    expect(src).not.toContain('accessorKey: "composite"');
    expect(src).toContain("accessorFn: (r) => nilaiSkor(r.composite)");
  });
});
