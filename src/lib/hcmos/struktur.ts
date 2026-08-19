/**
 * Struktur Organisasi GWG Group — bagan resminya.
 *
 * Isi berkas ini adalah KEPUTUSAN ORGANISASI, bukan data yang bisa dihitung
 * dari sistem. Siapa memimpin divisi apa, unit apa saja berada di bawahnya, dan
 * siapa atasannya ditetapkan lewat dokumen Struktur Organisasi — tidak ada di
 * tabel mana pun, dan menebaknya dari daftar karyawan akan salah: `users` tahu
 * seseorang berdepartemen "Creative", tapi tidak tahu bahwa Creative berada di
 * bawah divisi yang sama dengan IT.
 *
 * Yang BISA dihitung tetap dihitung dan tidak ditulis di sini — jumlah orang
 * per kelompok, jumlah outlet, jumlah area. Menuliskan angka di berkas ini
 * berarti angka itu berhenti berubah saat orangnya bertambah, dan tidak ada
 * yang menyadarinya sampai ada yang membandingkannya dengan User Management.
 */

export interface DivisiKantor {
  nama: string;
  /** Kepala divisi atau tim yang memegangnya. */
  pic: string;
  /** Unit kerja di bawah divisi ini. */
  unit: string[];
  melaporKe: string;
}

/**
 * Divisi kantor pusat.
 *
 * "IT & Creative" digabung satu divisi sesuai revisi Meeting Fitur HRD —
 * IT Infrastruktur, Business System, dan Data & BI berada di rumah yang sama
 * dengan Graphic Design dan Photo & Videography.
 */
export const DIVISI_KANTOR: DivisiKantor[] = [
  {
    nama: "Human Capital & Legal",
    pic: "Adrian",
    unit: ["Talent Acquisition", "L&D dan Comp&Ben Admin", "Internal Audit", "Legal"],
    melaporKe: "Direktur (Agustio)",
  },
  {
    nama: "Finance & Accounting",
    pic: "Tim Finance",
    unit: ["AR/AP Staff", "Treasury", "Accounting & Verification", "Tax"],
    melaporKe: "Direktur (Agustio)",
  },
  {
    nama: "Marketing & Business Development",
    pic: "Amanda / Ilfiana",
    unit: [
      "Brand & Digital & Social Media Marketing",
      "Community & Customer Relation",
      "Expansion & Partnership",
    ],
    melaporKe: "Direktur (Agustio)",
  },
  {
    nama: "Procurement & Supply Chain",
    pic: "Tim Procurement",
    unit: ["Strategic Sourcing", "Vendor & Contract", "Warehouse", "Purchasing & Sales"],
    melaporKe: "Direktur (Agustio)",
  },
  {
    nama: "IT & Creative",
    pic: "Tim IT/Creative",
    unit: [
      "IT Infrastruktur & Support",
      "Business System",
      "Data & BI Analytics",
      "Graphic Design",
      "Photo & Videography",
    ],
    melaporKe: "Direktur (Agustio)",
  },
  {
    nama: "Production & Operational",
    pic: "Andi",
    unit: [
      "Roastery",
      "Central Kitchen & Bakery",
      "QA",
      "Product & Beverage Development",
      "Coordinator Area",
    ],
    melaporKe: "Direktur (Agustio)",
  },
];

export interface LevelOutlet {
  level: number;
  jabatan: string;
  melaporKe: string;
}

/**
 * Jenjang jabatan di outlet — berlaku seragam di seluruh brand.
 *
 * Seragamnya penting dan bukan kebetulan: jenjang yang berbeda per brand
 * membuat kenaikan golongan dan jalur karier tidak bisa dibandingkan antar
 * cabang, padahal orangnya sering berpindah brand.
 */
export const JENJANG_OUTLET: LevelOutlet[] = [
  { level: 1, jabatan: "Crew / Barista / Kasir", melaporKe: "Shift Leader" },
  { level: 2, jabatan: "Shift Leader", melaporKe: "Supervisor" },
  { level: 3, jabatan: "Supervisor", melaporKe: "Outlet Manager" },
  { level: 4, jabatan: "Outlet Manager", melaporKe: "Head of Operation" },
  { level: 5, jabatan: "Head of Operation", melaporKe: "Direktur" },
];

/**
 * Kelompok besar tempat seorang karyawan kantor bekerja.
 *
 * Dipakai grafik "Distribusi Headcount per Kelompok". Departemen di User
 * Management jumlahnya belasan dan sebagian hanya berisi satu-dua orang; grafik
 * dengan belasan batang kerdil tidak menunjukkan apa pun. Kelompok inilah yang
 * ditanyakan orang saat melihat sebaran: berapa banyak yang di dapur, berapa
 * yang di kantor, berapa yang di gudang.
 */
export const KELOMPOK_KANTOR: Record<string, string> = {
  Production: "Tim Produksi",
  "Supply Chain": "Warehouse & Supply Chain",
  Creative: "IT & Creative",
  Operational: "Operation",
  Operation: "Operation",
  "Finance Accounting Tax": "Finance & Accounting",
  Finance: "Finance & Accounting",
  "Marketing Communication": "Marketing & BD",
  "Business Development": "Marketing & BD",
  "Product Development & Quality": "Product Dev & QA",
  "Human Capital": "Human Capital & Legal",
  Auditor: "Human Capital & Legal",
  Supervisor: "Supervisor Outlet",
  "Executive Assistant": "Kantor Direksi",
};

/** Kelompok sebuah departemen; yang tidak dipetakan masuk "Lainnya". */
export const kelompokDari = (departemen: string): string =>
  KELOMPOK_KANTOR[departemen.trim()] ?? "Lainnya";

/**
 * Jenjang jabatan di kantor pusat.
 *
 * Ditulis terpisah dari `JENJANG_OUTLET` dan bukan digabung, karena keduanya
 * memang bukan satu tangga: seorang Supervisor outlet tidak berada di anak
 * tangga yang sama dengan Supervisor/Lead divisi, dan menaruhnya dalam satu
 * daftar membuat perpindahan antar keduanya terbaca sebagai kenaikan biasa
 * padahal itu perpindahan jalur.
 */
export const JENJANG_MANAJEMEN: LevelOutlet[] = [
  { level: 1, jabatan: "Staff", melaporKe: "Officer/Coordinator" },
  { level: 2, jabatan: "Officer/Coordinator", melaporKe: "Supervisor/Lead" },
  { level: 3, jabatan: "Supervisor/Lead", melaporKe: "Manager/Head of Division" },
  { level: 4, jabatan: "Manager/Head of Division", melaporKe: "Direktur" },
];

/** Apa yang dikerjakan di tiap anak tangga — dipakai halaman Career Path. */
export const TUGAS_JENJANG: Record<string, string> = {
  "Crew / Barista / Kasir": "Titik masuk operasional outlet",
  "Shift Leader": "Memimpin shift & tim kecil",
  Supervisor: "Mengelola operasional harian outlet",
  "Outlet Manager": "Bertanggung jawab penuh atas satu outlet",
  "Head of Operation": "Mengelola beberapa outlet atau brand",
  Staff: "Titik masuk divisi manajemen",
  "Officer/Coordinator": "Menangani area kerja spesifik",
  "Supervisor/Lead": "Mengoordinasi tim kecil",
  "Manager/Head of Division": "Memimpin divisi",
};
