import { describe, expect, it } from "vitest";
import {
  LABEL_PERAN_PEMOHON,
  LABEL_STATUS_INTERVENSI,
  LABEL_URGENSI_INTERVENSI,
  PERAN_PEMOHON,
  peranPemohonUntuk,
  STATUS_INTERVENSI,
  URGENSI_INTERVENSI,
} from "./intervensi";
import { TABEL_HCMOS } from "./tabel";

/**
 * Aturan intervensi berasal dari satu kalimat di Meeting Fitur HRD: permintaan
 * datang dari SATU LAPIS DI ATAS orang yang bersangkutan. Kalimatnya pendek dan
 * mudah tertukar arah — itulah yang diuji di sini.
 */

describe("siapa yang meminta intervensi", () => {
  it("anggota tim bermasalah → head divisinya yang meminta", () => {
    expect(peranPemohonUntuk("anggota")).toBe("head");
  });

  it("head divisi bermasalah → Owner yang meminta", () => {
    // Head tidak pernah meminta intervensi untuk dirinya sendiri.
    expect(peranPemohonUntuk("head")).toBe("owner");
  });

  it("tidak pernah mengembalikan peran yang sama dengan posisinya", () => {
    expect(peranPemohonUntuk("head")).not.toBe("head");
  });
});

describe("daftar nilai selaras dengan basis data", () => {
  /**
   * Batasan `check` di tabel `hc_interventions` menolak nilai di luar daftar.
   * Kalau layar menawarkan pilihan yang tidak ada di sana, gejalanya
   * membingungkan: pilihannya ada, tapi simpannya gagal tanpa alasan jelas.
   */
  it("tiap nilai punya label", () => {
    for (const v of PERAN_PEMOHON) expect(LABEL_PERAN_PEMOHON[v], v).toBeTruthy();
    for (const v of STATUS_INTERVENSI) expect(LABEL_STATUS_INTERVENSI[v], v).toBeTruthy();
    for (const v of URGENSI_INTERVENSI) expect(LABEL_URGENSI_INTERVENSI[v], v).toBeTruthy();
  });

  it("tidak ada label untuk nilai yang tidak dikenal", () => {
    expect(Object.keys(LABEL_PERAN_PEMOHON).sort()).toEqual([...PERAN_PEMOHON].sort());
    expect(Object.keys(LABEL_STATUS_INTERVENSI).sort()).toEqual([...STATUS_INTERVENSI].sort());
    expect(Object.keys(LABEL_URGENSI_INTERVENSI).sort()).toEqual([...URGENSI_INTERVENSI].sort());
  });

  it("kolom yang dipakai formulir memang boleh ditulis", () => {
    // Daftar putih kolom itu yang menjaga tindakan umum HC-MOS tetap aman;
    // kolom yang tidak terdaftar diam-diam dibuang saat menyimpan.
    const boleh = new Set<string>(TABEL_HCMOS.hc_interventions);
    for (const k of ["nama", "jabatan", "divisi", "scope", "outlet_id", "pemohon", "peran_pemohon", "tanggal", "gejala", "urgensi", "tindakan", "status", "catatan"]) {
      expect(boleh.has(k), k).toBe(true);
    }
  });
});
