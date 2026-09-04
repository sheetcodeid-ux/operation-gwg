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
  | "creative_content"
  | "creative_sosmed"
  | "finance_accounting"
  | "finance_finance"
  | "finance_tax"
  | "marcomm"
  | "pdq_food"
  | "pdq_beverage"
  | "pdq_head_food"
  | "pdq_head_pdq";

export interface Departemen {
  kode: KodeDepartemen;
  nama: string;
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
    ikon: "Store",
    posisi: [],
    menyusul: ["Coordinator Area (Deo)", "System Support (Fikri)", "System Support POS (Evan, Adinda, Pricil)"],
  },
  { kode: "creative", nama: "Creative", ikon: "Palette", posisi: ["creative_content", "creative_sosmed"] },
  { kode: "finance", nama: "Finance", ikon: "Wallet", posisi: ["finance_accounting", "finance_finance", "finance_tax"] },
  {
    kode: "pdq",
    nama: "Product Development & Quality",
    ikon: "FlaskConical",
    posisi: ["pdq_food", "pdq_beverage", "pdq_head_food", "pdq_head_pdq"],
    menyusul: ["Quality Assurance & Control (Radika)"],
  },
  { kode: "marcomm", nama: "Marketing Communication", ikon: "Megaphone", posisi: ["marcomm"] },
  { kode: "hrd", nama: "Human Resource Development", ikon: "UsersRound", posisi: [], menyusul: ["Human Resource Development (Dini Amalia)"] },
];

export const POSISI: Posisi[] = [
  { kode: "creative_content", departemen: "creative", nama: "Content Creator", pic: ["Ricky", "Seka"] },
  { kode: "creative_sosmed", departemen: "creative", nama: "Sosial Media", pic: ["Via", "Zia"] },
  { kode: "finance_accounting", departemen: "finance", nama: "Accounting", pic: ["Bella"] },
  { kode: "finance_finance", departemen: "finance", nama: "Finance", pic: ["Nisa", "Fatin", "Fetty"], perPic: true },
  { kode: "finance_tax", departemen: "finance", nama: "Tax", pic: ["Samsul"] },
  { kode: "marcomm", departemen: "marcomm", nama: "Marketing Communication", pic: ["Amanda", "Dita", "Marta"] },
  { kode: "pdq_food", departemen: "pdq", nama: "Food Staff", pic: ["Mustadi", "Nanda", "Bagas"], perPic: true },
  { kode: "pdq_beverage", departemen: "pdq", nama: "Beverage Staff", pic: ["Adam", "Abil"], perPic: true },
  { kode: "pdq_head_food", departemen: "pdq", nama: "Head Food Development", pic: ["Nanda"] },
  { kode: "pdq_head_pdq", departemen: "pdq", nama: "Head Product Development & Quality", pic: [] },
];

export const posisiDari = (kode: string): Posisi | undefined => POSISI.find((p) => p.kode === kode);
export const departemenDari = (kode: string): Departemen | undefined => DEPARTEMEN.find((d) => d.kode === kode);
export const posisiDepartemen = (kode: KodeDepartemen): Posisi[] =>
  (departemenDari(kode)?.posisi ?? []).map(posisiDari).filter(Boolean) as Posisi[];
