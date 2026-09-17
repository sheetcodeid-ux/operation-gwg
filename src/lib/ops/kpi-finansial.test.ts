import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DAFTAR_KPI_KEUANGAN,
  KPI_KEUANGAN,
  hitungKeuangan,
  persenOmzet,
  type AngkaOutlet,
  type MasukanKeuangan,
} from "./kpi-finansial";
import type { NilaiKpi } from "./kpi-sales";
import { DEFAULT_SETTINGS } from "./settings-types";

/**
 * KPI KEUANGAN — yang diuji di sini PEMBAGI DAN KEKOSONGAN.
 *
 * Aritmetikanya sepele; yang tidak sepele adalah apa yang terjadi ketika
 * omzetnya nol, ketika outletnya belum melapor, dan ketika sebuah kolom kosong
 * bukan karena nol melainkan karena belum pernah ada. Ketiganya menghasilkan
 * angka yang terlihat wajar kalau ditangani asal-asalan.
 */

const outlet = (ubah: Partial<AngkaOutlet> = {}): AngkaOutlet => ({
  outletId: "o1",
  areaId: "a1",
  sales: 1_000_000,
  adaLaporan: true,
  warehouse: null,
  nonWarehouse: null,
  hpp: null,
  labaBersih: null,
  tenagaKerja: null,
  sewa: null,
  lainnya: null,
  listrik: null,
  air: null,
  internet: null,
  kebersihan: null,
  platformFee: null,
  pbjt: null,
  ...ubah,
});

const masuk = (ubah: Partial<MasukanKeuangan> = {}): MasukanKeuangan => ({
  periode: "2026-08",
  outlets: [outlet()],
  periodeSelesai: true,
  ...ubah,
});

const ambil = (n: NilaiKpi[], kpi: string, outletId: string | null = "o1"): NilaiKpi =>
  n.find((x) => x.kpiDefinitionId === kpi && x.outletId === outletId)!;
const korp = (n: NilaiKpi[], kpi: string): NilaiKpi =>
  n.find((x) => x.kpiDefinitionId === kpi && x.cakupan === "korporat")!;

/* ─────────────────── pembagi ─────────────────── */

describe("omzet nol tidak pernah jadi 0%", () => {
  it("nol menghasilkan null, bukan Infinity dan bukan NaN", () => {
    expect(persenOmzet(500, 0)).toBeNull();
    expect(persenOmzet(500, null)).toBeNull();
    expect(persenOmzet(500, -100)).toBeNull();
    expect(persenOmzet(null, 1_000)).toBeNull();
  });

  it("seluruh KPI outlet beromzet nol berstatus tidak_tersedia", () => {
    const h = hitungKeuangan(masuk({ outlets: [outlet({ sales: 0, tenagaKerja: 500_000 })] }));
    const baris = h.nilai.filter((x) => x.outletId === "o1");
    expect(baris).toHaveLength(14);
    for (const b of baris) {
      expect(b.nilai).toBeNull();
      expect(b.status).toBe("tidak_tersedia");
      expect(Number.isFinite(b.nilai as number)).toBe(false);
    }
    expect(ambil(h.nilai, KPI_KEUANGAN.labor).catatan).toContain("Omzet nol");
    expect(h.tanpaOmzet).toEqual(["o1"]);
  });

  it("biaya besar dengan omzet nol tetap null — bukan persentase raksasa", () => {
    const h = hitungKeuangan(masuk({ outlets: [outlet({ sales: 0, hpp: 99_000_000 })] }));
    expect(ambil(h.nilai, KPI_KEUANGAN.hpp).nilai).toBeNull();
  });
});

/* ─────────────────── rumus ─────────────────── */

