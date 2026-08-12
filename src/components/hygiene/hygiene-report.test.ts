import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(process.cwd(), "src/components/hygiene/hygiene-report.tsx"), "utf8");
const EXPLORER = readFileSync(join(process.cwd(), "src/components/hygiene/hygiene-explorer.tsx"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src/app/(app)/hygiene/page.tsx"), "utf8");

describe("lembar PDF audit hygiene", () => {
  it("membawa logo perusahaan", () => {
    expect(SRC).toContain("/gwg.svg");
    // Bandnya gelap di kedua mode, jadi logonya dibalik jadi putih.
    expect(SRC).toContain("brightness(0) invert(1)");
  });

  it("warna latarnya ikut tercetak, tidak keluar putih polos", () => {
    // Peramban membuang warna latar saat mencetak kecuali diminta eksplisit —
    // tanpa ini lencana nilai keluar sebagai kotak putih tanpa arti.
    expect(SRC).toContain("print-color-adjust:exact");
  });

  it("menunggu foto selesai dimuat sebelum mencetak", () => {
    // Tanpa ini dialog cetak terbuka saat foto masih kosong, dan PDF-nya keluar
    // dengan kotak putih — justru bagian yang paling dibutuhkan sebagai bukti.
    expect(SRC).toContain("w.document.images");
    expect(SRC).toContain("img.onload");
  });

  it("foto yang gagal dimuat tidak menahan pencetakan selamanya", () => {
    expect(SRC).toContain("img.onerror");
    expect(SRC).toContain("Promise.race");
  });

  it("teks dari data disaring sebelum masuk HTML", () => {
    // Nama outlet dan isi temuan diketik manusia; tanpa penyaringan, satu
    // tanda kurung siku merusak seluruh lembarnya.
    expect(SRC).toContain("function buildHtml");
    expect(SRC).toMatch(/const esc = \(s: string\) =>/);
    for (const field of ["r.outlet", "r.inspector", "r.area", "r.shift"]) {
      expect(SRC, `${field} dipakai tanpa esc()`).toContain(`esc(${field})`);
    }
  });

  it("nilai per bagian memakai skala yang sama dengan skor auditnya", () => {
    // HYGIENE_RATING_META.score sudah 0–100; menampilkannya sebagai "/4"
    // membuat angkanya terbaca salah.
    expect(SRC).toContain("/100 · ");
    expect(SRC).not.toContain("s.score * 25");
  });

  it("bagian dan tanda tangan tidak terpotong antar halaman", () => {
    expect(SRC).toContain("break-inside:avoid");
  });
});

describe("tombol cetak di tabel hygiene", () => {
  it("tersedia untuk semua yang bisa membuka halaman, bukan hanya yang boleh menghapus", () => {
    // Coordinator Area memintanya untuk laporan, dan mencetak tidak mengubah
    // apa pun — menyembunyikannya di balik izin hapus tidak masuk akal.
    const kolom = EXPLORER.slice(EXPLORER.indexOf('id: "actions"'));
    expect(kolom).toContain("printHygieneReport(row.original)");
    expect(kolom).toContain("{canDelete && (");
  });

  it("data nilai per butir ikut dikirim ke barisnya", () => {
    // Tanpa ini lembarnya hanya berisi skor akhir, tanpa rincian per area.
    expect(EXPLORER).toContain("ratings: Record<HygieneSection, Record<string, HygieneRating>>");
    expect(PAGE).toContain("ratings: a.ratings");
    expect(PAGE).toContain("supervisor: a.supervisorName");
  });
});
