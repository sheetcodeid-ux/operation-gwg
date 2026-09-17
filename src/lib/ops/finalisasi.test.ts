import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { periodeBerjalan, periodeGenerasi, periodeSelesai } from "./finalisasi";
import { TANGGAL_BATAS_BUKA } from "./target-sales";

/**
 * SEBUAH ANGKA YANG DISEBUT FINAL LALU BERUBAH BESOK adalah kegagalan yang
 * paling mahal di seluruh V.1: laporan sudah dicetak, keputusan sudah diambil,
 * dan tidak ada satu pun layar yang menunjukkan bahwa angkanya sempat lain.
 *
 * Yang dijaga berkas ini kebalikannya juga: bulan yang SUDAH habis tapi tidak
 * pernah ditutup akan selamanya terbaca "sementara", dan orang berhenti
 * memercayai statusnya sama sekali.
 */

/** Tengah hari WIB pada tanggal tertentu — jauh dari batas hari mana pun. */
const wib = (iso: string) => Date.parse(`${iso}T05:00:00Z`); // 12.00 WIB

describe("bulan berjalan tidak pernah selesai", () => {
  it("tanggal 1", () => {
    expect(periodeSelesai("2026-09", wib("2026-09-01"))).toBe(false);
  });

  it("tanggal 16 — lewat tanggal tutup penilaian, tapi bulannya belum habis", () => {
    expect(periodeSelesai("2026-09", wib("2026-09-16"))).toBe(false);
  });

  it("hari TERAKHIR bulan itu masih belum selesai", () => {
    expect(periodeSelesai("2026-09", wib("2026-09-30"))).toBe(false);
  });
});

describe("selesai begitu bulan kalendernya habis", () => {
  it("2026-09 pada 1 Oktober → selesai", () => {
    expect(periodeSelesai("2026-09", wib("2026-10-01"))).toBe(true);
  });

  it("2026-09 pada 15 Oktober → tetap selesai", () => {
    expect(periodeSelesai("2026-09", wib("2026-10-15"))).toBe(true);
  });

  it("tidak ada masa tenggang sampai tanggal 15 — itu aturan yang lama", () => {
    // AD-10 sempat memakai "bulan lalu, tanggal > 15". TASK #85A menggantinya.
    for (const hari of ["2026-10-01", "2026-10-05", "2026-10-14"]) {
      expect(periodeSelesai("2026-09", wib(hari))).toBe(true);
    }
  });

  it("bulan yang lebih lama selalu selesai", () => {
    expect(periodeSelesai("2026-07", wib("2026-09-01"))).toBe(true);
    expect(periodeSelesai("2026-01", wib("2026-09-01"))).toBe(true);
  });
});

describe("pergantian tahun", () => {
  it("Desember selesai begitu Januari tiba", () => {
    expect(periodeSelesai("2025-12", wib("2025-12-31"))).toBe(false);
    expect(periodeSelesai("2025-12", wib("2026-01-01"))).toBe(true);
  });

  it("Januari tahun berikutnya tidak terbaca lebih tua dari Desember", () => {
    expect(periodeSelesai("2026-01", wib("2025-12-31"))).toBe(false);
  });
});

describe("Februari dan tahun kabisat", () => {
  it("2024-02 pada 29 Februari belum selesai", () => {
    expect(periodeSelesai("2024-02", wib("2024-02-29"))).toBe(false);
  });

  it("2024-02 pada 1 Maret selesai", () => {
    expect(periodeSelesai("2024-02", wib("2024-03-01"))).toBe(true);
  });

  it("2026-02 pada 28 Februari belum selesai — bukan kabisat", () => {
    expect(periodeSelesai("2026-02", wib("2026-02-28"))).toBe(false);
    expect(periodeSelesai("2026-02", wib("2026-03-01"))).toBe(true);
  });
});

