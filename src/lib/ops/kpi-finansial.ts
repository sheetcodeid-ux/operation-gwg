import type { CakupanKpi, NilaiKpi, StatusNilai } from "./kpi-sales";

/**
 * EMPAT BELAS KPI KEUANGAN OPERATIONAL V.1 — menghitungnya, bukan menilainya.
 *
 * Seluruhnya satu bentuk: sebuah angka rupiah dibagi omzet, dikali seratus.
 * Yang membuat berkas ini panjang bukan aritmetikanya, melainkan tiga hal yang
 * kalau salah menghasilkan angka yang tetap terlihat masuk akal.
 *
 * ┌─ SATU · OMZETNYA DARI MANA ─────────────────────────────────────────────┐
 * │                                                                          │
 * │ `op_pnl.pendapatan` BERNILAI NOL DI SELURUH 174 BARIS — template unggah  │
 * │ memang tidak pernah memintanya, karena omzet ditarik otomatis dari ESB.  │
 * │ Memakainya sebagai penyebut membuat setiap KPI di sini membagi nol.      │
 * │                                                                          │
 * │ Omzetnya datang dari `sales-fact.ts`, sumber yang sama dengan Phase 2A.  │
 * │ Disuntikkan pemanggil, bukan diambil sendiri, supaya berkas ini tetap    │
 * │ murni dan tidak pernah bisa memilih sumber kedua.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DUA · NOL, KOSONG, DAN TIDAK ADA BARISNYA ─────────────────────────────┐
 * │                                                                          │
 * │ Tiga keadaan yang berbeda, dan ketiganya terlihat sama kalau ditulis 0:  │
 * │                                                                          │
 * │   tidak ada baris finansial  → outletnya belum melapor bulan itu         │
 * │   kolom baru bernilai NULL   → belum pernah dirinci (listrik, PBJT, …)   │
 * │   kolom bernilai 0           → dilaporkan nol                            │
 * │                                                                          │
 * │ KETERBATASAN YANG DITERIMA APA ADANYA: untuk empat belas kolom angka     │
 * │ lama (`not null default 0` sejak `0017_op_finance.sql`), keadaan kedua   │
 * │ dan ketiga TIDAK BISA DIBEDAKAN. Nol pada `sewa` bisa berarti outletnya  │
 * │ tidak menyewa, atau berarti kolomnya belum diisi. Keputusan pemiliknya:  │
 * │ nol dibaca apa adanya, dan keterbatasannya dicatat — bukan disembunyikan │
 * │ di balik tebakan.                                                        │
 * │                                                                          │
 * │ Enam kolom baru Phase 2B tidak mewarisi keterbatasan itu: NULL tetap     │
 * │ NULL, dan KPI-nya `tidak_tersedia` — bukan 0%.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TIGA · KORPORAT BUKAN RATA-RATA PERSEN ────────────────────────────────┐
 * │                                                                          │
 * │ Angka korporat = jumlah biaya seluruh outlet dibagi jumlah omzet seluruh │
 * │ outlet. BUKAN rata-rata persen tiap outlet.                              │
 * │                                                                          │
 * │ Rata-rata persen membuat outlet beromzet Rp 20 juta sama beratnya dengan │
 * │ outlet beromzet Rp 900 juta — satu warung kecil yang boros bisa membuat  │
 * │ seluruh perusahaan terbaca boros. Aturan yang sama sudah dipakai         │
 * │ `ringkasEfisiensi` dan `hppKpkPersen`, dengan alasan yang ditulis di     │
 * │ sana: "angkanya tidak pernah cocok dengan laporan keuangan".             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MURNI — tanpa basis data, tanpa `server-only`, tanpa `await`.
 */

/* ───────────────────────── katalog KPI ───────────────────────── */

