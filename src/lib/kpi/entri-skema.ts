import { TENGGAT, type JenisEntri } from "./indikator";

/**
 * Bentuk tabel isian untuk tiap jenis catatan KPI.
 *
 * KENAPA DIDESKRIPSIKAN, BUKAN DIPROGRAM SATU-SATU. Tiap indikator berbentuk
 * catatan meminta kolom yang sedikit berbeda — ada yang butuh kategori, ada
 * yang butuh tanggal selesai, ada yang barisnya dibuatkan sendiri per tanggal.
 * Menulis satu form untuk masing-masing berarti lima form yang harus diperbaiki
 * serempak setiap kali cara menyimpannya bergeser, dan lima tempat yang bisa
 * berbeda diam-diam. Di sini yang berbeda cuma keterangannya; formnya satu.
 *
 * Jenis yang TIDAK punya baris di sini memakai bentuk lamanya: tanggal, PIC,
 * outlet, judul bebas, keterangan.
 */
export interface SkemaEntri {
  /**
   * Pilihan kategori. Ditutup, bukan ketikan bebas: kategori yang diketik
   * sendiri akan melahirkan "Update Harga", "update harga", dan "Updt harga"
   * sebagai tiga kelompok berbeda, dan sebarannya berhenti bisa dibaca.
   */
  kategori?: readonly string[];
  /** Judul kolom kategorinya di layar. */
  labelKategori?: string;
  /**
   * Ada tanggal selesai dan hari terlewat. Baris yang terlewat menandai
   * dirinya sebagai pengurang poin.
   */
  sla?: boolean;
  /**
   * Dropdown outlet dibuka dengan pilihan "Semua Outlet".
   *
   * Satu penyetelan promo sering berlaku untuk seluruh cabang sekaligus.
   * Tanpa pilihan ini, yang mencatat harus memilih satu outlet yang mewakili —
   * dan catatan itu lalu terbaca seolah cabang lain tidak ikut disetel.
   */
  semuaOutlet?: boolean;
  /** Judul kolom keterangan. Kosong = kolomnya tidak ditampilkan. */
  keterangan?: string;
  /**
   * Barisnya DIBUATKAN, bukan ditambah satu per satu.
   *
   * Monitoring harian dan laporan berkala punya tanggalnya sendiri yang sudah
   * pasti; mengetiknya ulang tiap bulan hanya membuka peluang salah tanggal,
   * dan baris yang tanggalnya salah masuk ke bulan yang salah.
   */
  otomatis?: {
    /** "harian" = satu baris per tanggal bulan itu; atau tanggal tertentu saja. */
    tanggal: "harian" | readonly number[];
    /** Awalan kategori tiap baris, disusul tanggalnya. */
    awalan: string;
    /**
     * Apa yang menandai baris itu BENAR-BENAR terjadi.
     *
     * Baris yang dibuatkan selalu ada semua — tanpa penanda, tiga puluh baris
     * kosong akan tersimpan sebagai tiga puluh hari yang termonitor.
     */
    tanda: "outlet" | "selesai";
  };
  /**
   * Tiap baris bernilai satu per jumlah hari bulan itu, ditampilkan sebagai
   * persen. Dipakai uptime: 3,23% pada bulan 31 hari.
   */
  persenHari?: boolean;
}

/** Kategori pekerjaan master data menu & promo — dipakai dua indikator POS. */
export const KATEGORI_MENU_PROMO = [
  "Input Menu Baru",
  "Update Harga",
  "Setting Promo / Program",
  "Input Membership",
] as const;

/**
 * Kategori refreshment kasir.
 *
 * BELUM DITETAPKAN PEMILIKNYA — daftar ini dugaan yang masuk akal supaya
 * kolomnya bisa dipakai sekarang, bukan keputusan. Menggantinya cukup di sini.
 */
export const KATEGORI_REFRESHMENT = [
  "Refreshment Kasir Baru",
  "Refreshment Rutin",
  "Uji Kompetensi Kasir",
  "Pendampingan Kasir",
] as const;

/**
 * Tanggal laporan ke owner — dibaca dari tenggat posisinya, bukan ditulis ulang.
 *
 * Dua daftar tanggal yang harus sama akan berbeda suatu hari: yang satu diubah
 * saat jadwalnya bergeser, yang satu lagi terlewat — dan barisnya lalu muncul
 * pada tanggal yang tidak ada tenggatnya.
 */
export const TANGGAL_LAPORAN_OWNER: readonly number[] = TENGGAT.operational_software ?? [8, 15, 22, 29];

