/** Client-safe shared constants & row types for Operation Finance (Beban & Pembelian). */

export const EXPENSE_COLS = ["utilitas", "sewa", "tenaga_kerja", "potongan", "manajemen_fee", "pemasaran", "ongkos_kirim", "lainnya"] as const;
export type ExpenseCol = (typeof EXPENSE_COLS)[number];
export const EXPENSE_LABELS: Record<ExpenseCol, string> = {
  utilitas: "Utilitas",
  sewa: "Sewa",
  tenaga_kerja: "Tenaga Kerja",
  potongan: "Potongan",
  manajemen_fee: "Manajemen Fee",
  pemasaran: "Pemasaran",
  ongkos_kirim: "Ongkos Kirim",
  lainnya: "Lainnya",
};

/**
 * RINCIAN UTILITAS — kolom baru V.1, boleh kosong.
 *
 * `utilitas` tetap ada dan tetap berarti total. Yang berubah asalnya: baris
 * V.1 menjumlahkannya dari empat kolom ini, baris historis memakai angka
 * agregat yang sudah tersimpan. Aturannya di `./utilitas`.
 *
 * KOSONG BERARTI BELUM PERNAH DIRINCI, bukan nol rupiah — kolomnya nullable di
 * basis data, tidak seperti delapan kolom lama.
 */
export const RINCI_UTILITAS = ["listrik", "air", "internet", "kebersihan"] as const;
export type RinciUtilitas = (typeof RINCI_UTILITAS)[number];
export const RINCI_UTILITAS_LABELS: Record<RinciUtilitas, string> = {
  listrik: "Listrik",
  air: "Air",
  internet: "Internet",
  kebersihan: "Kebersihan",
};

/**
 * Dua beban yang BELUM PERNAH ADA kolomnya sebelum V.1.
 *
 * Keduanya mulai terisi ketika penggunanya mengisinya. Tidak ada satu rupiah
 * pun yang dipindahkan dari `lainnya`, `ongkos_kirim`, atau `potongan` —
 * memindahkannya berarti menulis ulang laporan keuangan yang sudah ditutup,
 * dan tidak ada yang bisa memastikan bagian mana yang harus pindah.
 *
 * `platform_fee` BUKAN `ongkos_kirim`. Yang pertama komisi saluran penjualan,
 * yang kedua ongkos angkut — dan datanya membuktikan keduanya berperilaku
 * berbeda: `ongkos_kirim` mengikuti pembelian warehouse dan terkumpul di
 * outlet pedalaman, bukan mengikuti omset.
 */
export const BEBAN_BARU = ["platform_fee", "pbjt"] as const;
export type BebanBaru = (typeof BEBAN_BARU)[number];
export const BEBAN_BARU_LABELS: Record<BebanBaru, string> = {
  platform_fee: "Platform Fee",
  pbjt: "PBJT",
};

/** Seluruh kolom beban yang ada di basis data, lama dan baru. */
export const BEBAN_SEMUA = [...EXPENSE_COLS, ...RINCI_UTILITAS, ...BEBAN_BARU] as const;
export type BebanSemua = (typeof BEBAN_SEMUA)[number];
export const BEBAN_SEMUA_LABELS: Record<BebanSemua, string> = {
  ...EXPENSE_LABELS,
  ...RINCI_UTILITAS_LABELS,
  ...BEBAN_BARU_LABELS,
};

/** Delapan kolom lama selalu berangka; enam kolom baru boleh kosong. */
export type ExpenseRow = { outletCode: string; outletName: string } & Record<ExpenseCol, number> &
  Partial<Record<RinciUtilitas | BebanBaru, number | null>>;

/** Laba Rugi per outlet per bulan (Operation → Laba Rugi). */
export const PNL_COLS = ["pendapatan", "hpp", "beban", "laba_bersih"] as const;
export type PnlCol = (typeof PNL_COLS)[number];
export const PNL_LABELS: Record<PnlCol, string> = {
  pendapatan: "Pendapatan",
  hpp: "HPP",
  beban: "Beban",
  laba_bersih: "Laba Bersih",
};
export type PnlRow = { outletCode: string; outletName: string } & Record<PnlCol, number>;
/** Laba bersih versi hitung — pembanding untuk memeriksa angka yang diunggah. */
export const pnlComputed = (r: PnlRow) => (r.pendapatan || 0) - (r.hpp || 0) - (r.beban || 0);
export type PurchaseRow = { outletCode: string; outletName: string; warehouse: number; nonWarehouse: number };

/**
 * Total beban satu outlet sebulan — yang masuk `op_pnl.beban`.
 *
 * ┌─ EMPAT KOLOM RINCIAN UTILITAS SENGAJA TIDAK IKUT ────────────────────────┐
 * │                                                                          │
 * │ `utilitas` SUDAH berisi jumlah keempatnya (lihat `./utilitas`).          │
 * │ Menjumlahkan keduanya berarti setiap rupiah listrik dihitung dua kali —  │
 * │ dan hasilnya tetap terlihat masuk akal, karena beban yang membengkak     │
 * │ 3% tidak terlihat salah dari layar mana pun.                             │
 * │                                                                          │
 * │ Ada uji yang menjaga ini. Kalau suatu hari keempatnya ikut ditambahkan,  │
 * │ uji itu gagal sebelum angkanya sempat sampai ke laporan siapa pun.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `platform_fee` dan `pbjt` IKUT. Keduanya beban operasional — PBJT diputuskan
 * pemiliknya masuk ke rantai Pendapatan − HPP − Beban = Laba. Kosong dihitung
 * nol di sini karena yang dihitung TOTAL: tidak ikut menjumlah tidak sama
 * dengan menuliskannya nol ke basis data.
 */
export const expenseTotal = (r: ExpenseRow) =>
  EXPENSE_COLS.reduce((a, c) => a + (r[c] || 0), 0) + BEBAN_BARU.reduce((a, c) => a + (r[c] || 0), 0);
