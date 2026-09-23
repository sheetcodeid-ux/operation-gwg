import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PapanCommandCenterUI } from "./papan-command-center";
import type { PapanCommandCenter, SignalTriase } from "@/lib/data/command-center";

/**
 * COMMAND CENTER BENAR-BENAR DIRENDER, bukan dibaca sebagai teks.
 *
 * Alasannya mahal dan sudah pernah terjadi di repositori ini: komponen klien
 * yang menerima prop dari halaman server adalah tempat kesalahan yang lolos
 * tsc, lint, tes, DAN build sekaligus — keempatnya hijau, halamannya mati.
 *
 * Yang dipastikan di sini juga yang paling mudah salah tanpa terlihat:
 * bulan berjalan wajib terbaca BERBEDA dari bulan yang sudah habis, dan
 * tombol Abaikan wajib hilang bagi yang tidak berhak.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const s = (o: Partial<SignalTriase> & { id: number }): SignalTriase => ({
  cakupan: "outlet",
  periode: "2026-09",
  outletId: "out_a",
  outletNama: "Nordu Coffee Perdana",
  areaNama: "Area Jayadi",
  kpiDefinitionId: "biaya.labor_pct",
  severity: "high",
  operator: "gt",
  nilaiActual: 27.05,
  nilaiAmbang: 13,
  nilaiAmbang2: null,
  statusKpi: "sementara",
  terdeteksiPada: "2026-09-17T13:18:44.000Z",
  nilaiTerakhir: 27.05,
  kondisiTerakhir: "lewat_ambang",
  statusKpiTerakhir: "sementara",
  diamatiPada: "2026-09-17T14:43:01.000Z",
  diakuiOleh: null,
  diakuiNama: null,
  diakuiPada: null,
  ...o,
});

const papan = (o: Partial<PapanCommandCenter> = {}): PapanCommandCenter => ({
  periode: null,
  bulanBerjalan: "2026-09",
  periodeTersedia: ["2026-09", "2026-08"],
  kelompok: [
    {
      periode: "2026-09",
      berjalan: true,
      outlet: [{ outletId: "out_a", outletNama: "Nordu Coffee Perdana", areaNama: "Area Jayadi", signal: [s({ id: 1 })] }],
    },
    {
      periode: "2026-08",
      berjalan: false,
      outlet: [{ outletId: "out_b", outletNama: "Cattu Sintang", areaNama: "Area Wisnu", signal: [s({ id: 2, periode: "2026-08", statusKpi: "final" })] }],
    },
  ],
  korporat: [s({ id: 3, cakupan: "korporat", outletId: null, outletNama: null, severity: "critical", kpiDefinitionId: "biaya.net_profit_pct" })],
  korporatDibaca: true,
  ringkas: { total: 3, critical: 1, high: 2, medium: 0, low: 0, diakui: 0, outletTerdampak: 2 },
  ...o,
});

describe("papan tergambar", () => {
  it("merender tanpa melempar", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan />);
    expect(html).toContain("Nordu Coffee Perdana");
    expect(html).toContain("Cattu Sintang");
  });

  it("bulan berjalan dan bulan penuh TERBACA BERBEDA", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan />);
    expect(html).toContain("MTD · indikasi");
    expect(html).toContain("bulan penuh");
  });

  it("korporat punya bagiannya sendiri, bukan baris outlet", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan />);
    expect(html).toContain("Corporate Signals");
    expect(html).toContain("Outlet Signals");
    expect(html).toContain("biaya.net_profit_pct");
  });

  it("korporat kosong TIDAK berbunyi aman", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan({ korporat: [] })} bolehAbaikan />);
    expect(html).toContain("Belum ada indikasi korporat");
    expect(html).toContain("bukan pernyataan bahwa semuanya aman");
  });
});

describe("tombol mengikuti izin", () => {
  it("yang berhak melihat Abaikan", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan />);
    expect(html).toContain("Abaikan");
  });

  it("yang TIDAK berhak tidak melihat Abaikan sama sekali", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan={false} />);
    expect(html).not.toContain("Abaikan");
    // "Sudah dilihat" tetap ada — mengakui mengikuti akses layar, bukan
    // `manage_signals`.
    expect(html).toContain("Sudah dilihat");
  });

  it("Signal yang sudah diakui menampilkan namanya, dan TIDAK hilang", () => {
    const p = papan();
    p.kelompok[0].outlet[0].signal = [s({ id: 1, diakuiOleh: "usr_1", diakuiNama: "Fikri", diakuiPada: "2026-09-20T02:00:00.000Z" })];
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={p} bolehAbaikan />);
    expect(html).toContain("dilihat Fikri");
    expect(html).toContain("biaya.labor_pct");
  });
});
