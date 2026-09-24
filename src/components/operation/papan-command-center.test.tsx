import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PapanCommandCenterUI, jalanBuatWork } from "./papan-command-center";
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

/* ───────────── Z-02 · pintu "Buat Work" (OD-STEP7-04 = B) ───────────── */

/**
 * ┌─ COMMAND CENTER TETAP TIPIS, DAN ITU YANG DIUJI ─────────────────────────┐
 * │                                                                          │
 * │ Layar ini melayani produksi. Tombol Z-02 karena itu hanya BERPINDAH —    │
 * │ tidak membuka dialog, tidak menarik daftar pengguna, tidak menarik       │
 * │ departemen, tidak menyimpan state pembuatan Work. Kalau suatu hari salah │
 * │ satunya masuk ke sini, uji di bawah yang menolaknya.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
describe("tombol Buat Work", () => {
  it("muncul hanya ketika bolehBuatWork", () => {
    expect(renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan bolehBuatWork />)).toContain(
      "Buat Work",
    );
    expect(renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan />)).not.toContain("Buat Work");
    expect(
      renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan={false} bolehBuatWork={false} />),
    ).not.toContain("Buat Work");
  });

  it("izin Abaikan dan izin Buat Work dua pintu yang berbeda", () => {
    const html = renderToStaticMarkup(
      <PapanCommandCenterUI papan={papan()} bolehAbaikan={false} bolehBuatWork />,
    );
    expect(html).toContain("Buat Work");
    expect(html).not.toContain("Abaikan");
  });

  it("membawa Signal itu ke halaman Work — bukan sekadar membuka halamannya", () => {
    expect(jalanBuatWork(10)).toBe("/operational/work?buat=1&signal=10");
    expect(jalanBuatWork(341)).toBe("/operational/work?buat=1&signal=341");
    // Halaman Work yang menangani formnya; layar ini tidak menyebut form apa pun.
    expect(jalanBuatWork(1)).toContain("buat=1");
    expect(jalanBuatWork(1)).toContain("signal=1");
  });

  it("tombolnya terpasang pada baris Signal, satu per Signal yang tergambar", () => {
    const p = papan();
    const jumlah = p.korporat.length + p.kelompok.flatMap((k) => k.outlet.flatMap((o) => o.signal)).length;
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={p} bolehAbaikan bolehBuatWork />);
    expect(html.match(/Buat Work/g) ?? []).toHaveLength(jumlah);
  });

  it("layar ini tidak menarik data pilihan apa pun untuk pembuatan Work", () => {
    const sumber = readFileSync(join(process.cwd(), "src/components/operation/papan-command-center.tsx"), "utf8");
    const kode = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    for (const terlarang of ["getUsers", "getUserDepartments", "pilihanWork", "FormWorkBaru", "buatWorkAction"]) {
      expect(kode).not.toContain(terlarang);
    }
  });

  it("Akui dan Abaikan tidak tersentuh — keduanya tetap tergambar dan tetap memanggil action-nya", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan bolehBuatWork />);
    expect(html).toContain("Sudah dilihat");
    expect(html).toContain("Abaikan");
    const sumber = readFileSync(join(process.cwd(), "src/components/operation/papan-command-center.tsx"), "utf8");
    expect(sumber).toContain("akuiSignalAction");
    expect(sumber).toContain("abaikanSignalAction");
  });
});

/* ───────────────── Z-02 Step 8E · GAP-04 · lencana Work aktif ───────────────── */

