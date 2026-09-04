import type { KodePosisi } from "./struktur";

/**
 * Daftar indikator KPI per posisi.
 *
 * SATU BENTUK UNTUK SEMUA. Sepuluh posisi memakai satu mesin hitung; yang
 * berbeda antar-posisi hanya dari MANA target dan actual-nya datang. Tanpa ini
 * sepuluh posisi berarti sepuluh halaman yang harus diperbaiki satu per satu
 * setiap kali rumusnya bergeser.
 *
 * Bobot dan target di sini BAWAAN, bukan kunci mati. Keduanya bisa ditimpa
 * lewat pengaturan per posisi — kebijakan berubah tiap tahun, dan kode tidak
 * boleh ikut dibongkar setiap kali.
 */

/** Dari mana targetnya datang. */
export type JenisTarget =
  /** Angka tetap. `perBrand` berarti dikalikan jumlah brand aktif. */
  | { jenis: "tetap"; nilai: number; perBrand?: boolean }
  /** Actual bulan lalu + pertumbuhan. Bulan pertama belum punya target. */
  | { jenis: "tumbuh"; pertumbuhan: number }
  /** Sebanyak pekerjaan yang masuk bulan itu — selesai semua berarti 100%. */
  | { jenis: "pekerjaan" }
  /** Sebanyak outlet aktif. */
  | { jenis: "outlet" }
  /** Target berupa persentase, mis. 1,50% dari omset. */
  | { jenis: "rasio"; nilai: number };

/** Jenis entri form yang jumlah barisnya jadi angka KPI. */
export type JenisEntri =
  | "quality_control"
  | "riset_menu"
  | "event"
  | "faktur"
  | "penyampaian"
  | "temuan"
  | "pelunasan";

/** Perhitungan otomatis dari modul/data lain. */
export type KodeOtomatis =
  | "design_request"
  | "komplain_food_quality"
  | "efisiensi_operasional"
  | "keberhasilan_pasar"
  | "management_fee"
  | "average_transaction";

/** Dari mana actual-nya datang. */
export type SumberActual =
  /** Diketik satu angka. */
  | { sumber: "manual" }
  /** Diketik per brand, lalu dijumlah. */
  | { sumber: "manual_brand" }
  /** Jumlah entri form. */
  | { sumber: "entri"; entri: JenisEntri }
  /** Target dikurangi jumlah entri — indikator berbentuk pengurang. */
  | { sumber: "pengurang"; entri: JenisEntri }
  /**
   * Lulus-atau-tidak. Satu keterlambatan saja membuat actual-nya nol; tidak
   * ada nilai tengah. Dipakai Kelengkapan & Kualitas Data Analisa.
   */
  | { sumber: "lulus"; entri: JenisEntri }
  /** Dihitung modul lain. */
  | { sumber: "otomatis"; kode: KodeOtomatis };

export interface Indikator {
  key: string;
  label: string;
  /** Pengelompokan baris di tabel. Kosong berarti tanpa kelompok. */
  kategori?: string;
  /** Persen. Seluruhnya idealnya 100 — kalau tidak, layarnya memberi tahu. */
  bobot: number;
  target: JenisTarget;
  actual: SumberActual;
  /** Satu kalimat: dari mana angkanya, dibaca orang yang dinilai. */
  penjelasan: string;
}

const KUALITAS = "Kualitas Konten";
const JUMLAH = "Jumlah Konten";

/** Pertumbuhan bawaan untuk indikator kualitas Creative. */
export const TUMBUH_CREATIVE = 10;
/** Pertumbuhan bawaan untuk indikator Marketing Communication. */
export const TUMBUH_MARCOMM = 15;

const contentCreator: Indikator[] = [
  {
    key: "konten_post",
    label: "Jumlah Konten Post",
    kategori: JUMLAH,
    bobot: 20,
    target: { jenis: "tetap", nilai: 10, perBrand: true },
    actual: { sumber: "manual_brand" },
    penjelasan: "Diisi per brand, lalu dijumlah. Target 10 per brand.",
  },
  {
    key: "konten_reels",
    label: "Jumlah Konten Reels",
    kategori: JUMLAH,
    bobot: 20,
    target: { jenis: "tetap", nilai: 10, perBrand: true },
    actual: { sumber: "manual_brand" },
    penjelasan: "Diisi per brand, lalu dijumlah. Target 10 per brand.",
  },
  {
    key: "konten_story",
    label: "Jumlah Konten Story",
    kategori: JUMLAH,
    bobot: 5,
    target: { jenis: "tetap", nilai: 5, perBrand: true },
    actual: { sumber: "manual_brand" },
    penjelasan: "Diisi per brand, lalu dijumlah. Target 5 per brand.",
  },
  {
    key: "design_request",
    label: "Design By Request",
    kategori: JUMLAH,
    bobot: 15,
    target: { jenis: "pekerjaan" },
    actual: { sumber: "otomatis", kode: "design_request" },
    penjelasan: "Otomatis dari Antrian Design: target = permintaan yang masuk, actual = yang selesai.",
  },
  {
    key: "produksi_media",
    label: "Produksi Foto / Video",
    kategori: KUALITAS,
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "interaksi",
    label: "Like + Komentar + Share + Save",
    kategori: KUALITAS,
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "views",
    label: "Views",
    kategori: KUALITAS,
    bobot: 5,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "profile_visit",
    label: "Profile Visit",
    kategori: KUALITAS,
    bobot: 5,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "kecepatan",
    label: "Kecepatan & Ketepatan",
    kategori: KUALITAS,
    bobot: 10,
    target: { jenis: "tetap", nilai: 100 },
    actual: { sumber: "manual" },
    penjelasan: "Penilaian atasan dalam persen, 0–100.",
  },
];