describe("rumus keempat belasnya", () => {
  const penuh = outlet({
    sales: 1_000_000,
    warehouse: 300_000,
    nonWarehouse: 50_000,
    hpp: 350_000,
    labaBersih: 200_000,
    tenagaKerja: 130_000,
    sewa: 50_000,
    lainnya: 30_000,
    listrik: 40_000,
    air: 10_000,
    internet: 10_000,
    kebersihan: 5_000,
    platformFee: 70_000,
    pbjt: 25_000,
  });

  const h = hitungKeuangan(masuk({ outlets: [penuh] }));

  it.each([
    [KPI_KEUANGAN.warehouse, 30],
    [KPI_KEUANGAN.nonWarehouse, 5],
    [KPI_KEUANGAN.totalPurchase, 35],
    [KPI_KEUANGAN.hpp, 35],
    [KPI_KEUANGAN.labor, 13],
    [KPI_KEUANGAN.rent, 5],
    [KPI_KEUANGAN.electricity, 4],
    [KPI_KEUANGAN.water, 1],
    [KPI_KEUANGAN.internet, 1],
    [KPI_KEUANGAN.cleaning, 0.5],
    [KPI_KEUANGAN.other, 3],
    [KPI_KEUANGAN.netProfit, 20],
    [KPI_KEUANGAN.platformFee, 7],
    [KPI_KEUANGAN.pbjt, 2.5],
  ])("%s", (kpi, harap) => {
    expect(ambil(h.nilai, kpi).nilai).toBeCloseTo(harap, 9);
  });

  it("total purchase = warehouse + non-warehouse, bukan angka ketiga", () => {
    const w = ambil(h.nilai, KPI_KEUANGAN.warehouse).nilai!;
    const n = ambil(h.nilai, KPI_KEUANGAN.nonWarehouse).nilai!;
    expect(ambil(h.nilai, KPI_KEUANGAN.totalPurchase).nilai).toBeCloseTo(w + n, 9);
  });

  it("empat belas baris per outlet, tidak kurang dan tidak lebih", () => {
    expect(h.nilai.filter((x) => x.outletId === "o1")).toHaveLength(14);
    expect(DAFTAR_KPI_KEUANGAN).toHaveLength(14);
    expect(new Set(DAFTAR_KPI_KEUANGAN).size).toBe(14);
  });
});

/* ─────────────────── kosong versus nol ─────────────────── */

describe("kosong dan nol tidak pernah tertukar", () => {
  it("kolom baru yang NULL: tidak_tersedia, bukan 0%", () => {
    const h = hitungKeuangan(masuk({ outlets: [outlet({ listrik: null, platformFee: null, pbjt: null })] }));
    for (const kpi of [KPI_KEUANGAN.electricity, KPI_KEUANGAN.platformFee, KPI_KEUANGAN.pbjt]) {
      expect(ambil(h.nilai, kpi).nilai).toBeNull();
      expect(ambil(h.nilai, kpi).status).toBe("tidak_tersedia");
    }
  });

  it("kolom baru yang benar-benar NOL: 0%, dan itu berbeda", () => {
    const h = hitungKeuangan(masuk({ outlets: [outlet({ listrik: 0, platformFee: 0, pbjt: 0 })] }));
    for (const kpi of [KPI_KEUANGAN.electricity, KPI_KEUANGAN.platformFee, KPI_KEUANGAN.pbjt]) {
      expect(ambil(h.nilai, kpi).nilai).toBe(0);
      expect(ambil(h.nilai, kpi).status).toBe("final");
    }
  });

  it("alasan kosongnya disebut, tidak didiamkan", () => {
    const h = hitungKeuangan(masuk({ outlets: [outlet()] }));
    expect(ambil(h.nilai, KPI_KEUANGAN.electricity).catatan).toContain("menyatu di dalam Utilitas");
    expect(ambil(h.nilai, KPI_KEUANGAN.platformFee).catatan).toContain("belum pernah dilaporkan");
    expect(ambil(h.nilai, KPI_KEUANGAN.pbjt).catatan).toContain("belum pernah dilaporkan");
  });

  it("outlet TANPA baris finansial berbeda dari outlet yang melapor nol", () => {
    const belum = hitungKeuangan(masuk({ outlets: [outlet({ adaLaporan: false })] }));
    const nol = hitungKeuangan(masuk({ outlets: [outlet({ tenagaKerja: 0 })] }));
    expect(ambil(belum.nilai, KPI_KEUANGAN.labor).nilai).toBeNull();
    expect(ambil(belum.nilai, KPI_KEUANGAN.labor).catatan).toContain("belum melaporkan");
    expect(ambil(nol.nilai, KPI_KEUANGAN.labor).nilai).toBe(0);
    expect(belum.tanpaLaporan).toEqual(["o1"]);
    expect(nol.tanpaLaporan).toEqual([]);
  });

  it("outlet yang belum melapor TETAP menghasilkan empat belas baris", () => {
    // Outlet yang hilang dari hasil tidak bisa dibedakan dari outlet yang
    // terlewat dihitung — dan yang kedua justru yang perlu kelihatan.
    const h = hitungKeuangan(masuk({ outlets: [outlet({ adaLaporan: false })] }));
    expect(h.nilai.filter((x) => x.outletId === "o1")).toHaveLength(14);
  });
});

/* ─────────────────── korporat ─────────────────── */

