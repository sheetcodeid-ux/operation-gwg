import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PapanSupervisor } from "./papan-supervisor";
import type { RekapSupervisor } from "@/lib/data/supervisor";

/**
 * PEMILIH BULAN KPI SUPERVISOR.
 *
 * Halamannya sudah lama menerima `?bulan=`, tapi tidak ada satu pun cara
 * mengubahnya dari layar: yang hendak mengisi Problem Solver bulan lalu
 * terjebak di bulan berjalan. Yang dijaga di sini dua hal, dan keduanya pernah
 * salah di tempat lain:
 *
 *   1. Pemilihnya membaca `rekap.periode` — periode yang angkanya BENAR-BENAR
 *      sedang ditampilkan — bukan jam peramban. Kalau ia membaca jam, layar
 *      Agustus akan menulis "September" di dropdownnya.
 *
 *   2. Periode yang dipilih ikut ke dialog Problem Solver, karena di situlah
 *      angkanya disimpan.
 *
 * Papannya benar-benar dirender, bukan dibaca sebagai teks: komponen klien yang
 * menerima prop dari halaman server adalah tempat kesalahan yang lolos tsc,
 * lint, dan build sekaligus.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const rekap = (periode: string): RekapSupervisor => ({
  periode,
  baris: [
    {
      outletId: "o1",
      nama: "Nordu Ahmad Yani",
      supervisor: "Budi",
      posisi: "spv" as RekapSupervisor["baris"][number]["posisi"],
      jenis: "Umum",
      nilai: 82.5,
      peringkat: null,
      indikator: [],
      alasan: null,
    },
  ],
  rata: 82.5,
  belumDinilai: 0,
  belumTigaBulan: [],
  kolom: { Umum: [], KPK: [] },
});

describe("PapanSupervisor — pemilih bulan", () => {
  it("menampilkan bulan yang sedang dibuka, bukan bulan berjalan", () => {
    const html = renderToStaticMarkup(<PapanSupervisor rekap={rekap("2026-08")} bisaLihatSemua bisaIsi />);
    expect(html).toContain("Agustus");
    expect(html).toContain("2026");
    expect(html).not.toContain("September");
  });

  it("bulan lain ikut terbaca apa adanya", () => {
    for (const [periode, nama] of [
      ["2026-01", "Januari"],
      ["2025-12", "Desember"],
      ["2026-09", "September"],
    ] as const) {
      const html = renderToStaticMarkup(<PapanSupervisor rekap={rekap(periode)} bisaLihatSemua bisaIsi />);
      expect(html, periode).toContain(nama);
    }
  });

  it("tetap dirender untuk yang hanya melihat outletnya sendiri", () => {
    // Tanpa hak mengisi maupun mengunduh, pemilih bulannya tetap ada — melihat
    // bulan lalu bukan hak istimewa.
    const html = renderToStaticMarkup(<PapanSupervisor rekap={rekap("2026-08")} bisaLihatSemua={false} />);
    expect(html).toContain("Agustus");
    expect(html).not.toContain("Isi Problem Solver");
  });

  it("periode yang dipilih dipakai halaman & dialog dari satu sumber", () => {
    const src = readFileSync(new URL("./papan-supervisor.tsx", import.meta.url), "utf8");
    // Satu sumber periode: `rekap.periode`. Dropdown, alamat, dan dialog
    // Problem Solver harus membacanya dari situ — bukan tiga tanggal sendiri.
    expect(src).toContain("const [tahun, bulan] = rekap.periode.split(\"-\");");
    expect(src).toContain("periode={rekap.periode}");
    expect(src).toContain("router.push(`/kpi/supervisor?bulan=${periodeDari(th, bl)}`)");
    expect(src).not.toMatch(/new Date\(\)/);
  });
});
