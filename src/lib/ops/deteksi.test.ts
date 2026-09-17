import { describe, expect, it } from "vitest";
import { BATAS_SUSULAN, bolehDiremediasi, KUNCI_WATERMARK, rencanaDeteksi, REMEDIASI_DIIZINKAN } from "./deteksi";

/**
 * YANG DIJAGA DI SINI ADALAH SATU KALIMAT: tidak ada periode yang boleh lewat
 * tanpa pernah dinilai.
 *
 * Lubang Agustus 2026 lahir karena himpunan periodenya disimpulkan dari apa
 * yang kebetulan terjadi pada satu jalan — "bulan berjalan + yang baru
 * ditutup" — bukan dari catatan tentang apa yang sudah pernah dikerjakan.
 * Perbedaannya baru terasa tepat sekali: pada jalan pertama.
 */

// 17 September 2026, 20.00 WIB → bulan berjalan 2026-09.
const SEP = Date.parse("2026-09-17T13:00:00Z");

describe("bootstrap — belum ada watermark sama sekali", () => {
  it("menarik seluruh bulan SELESAI sejak periode KPI paling awal", () => {
    const r = rencanaDeteksi(null, "2026-08", SEP);
    expect(r.susulan).toEqual(["2026-08"]);
    expect(r.berjalan).toBe("2026-09");
    expect(r.seluruh).toEqual(["2026-08", "2026-09"]);
  });

  it("INILAH kasus Agustus — final sebelum Phase 4 ada, dan tetap terjaring", () => {
    // Tanpa watermark, satu-satunya pintu adalah `periodeDifinalisasi`, dan ia
    // kosong karena Agustus sudah ditutup jauh sebelumnya.
    expect(rencanaDeteksi(null, "2026-08", SEP).susulan).toContain("2026-08");
  });

  it("bulan paling awal diturunkan dari data, bukan ditulis di kode", () => {
    expect(rencanaDeteksi(null, "2026-05", SEP).susulan).toEqual(["2026-05", "2026-06", "2026-07", "2026-08"]);
  });

  it("belum ada KPI sama sekali: hanya bulan berjalan", () => {
    const r = rencanaDeteksi(null, null, SEP);
    expect(r.susulan).toEqual([]);
    expect(r.seluruh).toEqual(["2026-09"]);
  });

  it("KPI paling awal justru bulan berjalan: tidak ada tunggakan", () => {
    expect(rencanaDeteksi(null, "2026-09", SEP).susulan).toEqual([]);
  });
});

describe("watermark menentukan tunggakan", () => {
  it("mulai dari bulan SESUDAH watermark", () => {
    expect(rencanaDeteksi("2026-05", "2026-01", SEP).susulan).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("periode yang sudah dinilai tidak diproses lagi", () => {
    expect(rencanaDeteksi("2026-08", "2026-08", SEP).susulan).toEqual([]);
  });

  it("watermark sudah menyusul bulan berjalan: tidak ada tunggakan", () => {
    expect(rencanaDeteksi("2026-09", "2026-08", SEP).susulan).toEqual([]);
    expect(rencanaDeteksi("2026-12", "2026-08", SEP).susulan).toEqual([]);
  });

  it("urutannya deterministik — tertua lebih dulu", () => {
    const s = rencanaDeteksi("2025-11", "2025-01", SEP).susulan;
    expect(s).toEqual([...s].sort());
    expect(s[0]).toBe("2025-12");
  });

  it("melompati tahun dengan benar", () => {
    expect(rencanaDeteksi("2025-11", "2025-01", SEP).susulan.slice(0, 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("watermark tidak sah ditolak, bukan diabaikan diam-diam", () => {
    expect(() => rencanaDeteksi("2026-13", "2026-08", SEP)).toThrow(/watermark tidak sah/);
    expect(() => rencanaDeteksi("bukan-bulan", "2026-08", SEP)).toThrow(/watermark tidak sah/);
  });
});

describe("bulan berjalan berdiri di luar watermark", () => {
  it("SELALU ikut dinilai, apa pun isi watermarknya", () => {
    for (const w of [null, "2026-07", "2026-08", "2026-09", "2027-01"]) {
      expect(rencanaDeteksi(w, "2026-08", SEP).seluruh).toContain("2026-09");
    }
  });

  it("tidak pernah masuk daftar tunggakan", () => {
    // Kalau ia masuk, watermark akan melangkahinya dan bulan berjalan berhenti
    // dinilai ulang esok hari — Signal berhenti mengikuti angkanya sendiri.
    for (const w of [null, "2026-06", "2026-08"]) {
      expect(rencanaDeteksi(w, "2026-01", SEP).susulan).not.toContain("2026-09");
    }
  });

  it("dinilai paling akhir", () => {
    const r = rencanaDeteksi(null, "2026-06", SEP);
    expect(r.seluruh[r.seluruh.length - 1]).toBe("2026-09");
  });
});

describe("tunggakan panjang dipotong, bukan menghabiskan jatah waktu rute", () => {
  it("maksimal BATAS_SUSULAN per jalan", () => {
    const r = rencanaDeteksi(null, "2020-01", SEP);
    expect(r.susulan).toHaveLength(BATAS_SUSULAN);
    expect(r.dipotong).toBe(true);
  });

  it("yang dipotong menyusul di jalan berikutnya — tidak ada yang hilang", () => {
    const a = rencanaDeteksi(null, "2020-01", SEP);
    const b = rencanaDeteksi(a.susulan[a.susulan.length - 1], "2020-01", SEP);
    expect(b.susulan[0]).toBe("2021-01");
    expect(b.dipotong).toBe(true);
  });

  it("tunggakan pendek tidak ditandai dipotong", () => {
    expect(rencanaDeteksi("2026-06", "2026-06", SEP).dipotong).toBe(false);
  });
});

describe("pintu remediasi memakai daftar putih, bukan pemeriksaan bentuk", () => {
  it("2026-08 diizinkan — satu-satunya, dan alasannya tercatat", () => {
    expect(REMEDIASI_DIIZINKAN).toEqual(["2026-08"]);
    expect(bolehDiremediasi("2026-08")).toBe(true);
  });

  it("bulan lain ditolak walau bentuknya benar", () => {
    for (const p of ["2026-09", "2026-07", "2025-01", "2027-12"]) {
      expect(bolehDiremediasi(p)).toBe(false);
    }
  });

  it("bentuk yang salah ditolak", () => {
    for (const p of ["", "2026-8", "2026-13", "agustus", "2026-08-01", "'; drop table signals; --"]) {
      expect(bolehDiremediasi(p)).toBe(false);
    }
  });
});

describe("kunci watermark", () => {
  it("satu aliran bulanan, namanya menyebut skalanya", () => {
    expect(KUNCI_WATERMARK).toBe("signal_watermark_bulanan");
  });
});
