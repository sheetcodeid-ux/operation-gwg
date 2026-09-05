import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Judul halaman dan remah roti tidak boleh kembali memakan ruang isi.
 *
 * Keduanya pernah berdiri sebagai dua baris penuh di atas SETIAP halaman —
 * remah roti menyebut "KPI › Operational Coordinator Area", lalu tepat di
 * bawahnya judul besar mengulangi hal yang sama. Bersama-sama keduanya
 * menghabiskan sekitar sepertiga layar pertama, dan yang terdorong turun
 * justru grafik, tabel, dan isian yang jadi alasan halaman itu dibuka.
 *
 * Diperiksa pada BERKASNYA, bukan pada hasil render: keduanya tersebar di
 * empat puluh tujuh halaman lewat satu komponen bersama, dan yang perlu
 * dijaga memang bentuk komponen itu — satu orang yang mengembalikan judulnya
 * "supaya halaman ini saja lebih jelas" akan mengembalikannya untuk semua.
 */
const baca = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("kepala halaman", () => {
  const isi = baca("components/ui/page-header.tsx");

  it("judulnya hanya untuk pembaca layar, bukan baris di layar", () => {
    expect(isi).toContain('className="sr-only"');
    // Tidak ada lagi judul tingkat satu yang tercetak besar.
    expect(isi).not.toMatch(/text-xl font-semibold/);
  });

  it("tanpa tombol aksi, tidak menggambar apa pun yang mendorong isi turun", () => {
    expect(isi).toMatch(/if \(!actions\) return <h1 className="sr-only">/);
  });
});

describe("remah roti", () => {
  it("berada di bilah atas, bukan di dalam isi halaman", () => {
    expect(baca("components/layout/topbar.tsx")).toContain('from "./breadcrumbs"');
    expect(baca("components/layout/main-shell.tsx")).not.toContain("Breadcrumbs");
  });

  it("tidak membawa margin bawah — di bilah atas itu menggeser seluruh barisnya", () => {
    expect(baca("components/layout/breadcrumbs.tsx")).not.toMatch(/className="mb-\d+ flex/);
  });
});