/**
 * Kode definisi KPI, sama persis dengan `kpi_definitions.id`.
 *
 * ┌─ CATATAN ISTILAH, JANGAN DILEWATI ──────────────────────────────────────┐
 * │ Indikator existing `hpp_kpk` di KPI Supervisor BUKAN harga pokok.       │
 * │ Ia pembelian warehouse + non-warehouse dibagi omzet — komentar di       │
 * │ `src/lib/data/kpi.ts` menyatakannya sendiri. Istilah lamanya TIDAK      │
 * │ diubah; yang di sini bernama apa adanya.                                │
 * │                                                                         │
 * │   `hpp_kpk` (lama)            = `biaya.total_purchase_pct` (di sini)    │
 * │   `biaya.hpp_pct` (di sini)   = harga pokok dari laporan keuangan       │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export const KPI_KEUANGAN = {
  warehouse: "biaya.warehouse_pct",
  nonWarehouse: "biaya.non_warehouse_pct",
  totalPurchase: "biaya.total_purchase_pct",
  hpp: "biaya.hpp_pct",
  labor: "biaya.labor_pct",
  rent: "biaya.rent_pct",
  electricity: "biaya.electricity_pct",
  water: "biaya.water_pct",
  internet: "biaya.internet_pct",
  cleaning: "biaya.cleaning_pct",
  other: "biaya.other_pct",
  netProfit: "biaya.net_profit_pct",
  platformFee: "biaya.platform_fee_pct",
  pbjt: "biaya.pbjt_pct",
} as const;

/** Keempat belasnya, untuk pertanyaan "mana saja KPI keuangan itu". */
export const DAFTAR_KPI_KEUANGAN: readonly string[] = Object.values(KPI_KEUANGAN);

export const RUMUS_KEUANGAN = "persen-omzet";
/** Naik bila CARA menghitungnya berubah — bukan bila angkanya berubah. */
export const RUMUS_KEUANGAN_VERSI = 1;

/* ───────────────────────── bentuk masukan ───────────────────────── */

/**
 * Angka satu outlet pada satu bulan, sudah dikumpulkan pemanggil.
 *
 * Seluruhnya `number | null`. Null berarti tidak ada angkanya — dan untuk
 * empat belas kolom lama, null hanya terjadi bila barisnya memang tidak ada
 * sama sekali (`adaLaporan` salah), karena kolomnya sendiri tidak bisa null.
 */
export interface AngkaOutlet {
  outletId: string;
  areaId: string | null;
  /** Omzet dari `sales-fact.ts`. Null berarti tidak ada fakta penjualannya. */
  sales: number | null;
  /** Benar bila outlet ini punya baris finansial bulan itu. */
  adaLaporan: boolean;

  warehouse: number | null;
  nonWarehouse: number | null;
  hpp: number | null;
  labaBersih: number | null;

  tenagaKerja: number | null;
  sewa: number | null;
  lainnya: number | null;

  // Enam kolom Phase 2B — null-nya berarti sesuatu.
  listrik: number | null;
  air: number | null;
  internet: number | null;
  kebersihan: number | null;
  platformFee: number | null;
  pbjt: number | null;
}

export interface MasukanKeuangan {
  /** "YYYY-MM". */
  periode: string;
  outlets: readonly AngkaOutlet[];
  /** Benar bila periodenya sudah selesai; menentukan final atau sementara. */
  periodeSelesai: boolean;
}

export interface HasilKeuangan {
  nilai: NilaiKpi[];
  /** Outlet yang tidak punya baris finansial sama sekali — disebut, tidak didiamkan. */
  tanpaLaporan: string[];
  /** Outlet yang omzetnya nol atau belum ada — pembagi tidak sah. */
  tanpaOmzet: string[];
}

/* ───────────────────────────── hitungan ───────────────────────────── */

/**
 * Persen sebuah angka terhadap omzet.
 *
 * Null kalau pembilangnya tidak ada, ATAU penyebutnya tidak sah. Tidak pernah
 * `Infinity`, tidak pernah `NaN`, dan tidak pernah nol palsu: omzet nol dibagi
 * apa pun bukan "0%", melainkan pertanyaan yang tidak punya jawaban.
 */
export function persenOmzet(angka: number | null, omzet: number | null): number | null {
  if (angka === null || omzet === null || omzet <= 0) return null;
  const p = (angka / omzet) * 100;
  return Number.isFinite(p) ? p : null;
}

