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
  | { jenis: "rasio"; nilai: number }
  /**
   * Rata-rata TIGA BULAN sebelumnya + pertumbuhan.
   *
   * Berbeda dari `tumbuh` yang memakai satu bulan lalu: satu bulan sepi atau
   * satu bulan Lebaran akan menggeser targetnya jauh, dan yang dinilai jadi
   * beruntung atau celaka karena kalender. Tiga bulan meredam itu.
   *
   * Yang dipakai bulan-bulan yang SUDAH SELESAI, bukan termasuk bulan berjalan
   * — kalau bulan berjalan ikut, targetnya bergerak tiap hari dan tidak pernah
   * bisa dipakai sebagai patokan.
   */
  | { jenis: "avg3"; pertumbuhan: number }
  /**
   * Sekian persen dari capaian indikator lain pada bulan yang sama.
   *
   * Dipakai Net Profit: targetnya 30% dari Gross Sales yang BENAR-BENAR
   * tercapai, bukan dari gross sales yang ditargetkan. Kalau penjualannya
   * meleset, target labanya ikut turun — yang dinilai tidak dihukum dua kali
   * untuk satu kejadian yang sama.
   */
  | { jenis: "porsi"; dari: string; rasio: number };

/** Jenis entri form yang jumlah barisnya jadi angka KPI. */
export type JenisEntri =
  | "hygiene_cctv"
  | "cctv_qc"
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
  | "ketepatan_design"
  | "hc_pemenuhan_rekrutmen"
  | "hc_kecepatan_rekrutmen"
  | "hc_kepatuhan_kontrak"
  | "hc_kepatuhan_laporan"
  | "hc_penyelesaian_onboarding"
  | "hc_turnover"
  | "net_sales_korporat"
  | "komplain_food_quality"
  | "efisiensi_operasional"
  | "keberhasilan_pasar"
  | "management_fee"
  | "average_transaction"
  | "gross_sales_area"
  | "komplain_area"
  | "net_profit_area"
  | "hpp_area";

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
  /**
   * Cara membandingkan actual dengan target, bila BUKAN "makin besar makin baik".
   *
   * Tanpa ini, indikator yang targetnya BATAS ATAS akan dinilai terbalik: 30
   * komplain dari batas 20 menghasilkan 150% lalu dipotong jadi 100%, dan yang
   * paling banyak dikomplain justru mendapat nilai penuh.
   */
  penilaian?: "batas_maks" | "lulus_maks" | "kurang_linear";
  /** Satuan tampilan; ikut dipakai tabel dan grafik. */
  satuan?: "angka" | "rupiah" | "persen";
}

const KUALITAS = "Kualitas Konten";
const JUMLAH = "Jumlah Konten";

/** Pertumbuhan bawaan untuk indikator kualitas Creative. */
export const TUMBUH_CREATIVE = 10;
/** Pertumbuhan bawaan untuk indikator Marketing Communication. */
export const TUMBUH_MARCOMM = 15;

/**
 * Content Creator dinilai atas DUA hal saja.
 *
 * Daftar panjang sebelumnya — jumlah post, reels, story, views, profile visit —
 * mengukur kegiatan, bukan hasil, dan seluruhnya diketik sendiri oleh yang
 * dinilai. Yang tersisa dua: menepati tenggat pekerjaan yang benar-benar
 * diminta orang lain, dan dampaknya pada engagement.
 */
