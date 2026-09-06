import { describe, expect, it } from "vitest";
import { bulanMulaiBerjalan } from "@/lib/data/kpi";

/**
 * Bulan buka hanya terhitung bila outletnya buka setidaknya separuh bulan.
 *
 * Kasus yang membuat aturan ini ada: Nordu Bakes Samarinda buka 31 Mei 2026.
 * ESB memuat penjualan untuk Mei — SATU HARI — jadi Mei lolos sebagai "bulan
 * berjalan", dan pada Agustus outlet itu sudah dianggap genap tiga bulan
 * padahal baru dua bulan satu hari. Yang salah bukan angkanya, melainkan
 * ukurannya: "ada penjualan di bulan itu" bukan hal yang sama dengan "berjalan
 * di bulan itu".
 */
describe("bulan pertama yang terhitung berjalan", () => {
  it("buka pada atau sebelum tanggal 15 — bulan itu terhitung", () => {
    expect(bulanMulaiBerjalan("2026-05-01")).toBe("2026-05");
    expect(bulanMulaiBerjalan("2026-05-15")).toBe("2026-05");
  });

  it("buka setelah tanggal 15 — hitungannya mulai bulan berikutnya", () => {
    expect(bulanMulaiBerjalan("2026-05-16")).toBe("2026-06");
    expect(bulanMulaiBerjalan("2026-05-31")).toBe("2026-06");
  });

  it("buka akhir Desember pindah ke Januari tahun berikutnya", () => {
    // Pergantian tahun adalah tempat aritmetika bulan paling sering meleset.
    expect(bulanMulaiBerjalan("2025-12-20")).toBe("2026-01");
    expect(bulanMulaiBerjalan("2025-12-15")).toBe("2025-12");
  });

  it("tanggal yang belum diketahui TIDAK ditebak", () => {
    // Kosong berarti aturan lama yang dipakai untuk outlet itu. Menebak
    // tanggal buka membuat outlet dinilai atas bulan yang tidak pernah ada.
    expect(bulanMulaiBerjalan(null)).toBeNull();
    expect(bulanMulaiBerjalan("")).toBeNull();
    expect(bulanMulaiBerjalan("bukan tanggal")).toBeNull();
  });

  it("Samarinda buka 31 Mei belum genap tiga bulan pada Agustus", () => {
    // Mulai berjalan Juni. Tiga bulan sebelum Agustus adalah Mei, Juni, Juli —
    // yang paling awal Mei, dan Juni datang SESUDAH Mei, jadi belum genap.
    const mulai = bulanMulaiBerjalan("2026-05-31")!;
    expect(mulai <= "2026-05").toBe(false);
    // Baru pada September ia genap: tiga bulan sebelumnya Juni, Juli, Agustus.
    expect(mulai <= "2026-06").toBe(true);
  });
});