const sosialMedia: Indikator[] = [
  {
    key: "konten_post",
    label: "Jumlah Konten Post",
    kategori: JUMLAH,
    bobot: 10,
    target: { jenis: "tetap", nilai: 20, perBrand: true },
    actual: { sumber: "manual_brand" },
    penjelasan: "Diisi per brand, lalu dijumlah. Target 20 per brand.",
  },
  {
    key: "konten_reels",
    label: "Jumlah Konten Reels",
    kategori: JUMLAH,
    bobot: 10,
    target: { jenis: "tetap", nilai: 20, perBrand: true },
    actual: { sumber: "manual_brand" },
    penjelasan: "Diisi per brand, lalu dijumlah. Target 20 per brand.",
  },
  {
    key: "konten_story",
    label: "Jumlah Konten Story",
    kategori: JUMLAH,
    bobot: 5,
    target: { jenis: "tetap", nilai: 20, perBrand: true },
    actual: { sumber: "manual_brand" },
    penjelasan: "Diisi per brand, lalu dijumlah. Target 20 per brand.",
  },
  {
    key: "interaksi",
    label: "Like + Komentar + Share + Save",
    kategori: KUALITAS,
    bobot: 15,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "follower_growth",
    label: "Follower Growth",
    kategori: KUALITAS,
    bobot: 15,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "views",
    label: "Views",
    kategori: KUALITAS,
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "profile_visit",
    label: "Profile Visit",
    kategori: KUALITAS,
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
  },
  {
    key: "kecepatan",
    label: "Kecepatan & Ketepatan",
    kategori: KUALITAS,
    bobot: 15,
    target: { jenis: "tetap", nilai: 100 },
    actual: { sumber: "manual" },
    penjelasan: "Penilaian atasan dalam persen, 0–100.",
  },
];

const accounting: Indikator[] = [
  {
    key: "pelunasan",
    label: "Input Pelunasan Pembayaran Supplier & Customer Service",
    bobot: 50,
    target: { jenis: "pekerjaan" },
    actual: { sumber: "pengurang", entri: "pelunasan" },
    penjelasan: "Target = jumlah pelunasan bulan itu; tiap keterlambatan mengurangi satu.",
  },
  {
    key: "management_fee",
    label: "Invoice Management Fee",
    bobot: 50,
    target: { jenis: "outlet" },
    actual: { sumber: "otomatis", kode: "management_fee" },
    penjelasan: "Target = jumlah outlet aktif; actual = outlet yang management fee-nya sesuai 5% net sales.",
  },
];

const finance: Indikator[] = [
  {
    key: "kelengkapan_analisa",
    label: "Kelengkapan & Kualitas Data Analisa",
    bobot: 50,
    target: { jenis: "tetap", nilai: 4 },
    actual: { sumber: "lulus", entri: "penyampaian" },
    penjelasan: "Tenggat tanggal 15. Telat sekali saja, actual-nya nol — tidak ada nilai tengah.",
  },
  {
    key: "akurasi_data",
    label: "Akurasi Data yang Disajikan",
    bobot: 50,
    target: { jenis: "tetap", nilai: 10 },
    actual: { sumber: "pengurang", entri: "temuan" },
    penjelasan: "Tiap temuan Head mengurangi satu dari target.",
  },
];

const tax: Indikator[] = [
  {
    key: "penyampaian_data",
    label: "Penyampaian Data",
    bobot: 50,
    target: { jenis: "tetap", nilai: 4 },
    actual: { sumber: "pengurang", entri: "penyampaian" },
    penjelasan: "Tenggat tanggal 8, 15, 22, dan 28. Tiap keterlambatan mengurangi satu.",
  },
  {
    key: "faktur_pajak",
    label: "Pemeriksaan Kesesuaian Nilai Faktur Pajak",
    bobot: 50,
    target: { jenis: "tetap", nilai: 10 },
    actual: { sumber: "pengurang", entri: "faktur" },
    penjelasan: "Tiap faktur yang nilainya tidak sesuai mengurangi satu dari target.",
  },
];

