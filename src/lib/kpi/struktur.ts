/**
 * Departemen, posisi, dan indikator KPI.
 *
 * YANG DINILAI POSISINYA, BUKAN ORANGNYA. Nama PIC ikut dicatat supaya jelas
 * siapa yang mengisi dan siapa yang dievaluasi, tapi seluruh struktur dan
 * riwayat angkanya menempel pada posisi. Kalau menempel pada orang, satu
 * pergantian staf memutus seluruh riwayat KPI-nya — dan justru perbandingan
 * antar-bulan itu yang membuat KPI berguna.
 */

export type KodeDepartemen = "operational" | "creative" | "finance" | "pdq" | "marcomm" | "hrd";

export type KodePosisi =
  | "operational_ca"
  | "operational_software"
  | "operational_pos"
  | "creative_content"
  | "creative_sosmed"
  | "finance_accounting"
  | "finance_finance"
  | "finance_tax"
  | "marcomm"
  | "pdq_qc"
  | "pdq_food"
  | "pdq_beverage"
  | "pdq_head_food"
  | "pdq_head_pdq"
  | "hc";

export interface Departemen {
  kode: KodeDepartemen;
  nama: string;
  /**
   * Nama pendek untuk sumbu grafik.
   *
   * "Product Development & Quality" berdampingan dengan "Human Resource
   * Development" pada satu sumbu akan bertabrakan, lalu dipotong jadi dua
   * label yang sama-sama berakhir dengan titik-titik — dan yang membacanya
   * tidak bisa lagi membedakan keduanya.
   */
  singkat: string;
  ikon: string;
  /** Posisi yang KPI-nya sudah dirancang. Kosong = departemennya menyusul. */
  posisi: KodePosisi[];
  /** Posisi yang sudah didaftar tapi indikatornya belum ditentukan. */
  menyusul?: string[];
}

export interface Posisi {
  kode: KodePosisi;
  departemen: KodeDepartemen;
  nama: string;
  /** Nama PIC apa adanya — dipakai sebagai keterangan, bukan penentu akses. */
  pic: string[];
  /**
   * Daftar PIC-nya datang dari basis data, bukan dari berkas ini.
   *
   * Coordinator Area berganti jauh lebih sering daripada posisi lain, dan tiap
   * orang menilai AREA yang berbeda — menuliskan namanya di sini berarti setiap
   * pergantian staf butuh deploy, dan sampai deploy itu terjadi orangnya tidak
   * punya rapor sama sekali.
   */
  picDinamis?: "area_coordinator";
  /**
   * Dinilai PER ORANG, bukan sebagai satu tim.
   *
   * Finance diisi tiga orang yang pekerjaannya terpisah — capaian Nisa bukan
   * capaian Fatin, dan menggabungkannya membuat yang rajin menutupi yang
   * tertinggal. Marketing Communication justru sebaliknya: bertiga mengerjakan
   * satu daftar event yang sama, jadi memisahkannya akan membagi satu pekerjaan
   * jadi tiga rapor yang tidak ada artinya sendiri-sendiri.
   *
   * Posisi yang hanya diisi satu orang tidak perlu penanda ini.
   */
  perPic?: boolean;
}

export const DEPARTEMEN: Departemen[] = [
  {
    kode: "operational",
    nama: "Operational",
    singkat: "Operational",
    ikon: "Store",
    posisi: ["operational_ca", "operational_software", "operational_pos"],
    // Yang tersisa menyusul tinggal System Support-nya sendiri — indikatornya
    // belum ditentukan, dan mendaftarkannya sebagai posisi berarti membuka
    // halaman KPI yang seluruh barisnya kosong.
    menyusul: ["System Support (Pricil, Adinda Latifah)"],
  },
  { kode: "creative", nama: "Creative", singkat: "Creative", ikon: "Palette", posisi: ["creative_content"] },
  { kode: "finance", nama: "Finance", singkat: "Finance", ikon: "Wallet", posisi: ["finance_accounting", "finance_finance", "finance_tax"] },
  {
    kode: "pdq",
    nama: "Product Development & Quality",
    singkat: "PDQ",
    ikon: "FlaskConical",
    posisi: ["pdq_qc", "pdq_food", "pdq_beverage", "pdq_head_food", "pdq_head_pdq"],
    menyusul: ["Quality Assurance & Control (Radika)"],
  },
  { kode: "marcomm", nama: "Marketing Communication", singkat: "MarComm", ikon: "Megaphone", posisi: ["marcomm", "creative_sosmed"] },
  // Namanya "Human Capital" — itu yang dipakai perusahaan, dan itu pula yang
  // tertulis di departemen tiap orangnya di basis data. KODE DEPARTEMENNYA
  // sengaja tetap "hrd": nilai bulanan dan riwayat KPI menempel pada kode itu,
  // dan menggantinya memutus riwayat yang sudah terkumpul tanpa satu pun pesan.
  { kode: "hrd", nama: "Human Capital", singkat: "Human Capital", ikon: "UsersRound", posisi: ["hc"] },
];

