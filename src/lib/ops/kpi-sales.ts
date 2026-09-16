import { nilaiKelengkapan, wajibPasangan, type AmbangKelengkapan } from "./kelengkapan";
import { jumlahPerOutlet, type FaktaPenjualan } from "./sales-fact";
import { RUMUS_TARGET, RUMUS_TARGET_VERSI, type HasilTarget } from "./target-sales";

/**
 * KPI SALES OPERATIONAL V.1 — menghitungnya, bukan menyimpannya.
 *
 * Berkas ini mengubah fakta penjualan yang sudah lolos `sales-fact.ts` menjadi
 * baris-baris siap simpan untuk `kpi_values` dan `targets`. Ia TIDAK menyentuh
 * basis data sama sekali: tidak ada `import "server-only"`, tidak ada klien
 * Supabase, tidak ada `await`.
 *
 * ┌─ KENAPA HITUNGAN DIPISAH DARI PENYIMPANAN ───────────────────────────────┐
 * │                                                                          │
 * │ Supaya dry-run mungkin. Angka Agustus 2026 bisa dihitung penuh,          │
 * │ dibandingkan dengan halaman Daily, dan diperiksa orang SEBELUM satu      │
 * │ baris pun masuk ke basis data mana pun. Kalau hitungannya menempel pada  │
 * │ INSERT-nya, satu-satunya cara memeriksa hasilnya adalah menuliskannya    │
 * │ lebih dulu — dan yang sudah tertulis di produksi sudah terlambat untuk   │
 * │ diperiksa.                                                               │
 * │                                                                          │
 * │ Akibat keduanya: berkas ini bisa diuji tanpa Supabase, dan bisa          │
 * │ dijalankan skrip rekonsiliasi di PostgreSQL lokal.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * SATU SUMBER PENJUALAN, BUKAN DUA. Seluruh angka di sini berasal dari fakta
 * yang sudah disaring `saringFakta()`. Tidak ada query kedua, tidak ada rumus
 * cadangan, dan tidak ada angka yang dikarang untuk mengisi yang kosong.
 */

/* ───────────────────────────── bentuk data ───────────────────────────── */

export type SkalaKpi = "harian" | "mingguan" | "bulanan" | "kuartalan" | "tahunan";
export type CakupanKpi = "outlet" | "area" | "korporat";
export type StatusNilai = "final" | "sementara" | "tidak_tersedia" | "invalid";

/** Kode definisi KPI, sama persis dengan `kpi_definitions.id` di migrasi 0103. */
export const KPI = {
  gross: "sales.gross_sales",
  net: "sales.net_sales",
  average: "sales.average_transaction",
  target: "sales.monthly_target",
  capaian: "sales.achievement",
} as const;

/** Naik bila CARA menghitungnya berubah — bukan bila angkanya berubah. */
export const RUMUS_SALES = "sales-fact";
export const RUMUS_SALES_VERSI = 1;

/**
 * Satu baris siap simpan untuk `kpi_values`.
 *
 * Bentuknya sengaja mengikuti kolom tabelnya satu per satu. Penerjemahan yang
 * terjadi di lapisan penyimpanan tinggal mengganti camelCase jadi snake_case —
 * tidak ada keputusan yang tersisa di sana, jadi tidak ada keputusan yang bisa
 * berbeda antara yang diuji dan yang ditulis.
 */
export interface NilaiKpi {
  kpiDefinitionId: string;
  cakupan: CakupanKpi;
  outletId: string | null;
  areaId: string | null;
  periode: string;
  skala: SkalaKpi;
  /** Null berarti tidak bisa dihitung dari data yang sah — bukan nol. */
  nilai: number | null;
  status: StatusNilai;
  sumber: string;
  rumus: string;
  rumusVersi: number;
  /** Salah bila sumbernya sudah dinyatakan tidak berlaku untuk periode ini. */
  sumberSah: boolean;
  kelengkapanPersen: number | null;
  jumlahHari: number | null;
  catatan: string | null;
}

/** Satu baris siap simpan untuk `targets`. */
export interface NilaiTarget {
  kpiDefinitionId: string;
  cakupan: CakupanKpi;
  outletId: string | null;
  areaId: string | null;
  periode: string;
  skala: SkalaKpi;
  nilai: number;
  sumber: "rumus";
  rumus: string;
  rumusVersi: number;
  dasar: { bulan: string[]; riwayat: (number | null)[]; dipakai: number[]; pertumbuhan: number };
}