/**
 * ┌─ LENCANA, BUKAN GERBANG ────────────────────────────────────────────────┐
 * │                                                                          │
 * │ D3 mengunci Signal ↔ Work sebagai N:N. Yang ditambahkan GAP-04 di layar  │
 * │ ini hanya keterangan: apakah Signalnya sudah ditangani pekerjaan yang    │
 * │ masih berjalan. Tombol "Buat Work" TIDAK boleh ikut mati karenanya, dan  │
 * │ layar ini TIDAK boleh berubah menjadi halaman kelola Work.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
describe("GAP-04 · Command Center menyebut Work yang masih berjalan", () => {
  it("tanpa data Work, tidak ada lencana yang dipaksa tampil", () => {
    const html = renderToStaticMarkup(<PapanCommandCenterUI papan={papan()} bolehAbaikan bolehBuatWork />);
    expect(html).not.toContain("Work aktif");
  });

  it("Signal yang punya Work berjalan mendapat lencana bercacah", () => {
    const html = renderToStaticMarkup(
      <PapanCommandCenterUI
        papan={papan()}
        bolehAbaikan
        bolehBuatWork
        workAktif={{
          "1": [
            { workId: 7, judul: "Perbaiki labor", status: "open", ownerId: "u_owner", ownerNama: "Owner Satu", tenggat: "2026-09-29T06:00:00.000Z" },
            { workId: 8, judul: "Negosiasi kontrak", status: "in_progress", ownerId: "u_owner2", ownerNama: "Owner Dua", tenggat: "2026-09-30T06:00:00.000Z" },
          ],
        }}
      />,
    );
    expect(html).toContain("2 Work aktif");
    // Hanya Signal #1 yang punya; yang lain tidak ikut tertandai.
    expect(html.match(/Work aktif/g) ?? []).toHaveLength(1);
  });

  it("lencananya TIDAK mematikan tombol Buat Work — N:N tetap berlaku", () => {
    const p = papan();
    const jumlah = p.korporat.length + p.kelompok.flatMap((k) => k.outlet.flatMap((o) => o.signal)).length;
    const html = renderToStaticMarkup(
      <PapanCommandCenterUI
        papan={p}
        bolehAbaikan
        bolehBuatWork
        workAktif={{
          "1": [{ workId: 7, judul: "X", status: "open", ownerId: "u_owner", ownerNama: "Owner Satu", tenggat: "2026-09-29T06:00:00.000Z" }],
        }}
      />,
    );
    expect(html.match(/Buat Work/g) ?? []).toHaveLength(jumlah);
    expect(html).toContain("1 Work aktif");
  });

  it("tidak satu kata pun menyatakan pembuatan Work kedua dilarang", () => {
    const html = renderToStaticMarkup(
      <PapanCommandCenterUI
        papan={papan()}
        bolehAbaikan
        bolehBuatWork
        workAktif={{
          "1": [{ workId: 7, judul: "X", status: "open", ownerId: "u_owner", ownerNama: "Owner Satu", tenggat: "2026-09-29T06:00:00.000Z" }],
        }}
      />,
    );
    const terbaca = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase();
    for (const klaim of ["dilarang", "tidak dapat dibuat", "tidak bisa dibuat", "hanya boleh satu", "duplikat"]) {
      expect(terbaca).not.toContain(klaim);
    }
  });

  it("layar ini tetap TIPIS — lencana saja, tanpa daftar Work, tautan, atau tombol baru", () => {
    const sumber = readFileSync(join(process.cwd(), "src/components/operation/papan-command-center.tsx"), "utf8");
    const kode = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // Tidak ada navigasi baru ke Work, dan tidak ada judul Work yang dirender.
    expect(kode).not.toContain("/operational/work/");
    expect(kode).not.toContain("next/link");
    expect(kode).not.toContain("w.judul");
    // Yang diturunkan hanya CACAHNYA — bukan barisnya.
    expect(kode).toContain("cacahWorkAktif={(workAktif?.[String(s.id)] ?? []).length}");
  });

  it("layar ini tetap tidak menarik data Work sendiri — ia hanya menerima prop", () => {
    const sumber = readFileSync(join(process.cwd(), "src/components/operation/papan-command-center.tsx"), "utf8");
    const kode = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    for (const terlarang of ["workAktifPerSignal", "selectAll", "server-only", "db()"]) {
      expect(kode).not.toContain(terlarang);
    }
  });

  it("halaman Command Center yang menariknya, sekali, untuk seluruh Signal yang tergambar", () => {
    const halaman = readFileSync(join(process.cwd(), "src/app/(app)/operational/command-center/page.tsx"), "utf8");
    expect(halaman).toContain("workAktifPerSignal(idSignal)");
    expect(halaman).toContain("workAktif={workAktif}");
    // Gerbang lama tidak bergeser satu pun.
    expect(halaman).toContain("if (!canReachMenu(user, MENU_COMMAND_CENTER)) redirect(\"/dashboard\");");
    expect(halaman).toContain('bolehBuatWork={can(user, "create_signal_work")}');
  });
});