/** Jumlah yang mempertahankan null: null + null tetap null, null + 5 jadi 5. */
const jumlahNull = (a: number | null, b: number | null): number | null =>
  a === null && b === null ? null : (a ?? 0) + (b ?? 0);

/**
 * Hitung keempat belas KPI keuangan untuk satu periode.
 *
 * Tiap outlet SELALU menghasilkan empat belas baris, termasuk outlet yang
 * belum melapor. Outlet yang hilang dari hasil tidak bisa dibedakan dari outlet
 * yang terlewat dihitung, dan yang kedua justru yang perlu kelihatan.
 */
export function hitungKeuangan(m: MasukanKeuangan): HasilKeuangan {
  const nilai: NilaiKpi[] = [];
  const tanpaLaporan: string[] = [];
  const tanpaOmzet: string[] = [];

  for (const o of m.outlets) {
    if (!o.adaLaporan) tanpaLaporan.push(o.outletId);
    if (o.sales === null || o.sales <= 0) tanpaOmzet.push(o.outletId);

    const bersama = {
      cakupan: "outlet" as const,
      outletId: o.outletId,
      areaId: null,
      periode: m.periode,
      skala: "bulanan" as const,
      sumber: "op_expenses+op_purchases+op_pnl / seasonal_daily",
      rumus: RUMUS_KEUANGAN,
      rumusVersi: RUMUS_KEUANGAN_VERSI,
      sumberSah: true,
      kelengkapanPersen: null,
      jumlahHari: null,
    };

    const tulis = (kpi: string, angka: number | null, catatanKhusus?: string) =>
      nilai.push({
        ...bersama,
        kpiDefinitionId: kpi,
        ...hasil(angka, o, m.periodeSelesai, catatanKhusus),
      });

    tulis(KPI_KEUANGAN.warehouse, o.warehouse);
    tulis(KPI_KEUANGAN.nonWarehouse, o.nonWarehouse);
    tulis(KPI_KEUANGAN.totalPurchase, jumlahNull(o.warehouse, o.nonWarehouse));
    tulis(KPI_KEUANGAN.hpp, o.hpp);
    tulis(KPI_KEUANGAN.labor, o.tenagaKerja);
    tulis(KPI_KEUANGAN.rent, o.sewa);
    tulis(KPI_KEUANGAN.other, o.lainnya);
    tulis(KPI_KEUANGAN.netProfit, o.labaBersih);

    // Enam kolom Phase 2B: null berarti belum dilaporkan, dan itu DIBEDAKAN
    // dari nol. Inilah satu-satunya tempat pembedaan itu benar-benar bisa
    // ditegakkan — empat belas kolom lama tidak bisa.
    tulis(KPI_KEUANGAN.electricity, o.listrik, BELUM_DIRINCI);
    tulis(KPI_KEUANGAN.water, o.air, BELUM_DIRINCI);
    tulis(KPI_KEUANGAN.internet, o.internet, BELUM_DIRINCI);
    tulis(KPI_KEUANGAN.cleaning, o.kebersihan, BELUM_DIRINCI);
    tulis(KPI_KEUANGAN.platformFee, o.platformFee, BELUM_DILAPORKAN);
    tulis(KPI_KEUANGAN.pbjt, o.pbjt, BELUM_DILAPORKAN);
  }

  nilai.push(...korporat(m));
  return { nilai, tanpaLaporan, tanpaOmzet };
}

const BELUM_DIRINCI =
  "Belum pernah dirinci untuk outlet ini. Angkanya masih menyatu di dalam Utilitas — bukan berarti nol rupiah.";
const BELUM_DILAPORKAN =
  "Kolom baru Operational V.1. Kosong berarti belum pernah dilaporkan — bukan nol rupiah, dan bukan berarti biayanya tidak ada.";