export const POSISI: Posisi[] = [
  // PIC-nya kosong di sini dengan sengaja — diisi dari daftar Coordinator Area
  // di basis data, lihat `picDinamis`.
  { kode: "operational_ca", departemen: "operational", nama: "Coordinator Area", pic: [], perPic: true, picDinamis: "area_coordinator" },
  // Dua posisi yang menopang sistem, bukan outlet. Keduanya duduk di
  // Operational karena yang mereka jaga — data penjualan dan mesin kasir —
  // adalah alat kerja outlet; tapi keduanya dinilai atas pekerjaan sistem,
  // bukan atas omzet satu area.
  { kode: "operational_software", departemen: "operational", nama: "Coordinator Software", pic: ["Fikri"] },
  { kode: "operational_pos", departemen: "operational", nama: "Coordinator POS", pic: ["Evan Wijaya"] },
  { kode: "creative_content", departemen: "creative", nama: "Content Creator", pic: ["Via", "Dhimas", "Seka", "Ricky"], perPic: true },
  // Sosial Media pindah ke Marketing Communication — sejak tim ini tidak lagi
  // bergabung dengan Creative. KODE POSISINYA SENGAJA TIDAK DIUBAH: seluruh
  // catatan kegiatan dan angka bulanannya menempel pada kode itu, dan
  // menggantinya akan memutus riwayat yang sudah terkumpul tanpa satu pun
  // pesan.
  { kode: "creative_sosmed", departemen: "marcomm", nama: "Sosial Media", pic: ["Zia"] },
  { kode: "finance_accounting", departemen: "finance", nama: "Accounting", pic: ["Bella"] },
  { kode: "finance_finance", departemen: "finance", nama: "Finance", pic: ["Nisa", "Fatin", "Fetty"], perPic: true },
  { kode: "finance_tax", departemen: "finance", nama: "Tax", pic: ["Samsul"] },
  { kode: "marcomm", departemen: "marcomm", nama: "Marketing Communication", pic: ["Amanda", "Dita", "Marta"] },
  { kode: "pdq_qc", departemen: "pdq", nama: "Quality Assurance & Control", pic: ["Radika"] },
    // Nanda TIDAK ikut di sini: ia dinilai sebagai Head Food Development, dan
  // satu orang yang muncul di dua daftar akan dinilai dua kali dengan indikator
  // yang berbeda tanpa ada yang menyadarinya.
  { kode: "pdq_food", departemen: "pdq", nama: "Food Staff", pic: ["Mustadi", "Bagas"], perPic: true },
  { kode: "pdq_beverage", departemen: "pdq", nama: "Beverage Staff", pic: ["Adam", "Abil"], perPic: true },
  { kode: "pdq_head_food", departemen: "pdq", nama: "Head Food Development", pic: ["Nanda"] },
  { kode: "pdq_head_pdq", departemen: "pdq", nama: "Head Product Development & Quality", pic: [] },
  // SATU POSISI untuk seluruh departemen, bukan satu per orang.
  //
  // Keenam angkanya memang angka departemen: kepatuhan kontrak, kepatuhan
  // laporan bulanan, dan turnover dihitung dari seluruh outlet sekaligus dan
  // tidak bisa dibagi ke satu orang. Memecahnya per orang berarti mengarang
  // pembagian yang tidak ada di datanya, lalu menilai orang atas angka yang
  // bukan hasil pekerjaannya sendiri.
  { kode: "hc", departemen: "hrd", nama: "Human Capital", pic: ["MT Adrianto", "Dini Amalia", "Riva Asila", "Uswatun Khasanah"] },
];

/**
 * Menu sidebar untuk tiap posisi.
 *
 * Tinggal di sini, bersama posisinya sendiri, supaya aturan akses bisa
 * memakainya tanpa lewat lapisan izin — dan supaya menambah posisi baru
 * berarti mengubah SATU berkas, bukan dua yang harus diubah serempak.
 */
export const MENU_POSISI: Record<KodePosisi, string> = {
  operational_ca: "kpi_op_ca",
  operational_software: "kpi_op_software",
  operational_pos: "kpi_op_pos",
  creative_content: "kpi_creative_content",
  creative_sosmed: "kpi_creative_sosmed",
  finance_accounting: "kpi_fin_accounting",
  finance_finance: "kpi_fin_finance",
  finance_tax: "kpi_fin_tax",
  marcomm: "kpi_marcomm",
  pdq_qc: "kpi_pdq_qc",
  pdq_food: "kpi_pdq_food",
  pdq_beverage: "kpi_pdq_beverage",
  pdq_head_food: "kpi_pdq_head_food",
  pdq_head_pdq: "kpi_pdq_head_pdq",
  hc: "kpi_hc",
};

export const posisiDari = (kode: string): Posisi | undefined => POSISI.find((p) => p.kode === kode);
export const departemenDari = (kode: string): Departemen | undefined => DEPARTEMEN.find((d) => d.kode === kode);
export const posisiDepartemen = (kode: KodeDepartemen): Posisi[] =>
  (departemenDari(kode)?.posisi ?? []).map(posisiDari).filter(Boolean) as Posisi[];