/** Platform pesan-antar yang dijaga Online Delivery. */
export const PLATFORM_DELIVERY = ["ShopeeFood", "GrabFood", "GoFood"] as const;

/** Pekerjaan menu & harga di saluran pesan-antar. */
export const KATEGORI_DELIVERY_MENU = [
  "Input Menu Baru",
  "Update Harga",
  "Kategori & Modifier",
  "Foto Menu",
  "Buka / Tutup Menu",
] as const;

/** Jenis gangguan saluran pesan-antar. */
export const KATEGORI_DELIVERY_ISSUE = [
  "Outlet Offline",
  "Menu Tidak Muncul",
  "Harga Salah",
  "Order Error",
  "Lainnya",
] as const;

/** Pekerjaan back office yang dijaga Operating System. */
export const KATEGORI_OS_MASTERDATA = [
  "Master Menu",
  "Modifier & Varian",
  "Pajak & Pembulatan",
  "Printer & Kitchen Routing",
  "Laporan Back Office",
] as const;

/** Jenis gangguan POS kasir. */
export const KATEGORI_OS_ISSUE = [
  "Kasir Tidak Bisa Transaksi",
  "Menu Tidak Muncul di POS",
  "Modifier Error",
  "Printer / Kitchen",
  "Pembayaran & Promo",
  "Lainnya",
] as const;

export const SKEMA_ENTRI: Partial<Record<JenisEntri, SkemaEntri>> = {
  pos_masterdata: {
    kategori: KATEGORI_MENU_PROMO,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  pos_sla: {
    kategori: KATEGORI_MENU_PROMO,
    sla: true,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  pos_refresh: {
    kategori: KATEGORI_REFRESHMENT,
    labelKategori: "Kategori Refreshment",
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  pos_uptime: {
    semuaOutlet: true,
    keterangan: "Keterangan",
    otomatis: { tanggal: "harian", awalan: "Monitoring tanggal", tanda: "outlet" },
    persenHari: true,
  },
  do_monitor: {
    kategori: PLATFORM_DELIVERY,
    labelKategori: "Platform",
    semuaOutlet: true,
    keterangan: "Keterangan",
    otomatis: { tanggal: "harian", awalan: "Cek outlet tanggal", tanda: "outlet" },
    persenHari: true,
  },
  do_menu: {
    kategori: KATEGORI_DELIVERY_MENU,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  do_issue: {
    kategori: KATEGORI_DELIVERY_ISSUE,
    labelKategori: "Jenis Gangguan",
    sla: true,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  do_merchant: {
    kategori: PLATFORM_DELIVERY,
    labelKategori: "Platform",
    keterangan: "Keterangan",
  },
  do_gagal: {
    kategori: PLATFORM_DELIVERY,
    labelKategori: "Platform",
    semuaOutlet: true,
    keterangan: "Penyebab",
  },
  os_uptime: {
    semuaOutlet: true,
    keterangan: "Keterangan",
    otomatis: { tanggal: "harian", awalan: "POS siap tanggal", tanda: "outlet" },
    persenHari: true,
  },
  os_masterdata: {
    kategori: KATEGORI_OS_MASTERDATA,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  os_menu: {
    kategori: KATEGORI_MENU_PROMO,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  os_issue: {
    kategori: KATEGORI_OS_ISSUE,
    labelKategori: "Jenis Gangguan",
    sla: true,
    semuaOutlet: true,
    keterangan: "Keterangan",
  },
  os_improve: {
    semuaOutlet: true,
    keterangan: "Perbaikan yang Diterapkan",
  },
  laporan_owner: {
    otomatis: { tanggal: TANGGAL_LAPORAN_OWNER, awalan: "Laporan tanggal", tanda: "selesai" },
    keterangan: "Keterangan",
  },
};

export const skemaEntri = (jenis: JenisEntri): SkemaEntri | undefined => SKEMA_ENTRI[jenis];

/** Tanggal-tanggal yang barisnya dibuatkan otomatis untuk satu periode. */
export function tanggalOtomatis(skema: SkemaEntri | undefined, hariBulan: number): number[] {
  if (!skema?.otomatis) return [];
  const { tanggal } = skema.otomatis;
  // Tanggal 29 tidak ada di Februari 28 hari. Membiarkannya membuat baris yang
  // ditolak server sebagai "di luar bulan yang sedang diisi" — pesan yang benar
  // untuk kesalahan yang tidak pernah dibuat siapa pun.
  return (tanggal === "harian" ? Array.from({ length: hariBulan }, (_, i) => i + 1) : [...tanggal]).filter(
    (t) => t <= hariBulan,
  );
}