/** Nilai, status, dan alasannya — ditentukan satu tempat supaya konsisten. */
function hasil(
  angka: number | null,
  o: AngkaOutlet,
  periodeSelesai: boolean,
  catatanKhusus?: string,
): { nilai: number | null; status: StatusNilai; catatan: string | null } {
  if (!o.adaLaporan) {
    return { nilai: null, status: "tidak_tersedia", catatan: "Outlet ini belum melaporkan angka keuangan bulan itu." };
  }
  if (o.sales === null || o.sales <= 0) {
    // Omzet nol bukan 0% biaya — ia pertanyaan yang tidak punya jawaban.
    return {
      nilai: null,
      status: "tidak_tersedia",
      catatan: "Omzet nol atau belum ada, jadi persentase terhadap omzet tidak bisa dihitung.",
    };
  }
  if (angka === null) {
    return { nilai: null, status: "tidak_tersedia", catatan: catatanKhusus ?? "Angkanya belum ada." };
  }
  const p = persenOmzet(angka, o.sales);
  if (p === null) return { nilai: null, status: "tidak_tersedia", catatan: "Tidak bisa dihitung." };
  return { nilai: p, status: periodeSelesai ? "final" : "sementara", catatan: null };
}

/**
 * Angka korporat — Σ biaya ÷ Σ omzet, bukan rata-rata persen.
 *
 * Yang ikut dijumlah hanya outlet yang omzetnya sah. Outlet tanpa omzet tidak
 * bisa menyumbang penyebut, dan memasukkan biayanya ke pembilang tanpa
 * omzetnya di penyebut membuat persentase korporat naik tanpa sebab.
 */
function korporat(m: MasukanKeuangan): NilaiKpi[] {
  const sah = m.outlets.filter((o) => o.adaLaporan && o.sales !== null && o.sales > 0);
  const omzet = sah.reduce((a, o) => a + (o.sales ?? 0), 0);
  const jumlah = (ambil: (o: AngkaOutlet) => number | null): number | null =>
    sah.reduce<number | null>((a, o) => jumlahNull(a, ambil(o)), null);

  const bersama = {
    cakupan: "korporat" as CakupanKpi,
    outletId: null,
    areaId: null,
    periode: m.periode,
    skala: "bulanan" as const,
    sumber: "op_expenses+op_purchases+op_pnl / seasonal_daily",
    rumus: RUMUS_KEUANGAN,
    rumusVersi: RUMUS_KEUANGAN_VERSI,
    sumberSah: true,
    kelengkapanPersen: null,
    jumlahHari: null,
  };

  const baris = (kpi: string, angka: number | null): NilaiKpi => {
    const p = persenOmzet(angka, omzet > 0 ? omzet : null);
    return {
      ...bersama,
      kpiDefinitionId: kpi,
      nilai: p,
      status: p === null ? "tidak_tersedia" : m.periodeSelesai ? "final" : "sementara",
      catatan:
        p === null
          ? sah.length === 0
            ? "Belum ada satu outlet pun yang omzet dan laporannya lengkap bulan ini."
            : "Angkanya belum dilaporkan satu outlet pun."
          : null,
    };
  };

  return [
    baris(KPI_KEUANGAN.warehouse, jumlah((o) => o.warehouse)),
    baris(KPI_KEUANGAN.nonWarehouse, jumlah((o) => o.nonWarehouse)),
    baris(KPI_KEUANGAN.totalPurchase, jumlah((o) => jumlahNull(o.warehouse, o.nonWarehouse))),
    baris(KPI_KEUANGAN.hpp, jumlah((o) => o.hpp)),
    baris(KPI_KEUANGAN.labor, jumlah((o) => o.tenagaKerja)),
    baris(KPI_KEUANGAN.rent, jumlah((o) => o.sewa)),
    baris(KPI_KEUANGAN.electricity, jumlah((o) => o.listrik)),
    baris(KPI_KEUANGAN.water, jumlah((o) => o.air)),
    baris(KPI_KEUANGAN.internet, jumlah((o) => o.internet)),
    baris(KPI_KEUANGAN.cleaning, jumlah((o) => o.kebersihan)),
    baris(KPI_KEUANGAN.other, jumlah((o) => o.lainnya)),
    baris(KPI_KEUANGAN.netProfit, jumlah((o) => o.labaBersih)),
    baris(KPI_KEUANGAN.platformFee, jumlah((o) => o.platformFee)),
    baris(KPI_KEUANGAN.pbjt, jumlah((o) => o.pbjt)),
  ];
}
