import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TANGGAL_TUTUP, periodeBerjalan, periodeGenerasi, periodeSelesai } from "./finalisasi";
import { TANGGAL_BATAS_BUKA } from "./target-sales";

/**
 * SEBUAH ANGKA YANG DISEBUT FINAL LALU BERUBAH BESOK adalah kegagalan yang
 * paling mahal di seluruh V.1: laporan sudah dicetak, keputusan sudah diambil,
 * dan tidak ada satu pun layar yang menunjukkan bahwa angkanya sempat lain.
 *
 * Itu yang dijaga berkas ini.
 */

/** Tengah hari WIB pada tanggal tertentu — jauh dari batas hari mana pun. */
const wib = (iso: string) => Date.parse(`${iso}T05:00:00Z`); // 12.00 WIB

describe("bulan berjalan tidak pernah final", () => {
  it("tanggal 1", () => {
    expect(periodeSelesai("2026-09", wib("2026-09-01"))).toBe(false);
  });

  it("tanggal 16 — sudah lewat tanggal tutup, tapi bulannya sendiri belum habis", () => {
    expect(periodeSelesai("2026-09", wib("2026-09-16"))).toBe(false);
  });

  it("hari terakhir bulan itu", () => {
    expect(periodeSelesai("2026-09", wib("2026-09-30"))).toBe(false);
  });
});

describe("bulan lalu mengikuti tanggal tutup", () => {
  it("tanggal 1–14: masih boleh berubah", () => {
    expect(periodeSelesai("2026-08", wib("2026-09-01"))).toBe(false);
    expect(periodeSelesai("2026-08", wib("2026-09-14"))).toBe(false);
  });

  it("tepat tanggal 15: BELUM final — hari penutupannya sendiri masih berjalan", () => {
    expect(periodeSelesai("2026-08", wib("2026-09-15"))).toBe(false);
  });

  it("tanggal 16 ke atas: final", () => {
    expect(periodeSelesai("2026-08", wib("2026-09-16"))).toBe(true);
    expect(periodeSelesai("2026-08", wib("2026-09-30"))).toBe(true);
  });
});

describe("bulan yang lebih lama selalu final", () => {
  it("dua bulan ke belakang, apa pun tanggalnya", () => {
    expect(periodeSelesai("2026-07", wib("2026-09-01"))).toBe(true);
    expect(periodeSelesai("2026-01", wib("2026-09-01"))).toBe(true);
  });

  it("pergantian tahun tidak membuatnya terbaca sebagai bulan depan", () => {
    expect(periodeSelesai("2025-12", wib("2026-01-10"))).toBe(false);
    expect(periodeSelesai("2025-12", wib("2026-01-20"))).toBe(true);
    expect(periodeSelesai("2025-11", wib("2026-01-10"))).toBe(true);
  });
});

describe("periode mendatang tidak pernah final", () => {
  it("bulan depan", () => {
    expect(periodeSelesai("2026-10", wib("2026-09-20"))).toBe(false);
  });
});

describe("WIB, bukan UTC", () => {
  it("pukul 06.00 WIB tanggal 16 sudah tanggal 16 — meski UTC masih tanggal 15", () => {
    // 2026-09-15T23:00:00Z = 2026-09-16 06.00 WIB.
    expect(periodeSelesai("2026-08", Date.parse("2026-09-15T23:00:00Z"))).toBe(true);
    expect(periodeBerjalan(Date.parse("2026-09-30T23:00:00Z"))).toBe("2026-10");
  });
});

describe("periode yang digenerate penjadwal", () => {
  it("hanya bulan berjalan", () => {
    expect(periodeGenerasi(wib("2026-09-17"))).toEqual(["2026-09"]);
  });

  it("tanggal 1–14 pun tetap bulan berjalan, BUKAN bulan lalu", () => {
    // Beda dengan `periodeSekarang()` di KPI Coordinator Area, yang memang
    // membuka bulan lalu sepanjang tanggal 1–14. Yang di sini soal periode mana
    // yang DITULIS, dan menulis Agustus lagi berarti menyentuh data TASK #86.
    expect(periodeGenerasi(wib("2026-09-03"))).toEqual(["2026-09"]);
  });

  it("Agustus 2026 tidak pernah masuk daftar setelah September mulai", () => {
    for (const hari of ["2026-09-01", "2026-09-15", "2026-09-17", "2026-09-30"]) {
      expect(periodeGenerasi(wib(hari))).not.toContain("2026-08");
    }
  });

  it("satu periode saja — backfill tidak boleh terjadi karena cron berangkat", () => {
    expect(periodeGenerasi(wib("2026-09-17"))).toHaveLength(1);
  });
});

/* ───────────────────── penjaga duplikat yang disengaja ───────────────────── */

const sumber = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("tanggal tutup tidak boleh berbeda dari yang sudah berlaku", () => {
  it("sama dengan TANGGAL_TUTUP_KPI di src/lib/data/kpi.ts", () => {
    // Ditulis dua kali karena berkas ini murni dan `data/kpi.ts` menempel pada
    // Supabase. Kalau suatu hari yang satu diubah, uji ini yang gagal lebih
    // dulu — bukan pengguna yang menemukan dua tanggal tutup berbeda.
    const mesin = sumber("src/lib/data/kpi.ts");
    expect(mesin).toContain(`TANGGAL_TUTUP_KPI = ${TANGGAL_TUTUP}`);
  });

  it("aturan bulan-lalu di sini sepakat dengan periodeSekarang() di sana", () => {
    const mesin = sumber("src/lib/data/kpi.ts");
    expect(mesin).toContain("wib.getUTCDate() >= TANGGAL_TUTUP_KPI ? bulan : bulanSebelum(bulan)");
  });
});

describe("tutup buku BUKAN tanggal batas buka outlet", () => {
  it("keduanya kebetulan lima belas, dan itu harus tetap dua konstanta", () => {
    expect(TANGGAL_TUTUP).toBe(15);
    expect(TANGGAL_BATAS_BUKA).toBe(15);
    const kode = sumber("src/lib/ops/finalisasi.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // Kalau suatu hari `finalisasi.ts` meminjam konstanta tanggal buka, menggeser
    // jadwal tutup buku akan diam-diam mengubah cara outlet baru dinilai.
    expect(kode).not.toContain("TANGGAL_BATAS_BUKA");
  });
});