describe("batas tengah malam WIB, bukan UTC", () => {
  it("1 Oktober 00.30 WIB sudah Oktober — meski UTC masih 30 September", () => {
    // 2026-09-30T17:30:00Z = 2026-10-01 00.30 WIB.
    const tengahMalam = Date.parse("2026-09-30T17:30:00Z");
    expect(periodeBerjalan(tengahMalam)).toBe("2026-10");
    expect(periodeSelesai("2026-09", tengahMalam)).toBe(true);
  });

  it("30 September 23.30 WIB masih September", () => {
    // 2026-09-30T16:30:00Z = 2026-09-30 23.30 WIB.
    const sebelum = Date.parse("2026-09-30T16:30:00Z");
    expect(periodeBerjalan(sebelum)).toBe("2026-09");
    expect(periodeSelesai("2026-09", sebelum)).toBe(false);
  });
});

describe("periode mendatang tidak pernah selesai", () => {
  it("bulan depan", () => {
    expect(periodeSelesai("2026-10", wib("2026-09-20"))).toBe(false);
  });
});

describe("periode yang digenerate penjadwal", () => {
  it("hanya bulan berjalan", () => {
    expect(periodeGenerasi(wib("2026-09-17"))).toEqual(["2026-09"]);
  });

  it("tanggal 1–14 pun tetap bulan berjalan, BUKAN bulan lalu", () => {
    expect(periodeGenerasi(wib("2026-09-03"))).toEqual(["2026-09"]);
  });

  it("Agustus 2026 tidak pernah masuk daftar setelah September mulai", () => {
    for (const hari of ["2026-09-01", "2026-09-15", "2026-09-17", "2026-09-30"]) {
      expect(periodeGenerasi(wib(hari))).not.toContain("2026-08");
    }
  });

  it("menutup periode TIDAK membuatnya ikut digenerate ulang", () => {
    // Oktober: September sudah selesai, tapi yang ditulis ulang tetap Oktober.
    // Kalau September ikut, angkanya dihitung ulang saat ditutup — persis yang
    // TASK #85A larang.
    expect(periodeGenerasi(wib("2026-10-02"))).toEqual(["2026-10"]);
    expect(periodeSelesai("2026-09", wib("2026-10-02"))).toBe(true);
  });

  it("satu periode saja — backfill tidak boleh terjadi karena cron berangkat", () => {
    expect(periodeGenerasi(wib("2026-09-17"))).toHaveLength(1);
  });
});

/* ───────────────────── penjaga: dua tanggal yang berbeda ───────────────────── */

const sumber = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("tutup buku BUKAN tanggal batas buka outlet", () => {
  it("finalisasi tidak meminjam TANGGAL_BATAS_BUKA", () => {
    expect(TANGGAL_BATAS_BUKA).toBe(15);
    const kode = sumber("src/lib/ops/finalisasi.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(kode).not.toContain("TANGGAL_BATAS_BUKA");
  });

  it("finalisasi tidak memakai tanggal apa pun — hanya bulan", () => {
    const kode = sumber("src/lib/ops/finalisasi.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // Begitu ada `getUTCDate()` di sini, aturannya berhenti jadi "bulan
    // kalendernya habis" dan kembali jadi aturan bertanggal.
    expect(kode).not.toContain("getUTCDate");
    expect(kode).not.toMatch(/\b15\b/);
  });
});

describe("aturan tanggal 15 milik KPI Coordinator Area tetap utuh", () => {
  it("periodeSekarang() di data/kpi.ts tidak ikut berubah", () => {
    // TASK #85A hanya mengubah finalitas periode KPI. Bulan mana yang DIBUKA
    // di layar KPI tetap memakai tanggal tutup penilaian.
    const mesin = sumber("src/lib/data/kpi.ts");
    expect(mesin).toContain("TANGGAL_TUTUP_KPI = 15");
    expect(mesin).toContain("wib.getUTCDate() >= TANGGAL_TUTUP_KPI ? bulan : bulanSebelum(bulan)");
  });
});
