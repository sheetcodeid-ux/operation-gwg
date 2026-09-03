import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INDIKATOR } from "./indikator";
import { POSISI, type KodePosisi } from "./struktur";

/**
 * Panel tambahan tidak boleh tercampur antar-posisi.
 *
 * Efisiensi Beban Operasional dan Keberhasilan Pasar milik Product Development
 * & Quality; Invoice Management Fee milik Accounting. Ketiganya sempat tampil
 * bersamaan di halaman Content Creator — itu keliru, dan keliru yang mahal:
 * orang yang membacanya menyimpulkan modulnya mengacak urutan departemen yang
 * sudah ditetapkan.
 *
 * Yang dijaga di sini bukan tampilannya, melainkan SUMBER-nya: sebuah panel
 * hanya boleh disusun kalau posisi itu benar-benar punya indikator yang
 * memakainya. Selama aturan itu dipegang, panel yang salah tidak punya jalan
 * untuk muncul di layar.
 */

const data = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");
const papan = readFileSync(join(process.cwd(), "src/components/kpi/papan-kpi.tsx"), "utf8");

const punyaIndikator = (posisi: KodePosisi, key: string) => INDIKATOR[posisi].some((i) => i.key === key);

describe("panel hanya milik posisi yang memakainya", () => {
  it("Efisiensi Beban Operasional hanya di Food Staff dan Beverage Staff", () => {
    const punya = POSISI.filter((p) => punyaIndikator(p.kode, "efisiensi")).map((p) => p.kode);
    expect(punya.sort()).toEqual(["pdq_beverage", "pdq_food"]);
  });

  it("Keberhasilan Pasar hanya di empat posisi Product Development & Quality", () => {
    const punya = POSISI.filter((p) => punyaIndikator(p.kode, "keberhasilan_pasar")).map((p) => p.kode);
    expect(punya.sort()).toEqual(["pdq_beverage", "pdq_food", "pdq_head_food", "pdq_head_pdq"]);
    // Semuanya di departemen yang sama — tidak ada yang bocor ke Creative.
    expect(new Set(POSISI.filter((p) => punya.includes(p.kode)).map((p) => p.departemen))).toEqual(new Set(["pdq"]));
  });

  it("Invoice Management Fee hanya di Accounting", () => {
    const punya = POSISI.filter((p) => punyaIndikator(p.kode, "management_fee")).map((p) => p.kode);
    expect(punya).toEqual(["finance_accounting"]);
  });

  it("tidak satu pun posisi Creative memakai ketiganya", () => {
    for (const p of POSISI.filter((x) => x.departemen === "creative")) {
      const kunci = INDIKATOR[p.kode].map((i) => i.key);
      expect(kunci, p.nama).not.toContain("efisiensi");
      expect(kunci, p.nama).not.toContain("keberhasilan_pasar");
      expect(kunci, p.nama).not.toContain("management_fee");
    }
  });
});

describe("panel disusun dari indikatornya, bukan dari daftar terpisah", () => {
  it("Management Fee dibangun hanya bila indikatornya ada", () => {
    // Daftar posisi yang ditulis tangan akan lupa diperbarui saat indikatornya
    // dipindah; menurunkannya dari indikator membuat keduanya tidak bisa beda.
    expect(data).toContain('i.actual.kode === "management_fee"');
  });

  it("panel yang tidak dipakai dikirim sebagai null, bukan disembunyikan di layar", () => {
    // Disembunyikan di layar, isinya tetap ikut terkirim ke peramban — dan
    // rincian biaya seluruh outlet bukan sesuatu yang layak menumpang di
    // halaman posisi yang tidak berkepentingan.
    expect(data).toContain("let efisiensi: LaporanKpi[\"efisiensi\"] = null;");
    expect(data).toContain("let pasar: DetailPasar | null = null;");
    expect(data).toContain("let fee: DetailFee[] | null = null;");
    expect(papan).toContain("{laporan.efisiensi && <PanelEfisiensi");
    expect(papan).toContain("{laporan.fee && <PanelFee");
    expect(papan).toContain("{laporan.pasar && <PanelPasar");
  });
});

describe("tampilannya mengikuti Work Tracker", () => {
  const wtDonut = readFileSync(join(process.cwd(), "src/components/work/work-role-donut.tsx"), "utf8");
  const wtChart = readFileSync(join(process.cwd(), "src/components/work/work-performance-chart.tsx"), "utf8");
  const kpiChart = readFileSync(join(process.cwd(), "src/components/kpi/kpi-charts.tsx"), "utf8");

  it("memakai tabel yang sama dengan Work Tracker, bukan tabel sendiri", () => {
    // Tabel buatan sendiri berarti pengurutan, pencarian, dan penomoran
    // halamannya berperilaku beda — dan orang yang sama memakai keduanya.
    expect(papan).toContain('from "@/components/ui/data-table"');
    expect(papan).not.toContain("<table");
  });

  it("kartu grafik memakai bingkai yang sama persis", () => {
    const bingkai = 'rounded-2xl border border-border bg-card/40 p-5';
    expect(wtChart).toContain(bingkai);
    expect(kpiChart).toContain(bingkai);
  });

  it("donat memakai ukuran cincin yang sama", () => {
    for (const potongan of ["const R = 66", "const STROKE = 22", "strokeLinecap=\"round\""]) {
      expect(wtDonut, `Work Tracker: ${potongan}`).toContain(potongan);
      expect(kpiChart, `KPI: ${potongan}`).toContain(potongan);
    }
  });

  it("grid grafik + donat memakai ukuran kolom yang sama", () => {
    expect(papan).toContain("lg:grid-cols-[minmax(0,1fr)_23rem]");
  });

  it("nama indikator di legenda dipotong, tidak dibiarkan tumpang tindih", () => {
    // Nama seperti "Head Product Development & Quality" akan mendorong lebar
    // kartunya kalau dibiarkan utuh.
    expect(kpiChart).toContain("truncate");
    expect(kpiChart).toContain("title={s.label}");
  });
});