describe("korporat dijumlah dulu, baru dibagi", () => {
  const kecil = outlet({ outletId: "kecil", sales: 20_000_000, tenagaKerja: 10_000_000 }); // 50%
  const besar = outlet({ outletId: "besar", sales: 900_000_000, tenagaKerja: 90_000_000 }); // 10%

  it("BUKAN rata-rata persen tiap outlet", () => {
    const h = hitungKeuangan(masuk({ outlets: [kecil, besar] }));
    // Rata-rata persen: (50 + 10) / 2 = 30 — dan itu salah.
    // Yang benar: 100 juta / 920 juta = 10,87%.
    const k = korp(h.nilai, KPI_KEUANGAN.labor).nilai!;
    expect(k).toBeCloseTo((100_000_000 / 920_000_000) * 100, 9);
    expect(k).not.toBeCloseTo(30, 1);
  });

  it("outlet tanpa omzet tidak menyumbang pembilang maupun penyebut", () => {
    // Memasukkan biayanya tanpa omzetnya membuat persen korporat naik tanpa sebab.
    const tanpa = outlet({ outletId: "sepi", sales: 0, tenagaKerja: 5_000_000 });
    const h = hitungKeuangan(masuk({ outlets: [besar, tanpa] }));
    expect(korp(h.nilai, KPI_KEUANGAN.labor).nilai).toBeCloseTo(10, 9);
  });

  it("outlet yang belum melapor juga tidak ikut", () => {
    const h = hitungKeuangan(masuk({ outlets: [besar, outlet({ outletId: "x", adaLaporan: false, sales: 500_000_000 })] }));
    expect(korp(h.nilai, KPI_KEUANGAN.labor).nilai).toBeCloseTo(10, 9);
  });

  it("tidak ada satu pun yang melaporkan: null, bukan nol", () => {
    const h = hitungKeuangan(masuk({ outlets: [outlet({ platformFee: null })] }));
    expect(korp(h.nilai, KPI_KEUANGAN.platformFee).nilai).toBeNull();
    expect(korp(h.nilai, KPI_KEUANGAN.platformFee).status).toBe("tidak_tersedia");
  });

  it("sebagian melaporkan: yang melapor tetap dihitung", () => {
    const a = outlet({ outletId: "a", sales: 100, platformFee: 10 });
    const b = outlet({ outletId: "b", sales: 100, platformFee: null });
    // 10 dari omzet gabungan 200 = 5%. Outlet b ikut penyebut karena omzetnya
    // sah — yang belum ada hanya angka platform fee-nya.
    expect(korp(hitungKeuangan(masuk({ outlets: [a, b] })).nilai, KPI_KEUANGAN.platformFee).nilai).toBeCloseTo(5, 9);
  });

  it("empat belas baris korporat, tanpa outlet dan tanpa area", () => {
    const h = hitungKeuangan(masuk({ outlets: [besar] }));
    const k = h.nilai.filter((x) => x.cakupan === "korporat");
    expect(k).toHaveLength(14);
    for (const b of k) {
      expect(b.outletId).toBeNull();
      expect(b.areaId).toBeNull();
    }
  });
});

/* ─────────────────── periode ─────────────────── */

describe("bulan berjalan belum boleh disebut final", () => {
  it("periode selesai → final; belum selesai → sementara", () => {
    const isi = outlet({ tenagaKerja: 100_000 });
    expect(ambil(hitungKeuangan(masuk({ outlets: [isi] })).nilai, KPI_KEUANGAN.labor).status).toBe("final");
    expect(
      ambil(hitungKeuangan(masuk({ outlets: [isi], periodeSelesai: false })).nilai, KPI_KEUANGAN.labor).status,
    ).toBe("sementara");
  });

  it("periodenya selalu YYYY-MM dan skalanya bulanan", () => {
    for (const b of hitungKeuangan(masuk()).nilai) {
      expect(b.periode).toMatch(/^\d{4}-\d{2}$/);
      expect(b.skala).toBe("bulanan");
    }
  });
});

/* ─────────────────── grain ─────────────────── */

describe("satu outlet + satu periode + satu KPI = satu baris", () => {
  it("tidak ada baris kembar, juga dengan banyak outlet", () => {
    const h = hitungKeuangan(
      masuk({ outlets: [outlet({ outletId: "a" }), outlet({ outletId: "b" }), outlet({ outletId: "c" })] }),
    );
    const kunci = h.nilai.map((x) => `${x.kpiDefinitionId}|${x.cakupan}|${x.outletId ?? "-"}|${x.periode}|${x.skala}`);
    expect(new Set(kunci).size).toBe(kunci.length);
    expect(kunci).toHaveLength(3 * 14 + 14);
  });

  it("cakupan selalu sepakat dengan penunjuk yang terisi", () => {
    // CHECK `kpi_values_cakupan_cocok` menolak yang tidak sepakat.
    for (const b of hitungKeuangan(masuk()).nilai) {
      if (b.cakupan === "outlet") {
        expect(b.outletId).not.toBeNull();
        expect(b.areaId).toBeNull();
      } else {
        expect(b.outletId).toBeNull();
        expect(b.areaId).toBeNull();
      }
    }
  });

  it("status yang menyatakan tidak ada tidak pernah membawa angka", () => {
    // CHECK `kpi_values_nilai_sepakat` menolak yang membawa.
    for (const b of hitungKeuangan(masuk({ outlets: [outlet({ sales: 0 }), outlet({ outletId: "z" })] })).nilai) {
      if (b.status === "tidak_tersedia" || b.status === "invalid") expect(b.nilai).toBeNull();
    }
  });
});

