import { describe, expect, it } from "vitest";
import { barisKpi, persentaseCapaian, ringkasKpi } from "./hitung";
import { indikatorPosisi } from "./indikator";
import { POSISI, posisiDari } from "./struktur";
import { MENU_POSISI } from "./akses";

/**
 * Juknis KPI QC/AC 2026 — bobot dan rumusnya, dijaga angka per angka.
 *
 * Dokumennya menyebut enam indikator dengan bobot yang berjumlah tepat 100%.
 * Satu bobot yang tergeser tidak akan terlihat salah di layar: skornya tetap
 * angka yang masuk akal, hanya saja bukan skor yang dimaksud juknisnya.
 */
const ind = (key: string) => {
  const i = indikatorPosisi("pdq_qc").find((x) => x.key === key);
  if (!i) throw new Error(`indikator ${key} tidak ada`);
  return i;
};

describe("posisi Quality Assurance & Control", () => {
  it("terdaftar di departemen Product Development & Quality dengan PIC-nya", () => {
    const p = posisiDari("pdq_qc");
    expect(p?.nama).toBe("Quality Assurance & Control");
    expect(p?.departemen).toBe("pdq");
    expect(p?.pic).toContain("Radika");
  });

  it("punya menunya sendiri, dan menu itu dikenali", () => {
    expect(MENU_POSISI.pdq_qc).toBe("kpi_pdq_qc");
    expect(POSISI.some((p) => p.kode === "pdq_qc")).toBe(true);
  });

  it("enam indikator dengan bobot berjumlah tepat 100%", () => {
    const daftar = indikatorPosisi("pdq_qc");
    expect(daftar.map((i) => i.key)).toEqual([
      "qc_quality",
      "qc_hygiene",
      "qc_sop",
      "qc_complaint",
      "qc_cctv",
      "qc_reporting",
    ]);
    expect(daftar.reduce((s, i) => s + i.bobot, 0)).toBe(100);
  });

  it("bobotnya persis seperti juknis", () => {
    expect(ind("qc_quality").bobot).toBe(30);
    expect(ind("qc_hygiene").bobot).toBe(25);
    expect(ind("qc_sop").bobot).toBe(15);
    expect(ind("qc_complaint").bobot).toBe(15);
    expect(ind("qc_cctv").bobot).toBe(10);
    expect(ind("qc_reporting").bobot).toBe(5);
  });
});

describe("rumus tiap indikator", () => {
  it("compliance 95% adalah target penuh untuk quality, hygiene, dan SOP", () => {
    for (const key of ["qc_quality", "qc_hygiene", "qc_sop"]) {
      const i = ind(key);
      expect(i.target).toEqual({ jenis: "tetap", nilai: 95 });
      const b = barisKpi({ indikator: i, bobot: i.bobot, target: 95, actual: 95 });
      expect(b.persenActual, key).toBe(i.bobot);
    }
  });

  it("compliance di bawah target bernilai proporsional", () => {
    const b = barisKpi({ indikator: ind("qc_quality"), bobot: 30, target: 95, actual: 76 });
    expect(b.persentase).toBeCloseTo(80, 5);
    expect(b.persenActual).toBeCloseTo(24, 5);
  });

  it("Complaint: tiap komplain memotong 5%, sama seperti Coordinator Area", () => {
    // MENYIMPANG DARI JUKNIS ASLINYA, atas keputusan pemiliknya. Juknis menulis
    // "<=20 complaint = 15% | >20 = (20 / Actual) x 15%", dan itu membuat
    // sembilan belas komplain bernilai sama dengan nol komplain: indikatornya
    // diam sepanjang bulan lalu jatuh sekaligus. Yang dipakai sekarang rumus
    // Coordinator Area — satu komplain berharga 5% capaian indikator ini.
    expect(ind("qc_complaint").penilaian).toBe("kurang_linear");
    expect(persentaseCapaian(0, 20, "kurang_linear")).toBe(100);
    expect(persentaseCapaian(1, 20, "kurang_linear")).toBe(95);
    expect(persentaseCapaian(20, 20, "kurang_linear")).toBe(0);
    // Tidak pernah minus: 40 komplain dari batas 20 berarti nol, bukan −100%.
    expect(persentaseCapaian(40, 20, "kurang_linear")).toBe(0);
    const b = barisKpi({ indikator: ind("qc_complaint"), bobot: 15, target: 20, actual: 4 });
    expect(b.persentase).toBe(80);
    expect(b.persenActual).toBe(12);
  });

  it("CCTV: (actual ÷ 40) × 10%, dan di atas 40 tidak menambah", () => {
    const penuh = barisKpi({ indikator: ind("qc_cctv"), bobot: 10, target: 40, actual: 40 });
    expect(penuh.persenActual).toBe(10);
    const separuh = barisKpi({ indikator: ind("qc_cctv"), bobot: 10, target: 40, actual: 20 });
    expect(separuh.persenActual).toBe(5);
    const lebih = barisKpi({ indikator: ind("qc_cctv"), bobot: 10, target: 40, actual: 60 });
    expect(lebih.persenActual).toBe(10);
  });

  it("log CCTV wajib berbukti — monitoring tanpa bukti tidak bisa dibedakan dari yang tidak dilakukan", () => {
    expect(ind("qc_cctv").actual).toEqual({ sumber: "entri", entri: "cctv_qc" });
  });

  it("Reporting: target 100% tepat waktu", () => {
    const i = ind("qc_reporting");
    expect(i.target).toEqual({ jenis: "tetap", nilai: 100 });
    expect(barisKpi({ indikator: i, bobot: 5, target: 100, actual: 100 }).persenActual).toBe(5);
    expect(barisKpi({ indikator: i, bobot: 5, target: 100, actual: 80 }).persenActual).toBe(4);
  });
});

describe("skor akhir", () => {
  it("seluruhnya tercapai berarti 100%", () => {
    const nilai: Record<string, number> = {
      qc_quality: 95,
      qc_hygiene: 95,
      qc_sop: 95,
      // Nol komplain, bukan dua belas: dengan rumus Coordinator Area, dua belas
      // komplain sudah memotong 60% capaian indikatornya.
      qc_complaint: 0,
      qc_cctv: 40,
      qc_reporting: 100,
    };
    const target: Record<string, number> = {
      qc_quality: 95,
      qc_hygiene: 95,
      qc_sop: 95,
      qc_complaint: 20,
      qc_cctv: 40,
      qc_reporting: 100,
    };
    const baris = indikatorPosisi("pdq_qc").map((i) =>
      barisKpi({ indikator: i, bobot: i.bobot, target: target[i.key], actual: nilai[i.key] }),
    );
    expect(ringkasKpi(baris).skor).toBe(100);
  });

  it("indikator yang belum diisi tidak dihitung nol, melainkan belum terukur", () => {
    // Nol berarti "gagal total" — tuduhan yang berbeda dari "belum diukur",
    // dan bulan berjalan selalu punya indikator yang belum sempat diisi.
    const baris = indikatorPosisi("pdq_qc").map((i) =>
      barisKpi({ indikator: i, bobot: i.bobot, target: 95, actual: i.key === "qc_quality" ? 95 : null }),
    );
    const r = ringkasKpi(baris);
    expect(r.jumlahBelumTerukur).toBe(5);
    expect(r.bobotTerpakai).toBe(30);
  });
});
