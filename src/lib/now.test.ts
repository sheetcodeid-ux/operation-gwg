import { describe, expect, it } from "vitest";
import { isoTanggalLokal, todayIso } from "./now";

/**
 * Penjaga terhadap tanggal yang mundur satu hari.
 *
 * Pola `new Date().toISOString().slice(0, 10)` sempat tersebar di beberapa
 * halaman. Terlihat benar, dan memang benar sepanjang siang — tapi mengubah
 * waktu ke UTC lebih dulu, sehingga di Indonesia (UTC+7) setiap saat antara
 * pukul 00.00 dan 07.00 hasilnya adalah tanggal KEMARIN.
 *
 * Uji ini memakai jam-jam di dalam rentang itu, karena di situlah bedanya
 * terlihat; memakai jam siang saja tidak akan pernah menangkap kesalahannya.
 */
describe("isoTanggalLokal", () => {
  it("memakai tanggal lokal, bukan tanggal UTC", () => {
    // 01.30 waktu lokal pada 15 Agustus. Kalau dihitung lewat UTC pada zona
    // UTC+7, ini jatuh ke 14 Agustus — persis kesalahannya.
    const d = new Date(2026, 7, 15, 1, 30, 0);
    expect(isoTanggalLokal(d)).toBe("2026-08-15");
  });

  it("tetap benar tepat setelah tengah malam", () => {
    const d = new Date(2026, 0, 1, 0, 0, 1);
    expect(isoTanggalLokal(d)).toBe("2026-01-01");
  });

  it("tetap benar menjelang tengah malam", () => {
    const d = new Date(2026, 11, 31, 23, 59, 59);
    expect(isoTanggalLokal(d)).toBe("2026-12-31");
  });

  it("menuliskan bulan dan tanggal satu digit dengan angka nol di depan", () => {
    expect(isoTanggalLokal(new Date(2026, 2, 5, 12, 0, 0))).toBe("2026-03-05");
  });

  it("todayIso memakai bentuk yang sama", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayIso()).toBe(isoTanggalLokal(new Date()));
  });
});