/* ─────────────────── penjaga sumber ─────────────────── */

describe("sumber-of-truth tidak boleh bergeser", () => {
  const kode = readFileSync(join(process.cwd(), "src/lib/ops/kpi-finansial.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("murni — tidak menyentuh basis data", () => {
    expect(kode).not.toContain('import "server-only"');
    expect(kode.toLowerCase()).not.toContain("supabase");
    expect(kode).not.toMatch(/\bawait\b/);
    expect(kode).not.toMatch(/\basync\b/);
  });

  it("TIDAK pernah memakai op_pnl.pendapatan sebagai omzet", () => {
    // Nol di seluruh 174 baris — memakainya membuat setiap KPI membagi nol.
    expect(kode).not.toMatch(/\bpendapatan\b/);
  });

  it("laba bersih diambil apa adanya, tidak dihitung ulang", () => {
    // `sales - hpp - beban` hanya boleh jadi rekonsiliasi, bukan sumber.
    expect(kode).not.toMatch(/labaBersih\s*=\s*.*sales/);
    expect(kode).not.toMatch(/sales\s*-\s*.*hpp/);
  });

  it("tidak ada ambang yang ditanam — governance-nya Phase 3", () => {
    // Angka 30/5/35/13/3/30 tidak boleh muncul sebagai tetapan di sini.
    expect(kode).not.toMatch(/ambang|threshold|batas/i);
  });

  it("kode definisinya sama persis dengan migrasi 0105", () => {
    const migrasi = readFileSync(join(process.cwd(), "supabase/migrations/0105_kpi_definitions_keuangan.sql"), "utf8");
    for (const id of DAFTAR_KPI_KEUANGAN) expect(migrasi, id).toContain(`'${id}'`);
  });

  it("istilah lama TIDAK diubah — hpp_kpk tetap milik KPI Supervisor", () => {
    const lama = readFileSync(join(process.cwd(), "src/lib/kpi/hitung.ts"), "utf8");
    expect(lama).toContain("export function hppKpkPersen(");
    // Dan yang baru tidak menyentuhnya.
    expect(kode).not.toContain("hppKpkPersen");
  });
});

/* ─────────────────── ambang tetap milik Phase 3 ─────────────────── */

describe("governance TIDAK ikut pindah ke Phase 2C", () => {
  it("op_settings.sewa BAWAANNYA TETAP 3 — bukan 5", () => {
    // Keputusan AD-02: V.1 memakai 5% lewat Rule Version tersendiri, dan angka
    // existing tidak diubah. Phase 2C hanya menghitung Rent %, tidak menilainya.
    // Kalau suatu hari seseorang mengubah bawaannya jadi 5 "supaya cocok",
    // seluruh laporan lama ikut dinilai ulang dengan aturan yang belum berlaku
    // saat itu — dan uji ini yang menahannya.
    expect(DEFAULT_SETTINGS.expenseThresholds.sewa).toBe(3);
  });

  it("angka 5 untuk sewa tidak ditanam di berkas KPI keuangan mana pun", () => {
    const kode = readFileSync(join(process.cwd(), "src/lib/ops/kpi-finansial.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(kode).not.toMatch(/sewa\s*[:=]\s*5\b/);
    expect(kode).not.toMatch(/rent\s*[:=]\s*5\b/i);
  });

  it("seluruh ambang existing tetap di tempatnya, tidak tersentuh", () => {
    // Daftarnya dibaca apa adanya — kalau ada yang berubah diam-diam demi
    // menyelesaikan Phase 2C, ini yang gagal lebih dulu.
    expect(DEFAULT_SETTINGS.expenseThresholds).toEqual({
      utilitas: 3,
      sewa: 3,
      tenaga_kerja: 13,
      potongan: 3,
      manajemen_fee: 3,
      pemasaran: 3,
      ongkos_kirim: 3,
      lainnya: 3,
    });
    expect(DEFAULT_SETTINGS.purchaseLimits).toEqual({ warehouse: 30, nonWarehouse: 5, total: 35 });
    expect(DEFAULT_SETTINGS.marginBands).toEqual({ sehat: 30, cukup: 29, kritis: 15 });
  });
});