/** Yang perlu diketahui tentang sebuah outlet untuk menilai penjualannya. */
export interface OutletSales {
  id: string;
  areaId: string | null;
  /**
   * Bulan-bulan yang angka ESB-nya sudah dinyatakan tidak berlaku bagi outlet
   * ini — hasil `grossDiketik()` (`src/lib/data/kpi.ts`) untuk periode yang
   * sedang dihitung. Dihitung pemanggil, bukan di sini: aturannya milik KPI
   * Coordinator Area, dan menyalinnya ke sini membuat dua aturan yang bisa
   * berbeda diam-diam.
   */
  esbTidakBerlaku?: boolean;
}

export interface MasukanSales {
  /** "YYYY-MM". */
  periode: string;
  outlets: readonly OutletSales[];
  /** Fakta yang SUDAH lolos `saringFakta()`. Tidak disaring ulang di sini. */
  fakta: readonly FaktaPenjualan[];
  /** Baris yang ditemui tapi angkanya tidak sah — `HasilFakta.dibuang.cacat`. */
  cacat?: number;
  ambang: AmbangKelengkapan;
  /** Hasil `hitungTargetSales()`, satu per outlet. */
  target: readonly HasilTarget[];
  /** Hari periode ini yang sudah lewat menurut WIB — `hariBerjalan()`. */
  hariBerjalan: number;
  /** Benar bila periodenya sudah selesai; menentukan final atau sementara. */
  periodeSelesai: boolean;
}

export interface HasilSales {
  nilai: NilaiKpi[];
  target: NilaiTarget[];
  /** Kelengkapan seluruh cakupan — satu angka, untuk dilaporkan apa adanya. */
  kelengkapan: ReturnType<typeof nilaiKelengkapan>;
}

/* ──────────────────────────────- hitungan ──────────────────────────────- */

/**
 * Hitung seluruh KPI Sales satu periode.
 *
 * Yang dihasilkan baris per outlet untuk kelima KPI, ditambah baris korporat
 * untuk gross dan net. Outlet yang tidak punya satu fakta pun TETAP
 * menghasilkan baris — dengan status `tidak_tersedia` dan nilai null. Outlet
 * yang hilang dari hasil tidak bisa dibedakan dari outlet yang datanya belum
 * ditarik, dan yang kedua adalah hal yang justru perlu kelihatan.
 */