const contentCreator: Indikator[] = [
  {
    key: "ketepatan_design",
    label: "Ketepatan Waktu",
    bobot: 80,
    // Targetnya 100% dan capaiannya dihitung dari nilai tiap permintaan:
    // tenggat longgar yang terlambat MENGURANGI, tenggat mendesak yang
    // ditepati MENAMBAH. Yang meminta ikut menanggung akibat pilihannya.
    target: { jenis: "tetap", nilai: 100 },
    actual: { sumber: "otomatis", kode: "ketepatan_design" },
    penjelasan:
      "Otomatis dari Antrian Design. Terlambat pada tenggat longgar (Sebelum H-5, H-5) mengurangi; tepat waktu pada tenggat mendesak (H-3, H-1) menambah.",
  },
  {
    key: "interaksi",
    label: "Impact — Engagement",
    bobot: 20,
    target: { jenis: "tumbuh", pertumbuhan: TUMBUH_CREATIVE },
    actual: { sumber: "manual" },
    penjelasan: `Like + komentar + share + save. Target = capaian bulan lalu + ${TUMBUH_CREATIVE}%.`,
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
    // Ditandai OTOMATIS, bukan manual. Angkanya memang sudah ditarik dari ESB
    // sejak awal, tapi selama ia tertulis "manual" pilihannya tetap muncul di
    // dialog Input — dan indikator otomatis yang bisa diketik ulang adalah cara
    // paling mudah membuat dua angka berbeda untuk hal yang sama.
    actual: { sumber: "otomatis", kode: "net_sales_korporat" },
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

/**
 * Quality Assurance & Control.
 *
 * Enam indikator dari Juknis KPI QC/AC 2026. Empat di antaranya berupa
 * PERSENTASE KEPATUHAN — quality, hygiene, SOP, dan reporting — yang datang
 * dari hasil review submission web dan CCTV, bukan dari jumlah kegiatan.
 * Angkanya diketik satu per bulan karena penilaiannya memang hasil
 * pertimbangan atas banyak pemeriksaan, bukan hitungan baris.
 *
 * Dua sisanya punya sumbernya sendiri: komplain dihitung dari modul Complaints,
 * dan monitoring CCTV dari catatan log yang wajib berbukti — juknisnya tegas
 * bahwa monitoring harus punya log dan hasil, "bukan sekadar membuka kamera".
 */
const qualityControl: Indikator[] = [
  {
    key: "qc_quality",
    label: "Quality & Product Standard",
    bobot: 30,
    target: { jenis: "tetap", nilai: 95 },
    actual: { sumber: "manual" },
    satuan: "persen",
    penjelasan: "Compliance hasil review product standard: recipe, porsi, tampilan, handling, suhu. Target 95%.",
  },
  {
    key: "qc_hygiene",
    label: "Hygiene & Food Safety Audit",
    bobot: 25,
    target: { jenis: "tetap", nilai: 95 },
    actual: { sumber: "manual" },
    satuan: "persen",
    penjelasan: "Compliance kebersihan dan food safety dari submission web, CCTV, dan bukti audit. Target 95%.",
  },
  {
    key: "qc_sop",
    label: "SOP & Operational Compliance",
    bobot: 15,
    target: { jenis: "tetap", nilai: 95 },
    actual: { sumber: "manual" },
    satuan: "persen",
    penjelasan: "Compliance checklist opening, preparation, cooking, closing, dan SOP operasional. Target 95%.",
  },
  {
    key: "qc_complaint",
    label: "Complaint & Customer Quality",
    bobot: 15,
    target: { jenis: "tetap", nilai: 20 },
    actual: { sumber: "otomatis", kode: "komplain_food_quality" },
    // RUMUS YANG SAMA PERSIS dengan Complaint di Coordinator Area, atas
    // keputusan pemiliknya. Sebelumnya `batas_maks`, dan itu membuat sembilan
    // belas komplain bernilai sama dengan nol komplain — indikatornya baru
    // bergerak setelah batasnya nyaris terlampaui, sehingga sepanjang bulan ia
    // tidak mengukur apa pun. Satu komplain kini berharga 5% capaian.
    penilaian: "kurang_linear",
    penjelasan:
      "Komplain kategori kualitas makanan dari modul Complaints. Batas 20 per bulan, dan tiap komplain memotong 5% capaian indikator ini (0,75% dari skor total); 20 komplain membuatnya nol.",
  },
  {
    key: "qc_cctv",
    label: "CCTV / Monitoring Control",
    bobot: 10,
    target: { jenis: "tetap", nilai: 40 },
    actual: { sumber: "entri", entri: "cctv_qc" },
    penjelasan: "40 monitoring per bulan, rata-rata 10 per minggu. Tiap log wajib berbukti — bukan sekadar membuka kamera.",
  },
  {
    key: "qc_reporting",
    label: "Reporting & Follow Up",
    bobot: 5,
    target: { jenis: "tetap", nilai: 100 },
    actual: { sumber: "manual" },
    satuan: "persen",
    penjelasan: "Ketepatan waktu daily report dan tindak lanjut temuan. Target 100%.",
  },
];

/**
 * Coordinator Area.
 *
 * Lima indikator yang seluruhnya bicara tentang SATU AREA, bukan satu orang —
 * penjualan, laba, kebersihan, komplain, dan harga pokok area itu. Karena itu
 * angkanya diambil dari outlet-outlet di area yang dipegang orangnya.
 */
const coordinatorArea: Indikator[] = [
  {
    key: "gross_sales",
    label: "Gross Sales",
    bobot: 35,
    target: { jenis: "avg3", pertumbuhan: 15 },
    actual: { sumber: "otomatis", kode: "gross_sales_area" },
    satuan: "rupiah",
    penjelasan: "Rata-rata 3 bulan terakhir + 15%. Actual otomatis dari ESB, dijumlah se-area.",
  },
  {
    key: "net_profit",
    label: "Net Profit",
    bobot: 30,
    target: { jenis: "porsi", dari: "gross_sales", rasio: 30 },
    actual: { sumber: "otomatis", kode: "net_profit_area" },
    satuan: "rupiah",
    penjelasan: "Target 30% dari Gross Sales yang tercapai. Dijumlah dari laba bersih tiap outlet.",
  },
  {
    key: "hygiene_cctv",
    label: "Hygiene Audit / CCTV Monitoring",
    bobot: 5,
    target: { jenis: "tetap", nilai: 40 },
    actual: { sumber: "entri", entri: "hygiene_cctv" },
    penjelasan: "10x per minggu, 40 per bulan. Tiap catatan wajib berbukti.",
  },
  {
    key: "komplain_area",
    label: "Complaint",
    bobot: 10,
    target: { jenis: "tetap", nilai: 20 },
    actual: { sumber: "otomatis", kode: "komplain_area" },
    penilaian: "kurang_linear",
    penjelasan:
      "Batas 20 per bulan, di luar kategori kualitas makanan. Tiap komplain memotong 5% capaian indikator ini (0,5% dari skor total); 20 komplain membuatnya nol.",
  },
  {
    key: "hpp",
    label: "Harga Pokok Penjualan",
    bobot: 20,
    target: { jenis: "tetap", nilai: 40 },
    actual: { sumber: "otomatis", kode: "hpp_area" },
    penilaian: "lulus_maks",
    satuan: "persen",
    penjelasan: "Maksimal 40%. Ditimbang penjualan tiap outlet, bukan dirata-rata begitu saja.",
  },
];


/**
 * Human Capital.
 *
 * KEENAM ANGKANYA SUDAH ADA dan sudah otomatis — dihitung modul HC-MOS dari
 * Permintaan Karyawan, Kontrak Tracker, dan Onboarding. Yang ditambahkan di
 * sini BUKAN perhitungan baru, melainkan pintu masuknya ke halaman KPI: bobot
 * dan targetnya disalin dari definisi yang sama, dan angkanya dibaca dari
 * perhitungan yang sama. Menuliskan ulang rumusnya berarti dua tempat yang
 * bisa berbeda diam-diam, dan dua halaman yang menyebut skor berbeda untuk
 * departemen yang sama.
 *
 * Dua di antaranya MAKIN KECIL MAKIN BAIK — kecepatan pemenuhan (hari) dan
 * turnover. Tanpa `batas_maks` keduanya dinilai terbalik: turnover 30% dari
 * batas 10% menghasilkan 300% lalu dipotong jadi 100%, dan departemen yang
 * paling banyak kehilangan orang justru mendapat nilai penuh.
 */
const humanCapital: Indikator[] = [
  {
    key: "hc_pemenuhan_rekrutmen",
    label: "Pemenuhan Permintaan Pegawai",
    bobot: 15,
    target: { jenis: "tetap", nilai: 90 },
    actual: { sumber: "otomatis", kode: "hc_pemenuhan_rekrutmen" },
    satuan: "persen",
    penjelasan: "Otomatis dari Permintaan Karyawan: jumlah direkrut dibanding jumlah diminta. Target 90%.",
  },
  {
    key: "hc_kecepatan_rekrutmen",
    label: "Kecepatan Pemenuhan",
    bobot: 10,
    target: { jenis: "tetap", nilai: 30 },
    actual: { sumber: "otomatis", kode: "hc_kecepatan_rekrutmen" },
    penilaian: "batas_maks",
    satuan: "angka",
    penjelasan: "Rata-rata HARI dari permintaan diajukan sampai terlaksana. Batas 30 hari — makin cepat makin baik.",
  },
  {
    key: "hc_kepatuhan_kontrak",
    label: "Kepatuhan Kontrak Kerja",
    bobot: 25,
    target: { jenis: "tetap", nilai: 95 },
    actual: { sumber: "otomatis", kode: "hc_kepatuhan_kontrak" },
    satuan: "persen",
    penjelasan: "Otomatis dari Kontrak Tracker: karyawan outlet yang kontraknya masih berlaku. Target 95%.",
  },
  {
    key: "hc_kepatuhan_laporan",
    label: "Kepatuhan Update Bulanan",
    bobot: 15,
    target: { jenis: "tetap", nilai: 90 },
    actual: { sumber: "otomatis", kode: "hc_kepatuhan_laporan" },
    satuan: "persen",
    penjelasan: "Otomatis dari Kontrak Tracker: outlet yang mengirim laporan bulan berjalan. Target 90%.",
  },
  {
    key: "hc_penyelesaian_onboarding",
    label: "Penyelesaian Onboarding",
    bobot: 15,
    target: { jenis: "tetap", nilai: 85 },
    actual: { sumber: "otomatis", kode: "hc_penyelesaian_onboarding" },
    satuan: "persen",
    penjelasan: "Otomatis dari modul Onboarding: rata-rata butir ceklis yang sudah tuntas. Target 85%.",
  },
  {
    key: "hc_turnover",
    label: "Turnover Karyawan Outlet",
    bobot: 20,
    target: { jenis: "tetap", nilai: 10 },
    actual: { sumber: "otomatis", kode: "hc_turnover" },
    penilaian: "batas_maks",
    satuan: "persen",
    penjelasan: "Otomatis dari Kontrak Tracker: karyawan keluar dibanding jumlah karyawan. Batas 10% — makin kecil makin baik.",
  },
];

export const INDIKATOR: Record<KodePosisi, Indikator[]> = {
  operational_ca: coordinatorArea,
  hc: humanCapital,
  creative_content: contentCreator,
  creative_sosmed: sosialMedia,
  finance_accounting: accounting,
  finance_finance: finance,
  finance_tax: tax,
  marcomm,
  pdq_qc: qualityControl,
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