const marcomm: Indikator[] = [
  {
    key: "net_sales",
    label: "Net Sales Achievement",
    bobot: 40,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_MARCOMM },
    actual: { sumber: "manual" },
    penjelasan: `Otomatis dari ESB. Target = net sales bulan lalu + ${TUMBUH_MARCOMM}%.`,
  },
  {
    key: "event",
    label: "Total Event / Program",
    bobot: 30,
    target: { jenis: "tetap", nilai: 30 },
    actual: { sumber: "entri", entri: "event" },
    penjelasan: "Satu event yang tercatat bernilai satu poin.",
  },
  {
    key: "average_transaction",
    label: "Average Transaction",
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_MARCOMM },
    actual: { sumber: "otomatis", kode: "average_transaction" },
    penjelasan: `Net sales dibagi jumlah struk sebulan, otomatis dari ESB. Target = capaian bulan lalu + ${TUMBUH_MARCOMM}%.`,
  },
  {
    key: "new_member",
    label: "New Member Nordu / Cattu",
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_MARCOMM },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_MARCOMM}%. Diisi manual sampai sambungan ESB Loop siap.`,
  },
  {
    key: "retensi",
    label: "Retensi Pelanggan Nordu / Cattu",
    bobot: 10,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_MARCOMM },
    actual: { sumber: "manual" },
    penjelasan: `Target = capaian bulan lalu + ${TUMBUH_MARCOMM}%. Diisi manual sampai sambungan ESB Loop siap.`,
  },
];

/** Indikator yang dipakai Food Staff dan Beverage Staff — sama persis. */
const stafPdq: Indikator[] = [
  {
    key: "quality_control",
    label: "Quality Control",
    bobot: 30,
    target: { jenis: "tetap", nilai: 5 },
    actual: { sumber: "entri", entri: "quality_control" },
    penjelasan: "Satu kunjungan yang tercatat beserta fotonya bernilai satu poin.",
  },
  {
    key: "efisiensi",
    label: "Efisiensi Beban Operasional",
    bobot: 30,
    target: { jenis: "tetap", nilai: 100 },
    actual: { sumber: "otomatis", kode: "efisiensi_operasional" },
    penjelasan: "Total budget seluruh outlet dibanding total realisasinya. Hemat dari budget berarti 100%.",
  },
  {
    key: "keberhasilan_pasar",
    label: "Keberhasilan Pasar",
    bobot: 15,
    target: { jenis: "rasio", nilai: 1.5 },
    actual: { sumber: "otomatis", kode: "keberhasilan_pasar" },
    penjelasan: "Penjualan menu terpilih 3 bulan terakhir dibanding omset 3 bulan terakhir.",
  },
  {
    key: "review_customer",
    label: "Review Customer",
    bobot: 15,
    target: { jenis: "tetap", nilai: 15 },
    actual: { sumber: "otomatis", kode: "komplain_food_quality" },
    penjelasan: "Tiap komplain kategori Food Quality mengurangi satu dari target.",
  },
  {
    key: "riset_menu",
    label: "Riset Menu Baru",
    bobot: 10,
    target: { jenis: "tetap", nilai: 4 },
    actual: { sumber: "entri", entri: "riset_menu" },
    penjelasan: "Satu riset menu yang tercatat bernilai satu poin.",
  },
];

/** Head Food Development & Head PDQ — indikator sama, bobot dan target berbeda,
 *  tanpa Efisiensi Beban Operasional. */
const headPdq: Indikator[] = [
  { ...stafPdq[4], bobot: 40, target: { jenis: "tetap", nilai: 10 } },
  { ...stafPdq[0], bobot: 30, target: { jenis: "tetap", nilai: 5 } },
  { ...stafPdq[2], bobot: 20, target: { jenis: "rasio", nilai: 1.5 } },
  { ...stafPdq[3], bobot: 10, target: { jenis: "tetap", nilai: 10 } },
];

export const INDIKATOR: Record<KodePosisi, Indikator[]> = {
  creative_content: contentCreator,
  creative_sosmed: sosialMedia,
  finance_accounting: accounting,
  finance_finance: finance,
  finance_tax: tax,
  marcomm,
  pdq_food: stafPdq,
  pdq_beverage: stafPdq,
  pdq_head_food: headPdq,
  pdq_head_pdq: headPdq,
};

export const indikatorPosisi = (kode: KodePosisi): Indikator[] => INDIKATOR[kode] ?? [];

/** Tenggat penyampaian data per posisi — tanggal dalam bulan berjalan. */
export const TENGGAT: Partial<Record<KodePosisi, number[]>> = {
  finance_finance: [15],
  finance_tax: [8, 15, 22, 28],
};