export function hitungSales(m: MasukanSales): HasilSales {
  const ringkas = new Map(jumlahPerOutlet(m.fakta).map((r) => [r.outletId, r]));
  const target = new Map(m.target.map((t) => [t.outletId, t]));

  const kelengkapan = nilaiKelengkapan({
    wajib: wajibPasangan(m.outlets.length, m.hariBerjalan),
    fakta: m.fakta,
    cacat: m.cacat,
    ambang: m.ambang,
  });

  const nilai: NilaiKpi[] = [];
  const barisTarget: NilaiTarget[] = [];

  for (const o of m.outlets) {
    const r = ringkas.get(o.id);
    const t = target.get(o.id) ?? null;
    const sah = !o.esbTidakBerlaku;

    // Berapa hari yang datanya ada, dibanding berapa hari yang sudah lewat.
    const hariAda = r?.hariAda ?? 0;
    const persen = m.hariBerjalan > 0 ? (hariAda / m.hariBerjalan) * 100 : null;
    // Periode yang belum selesai belum boleh disebut final, sekalipun tiap
    // harinya sudah ada. Angka yang disebut final lalu berubah besok adalah
    // cara tercepat membuat laporan yang sudah dicetak jadi salah.
    const status: StatusNilai = hariAda === 0 ? "tidak_tersedia" : m.periodeSelesai ? "final" : "sementara";
    const bersama = {
      cakupan: "outlet" as const,
      outletId: o.id,
      areaId: null,
      periode: m.periode,
      skala: "bulanan" as const,
      sumber: "seasonal_daily",
      rumus: RUMUS_SALES,
      rumusVersi: RUMUS_SALES_VERSI,
      sumberSah: sah,
      kelengkapanPersen: persen,
      jumlahHari: hariAda,
      catatan: sah ? null : catatanEsbTidakBerlaku(m.periode),
    };

    nilai.push({ ...bersama, kpiDefinitionId: KPI.net, nilai: r ? r.net : null, status });
    nilai.push({
      ...bersama,
      kpiDefinitionId: KPI.gross,
      // Gross yang tidak pernah terukur tetap null, bukan nol — dan itu
      // membuat barisnya berstatus tidak_tersedia meski net-nya ada.
      nilai: r?.gross ?? null,
      status: r?.gross === null || r?.gross === undefined ? "tidak_tersedia" : status,
    });

    // Average transaction: rupiah per bill. Pembagi nol atau tidak terukur
    // menghasilkan null, BUKAN nol dan bukan tak hingga.
    const bills = r?.bills ?? null;
    const rata = r && bills !== null && bills > 0 ? r.net / bills : null;
    nilai.push({
      ...bersama,
      kpiDefinitionId: KPI.average,
      nilai: rata,
      status: rata === null ? "tidak_tersedia" : status,
      catatan:
        rata === null && r
          ? "Jumlah bill tidak terukur atau nol — rata-rata transaksi tidak bisa dihitung."
          : bersama.catatan,
    });

    // ── target dan capaian ──
    const nilaiTarget = t?.nilai ?? null;
    nilai.push({
      ...bersama,
      kpiDefinitionId: KPI.target,
      nilai: nilaiTarget,
      status: nilaiTarget === null ? "tidak_tersedia" : "final",
      sumber: RUMUS_TARGET,
      rumus: RUMUS_TARGET,
      rumusVersi: RUMUS_TARGET_VERSI,
      jumlahHari: null,
      kelengkapanPersen: null,
      catatan: nilaiTarget === null ? alasanTarget(t) : bersama.catatan,
    });

    // Capaian TANPA target adalah null, bukan nol dan bukan seratus. Outlet
    // yang belum genap tiga bulan memang belum dinilai — menuliskannya 0%
    // membuatnya tampak gagal, menuliskannya 100% membuatnya tampak sempurna,
    // dan keduanya sama-sama karangan.
    const capaian = r && nilaiTarget !== null && nilaiTarget > 0 ? (r.net / nilaiTarget) * 100 : null;
    nilai.push({
      ...bersama,
      kpiDefinitionId: KPI.capaian,
      nilai: capaian,
      status: capaian === null ? "tidak_tersedia" : status,
      catatan: capaian === null ? (nilaiTarget === null ? alasanTarget(t) : "Penjualan belum ada.") : bersama.catatan,
    });

    if (t && t.nilai !== null) {
      barisTarget.push({
        kpiDefinitionId: KPI.target,
        cakupan: "outlet",
        outletId: o.id,
        areaId: null,
        periode: m.periode,
        skala: "bulanan",
        nilai: t.nilai,
        sumber: "rumus",
        rumus: RUMUS_TARGET,
        rumusVersi: RUMUS_TARGET_VERSI,
        dasar: { bulan: t.bulan, riwayat: t.riwayat, dipakai: t.dipakai, pertumbuhan: t.pertumbuhan },
      });
    }
  }

  // ── korporat: jumlah seluruh outlet dalam cakupan ──
  //
  // DIHITUNG DARI BARIS OUTLET, bukan dari baris korporat `seasonal_daily`.
  // Baris `branch = ''` di tabel itu adalah balasan ESB untuk "seluruh cabang"
  // dan sudah dibuang `saringFakta()`; memakainya di sini akan memasukkan
  // kembali Rp 13,4 miliar yang justru sengaja disingkirkan.
  const adaOutlet = [...ringkas.values()];
  const totalNet = adaOutlet.reduce((n, r) => n + r.net, 0);
  const adaGross = adaOutlet.filter((r) => r.gross !== null);
  const bersamaKorporat = {
    cakupan: "korporat" as const,
    outletId: null,
    areaId: null,
    periode: m.periode,
    skala: "bulanan" as const,
    sumber: "seasonal_daily",
    rumus: RUMUS_SALES,
    rumusVersi: RUMUS_SALES_VERSI,
    sumberSah: true,
    kelengkapanPersen: kelengkapan.persen,
    jumlahHari: m.hariBerjalan,
    catatan: null,
  };
  const statusKorporat: StatusNilai =
    adaOutlet.length === 0 ? "tidak_tersedia" : m.periodeSelesai ? "final" : "sementara";
  nilai.push({
    ...bersamaKorporat,
    kpiDefinitionId: KPI.net,
    nilai: adaOutlet.length === 0 ? null : totalNet,
    status: statusKorporat,
  });
  nilai.push({
    ...bersamaKorporat,
    kpiDefinitionId: KPI.gross,
    nilai: adaGross.length === 0 ? null : adaGross.reduce((n, r) => n + (r.gross ?? 0), 0),
    status: adaGross.length === 0 ? "tidak_tersedia" : statusKorporat,
  });

  return { nilai, target: barisTarget, kelengkapan };
}

function alasanTarget(t: HasilTarget | null): string {
  if (!t) return "Outlet ini tidak ikut dihitung targetnya.";
  if (t.alasan === "belum-tiga-bulan") return "Belum genap tiga bulan berjalan — belum diberi target.";
  if (t.alasan === "tanpa-riwayat") return "Tidak ada satu bulan pun yang penjualannya bisa dijadikan dasar.";
  return "Target tidak tersedia.";
}

const catatanEsbTidakBerlaku = (periode: string): string =>
  `Angka ESB untuk ${periode} sudah ditandai tidak berlaku bagi outlet ini (esb_mulai / esb_abaikan). Angkanya tetap dicatat supaya cocok dengan halaman Daily, tapi tidak boleh dipakai menilai.`;
