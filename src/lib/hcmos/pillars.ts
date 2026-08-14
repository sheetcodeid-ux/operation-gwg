/**
 * HC-MOS — Human Capital Management Operating System.
 *
 * Kerangka 9 pilar Human Capital beserta sub-menunya, sesuai Juknis HC-MOS
 * GWG Group v2.0 (Revisi 10, Full Integrated).
 *
 * Berkas ini SATU-SATUNYA sumber kebenaran untuk susunan pilar, PIC, dan
 * matriks RACI. Halaman pilar, halaman RACI, dan dasbor semuanya membacanya
 * dari sini — supaya tidak mungkin ada satu layar yang menampilkan susunan
 * berbeda dari layar lain, kesalahan yang paling sering terjadi ketika daftar
 * seperti ini disalin ke beberapa tempat.
 *
 * Yang penting dipahami: sebagian besar sub-menu HC-MOS SUDAH ADA di sistem
 * ini dengan nama lain (Document Queue = Antrian Dokumen, Manpower Request =
 * Permintaan Karyawan, Kenaikan Golongan = Assessment Golongan, dan
 * seterusnya). Sub-menu seperti itu MENUNJUK ke modul yang sudah berjalan,
 * bukan dibuat ulang. Membuat salinan kedua dari modul yang sama berarti dua
 * tempat menyimpan data yang sama dan mulai berbeda diam-diam.
 */

export type HcScope = "manajemen" | "outlet";

export const SCOPE_LABEL: Record<HcScope, string> = {
  manajemen: "Manajemen (GWG)",
  outlet: "Outlet",
};

/** Peran dalam matriks RACI. */
export const RACI_ROLES = ["R", "A", "C", "I"] as const;
export type RaciRole = (typeof RACI_ROLES)[number];

export const RACI_LABEL: Record<RaciRole, string> = {
  R: "Responsible — mengerjakan",
  A: "Accountable — bertanggung jawab akhir",
  C: "Consulted — dimintai pendapat",
  I: "Informed — diberi tahu",
};

/**
 * Isi satu baris matriks: SIAPA yang memegang tiap peran.
 *
 * Namanya ditulis apa adanya seperti matriks yang dikirim Human Capital —
 * "Riva", "Uswatun", "Outlet Manager", "Karyawan Bersangkutan". Sempat saya
 * ganti jadi peran generik ("PIC Pilar"), dan itu keliru: yang berguna bagi
 * pembacanya justru namanya, karena itulah yang menentukan ia harus menghubungi
 * siapa. Tanda "—" berarti memang tidak ada pemegangnya.
 */
export type RaciEntry = Record<RaciRole, string>;

export interface HcSubmenu {
  slug: string;
  label: string;
  /** Apa gunanya — kalimat dari Juknis Bab 4. */
  fungsi: string;
  /** Nama ikon lucide. */
  icon: string;
  /** Sub-menu ini hanya relevan untuk satu scope. Kosong = dua-duanya. */
  scopeOnly?: HcScope;
  /**
   * Rute modul yang SUDAH berjalan di sistem ini. Bila diisi, sub-menunya
   * menunjuk ke sana alih-alih dibuat ulang.
   */
  href?: string;
  /** Nama modul itu di sistem, bila namanya berbeda dari istilah HC-MOS. */
  hrefLabel?: string;
  /** Pemegang tiap peran untuk aktivitas ini (matriks RACI Bab 8). */
  raci: RaciEntry;
}

export interface HcPillar {
  slug: string;
  label: string;
  icon: string;
  /** PIC pilar sesuai Juknis Bab 3. */
  pic: string;
  picRole: string;
  /** Ringkasan satu kalimat untuk kartu di dasbor. */
  ringkas: string;
  submenus: HcSubmenu[];
}

/** SOP muncul di setiap pilar dengan bentuk yang sama — jangan disalin sembilan kali. */
const sop = (pilar: string, slugPilar: string, raci: RaciEntry): HcSubmenu => ({
  slug: "sop",
  label: "SOP",
  fungsi: `Prosedur standar operasional pilar ${pilar}.`,
  icon: "ScrollText",
  href: `/hc-mos/dokumen?jenis=sop&pilar=${slugPilar}`,
  hrefLabel: "SOP pilar ini",
  raci,
});

export const HC_PILLARS: HcPillar[] = [
  {
    slug: "organization-development",
    label: "Organization Development",
    icon: "Network",
    pic: "Riva",
    picRole: "Organization & People Development",
    ringkas: "Struktur organisasi, data karyawan, dan antrian dokumen.",
    submenus: [
      {
        slug: "struktur-organisasi",
        label: "Struktur Organisasi",
        fungsi: "Peta struktur organisasi GWG Group — kantor pusat & seluruh outlet.",
        icon: "Building2",
        href: "/hc-mos/struktur",
        raci: { R: "Riva", A: "Adrian", C: "Uswatun, Head of Operation", I: "Seluruh Karyawan" },
      },
      {
        slug: "database-karyawan",
        label: "Database Karyawan",
        fungsi: "Data karyawan Manajemen (Office & Warehouse) dan rekap seluruh outlet.",
        icon: "Database",
        href: "/hc-mos/karyawan",
        raci: { R: "Uswatun", A: "Adrian", C: "Riva", I: "Outlet Manager, Kepala Divisi" },
      },
      {
        slug: "document-queue",
        label: "Document Queue",
        fungsi: "Antrian dokumen masuk dari cabang dan divisi.",
        icon: "FileText",
        href: "/hc/antrian",
        hrefLabel: "Antrian Dokumen",
        raci: { R: "Uswatun", A: "Adrian", C: "Riva", I: "Karyawan Terkait" },
      },
      {
        slug: "culture-value",
        label: "Culture & Value",
        fungsi: "Nilai-nilai inti (core values) GWG Group.",
        icon: "HeartHandshake",
        href: "/hc-mos/dokumen?jenis=culture",
        hrefLabel: "Culture & Value",
        raci: { R: "Riva", A: "Adrian", C: "Kepala Divisi", I: "Seluruh Karyawan" },
      },
      sop("Organization Development", "organization-development", { R: "Riva", A: "Adrian", C: "Uswatun", I: "Seluruh Karyawan" }),
    ],
  },
  {
    slug: "recruitment-selection",
    label: "Recruitment & Selection",
    icon: "UserPlus",
    pic: "Dini",
    picRole: "Talent Acquisition",
    ringkas: "Permintaan tenaga kerja, kandidat, wawancara, dan onboarding.",
    submenus: [
      {
        slug: "manpower-request",
        label: "Manpower Request",
        fungsi: "Permintaan tambahan tenaga kerja dari divisi maupun outlet.",
        icon: "ClipboardList",
        href: "/hc/permintaan",
        hrefLabel: "Permintaan Karyawan",
        raci: { R: "Dini", A: "Adrian", C: "Head of Operation, Outlet Manager, Riva", I: "Kepala Divisi Terkait" },
      },
      {
        slug: "database-kandidat",
        label: "Database Kandidat",
        fungsi: "Basis data pelamar untuk posisi manajemen maupun outlet.",
        icon: "Users",
        href: "/hc-mos/rekrutmen",
        hrefLabel: "Database Kandidat",
        raci: { R: "Dini", A: "Adrian", C: "—", I: "Outlet Manager" },
      },
      {
        slug: "jadwal-interview",
        label: "Jadwal Interview",
        fungsi: "Kalender jadwal wawancara kandidat.",
        icon: "Calendar",
        href: "/hc-mos/rekrutmen?tab=interview",
        hrefLabel: "Jadwal Interview",
        raci: { R: "Dini", A: "Adrian", C: "Hiring Manager/User", I: "Kandidat" },
      },
      {
        slug: "onboarding",
        label: "Onboarding",
        fungsi: "Program orientasi karyawan baru — materi berbeda per scope.",
        icon: "LogIn",
        href: "/hc-mos/rekrutmen?tab=onboarding",
        hrefLabel: "Onboarding",
        raci: { R: "Dini", A: "Adrian", C: "Riva", I: "Outlet Manager" },
      },
      sop("Recruitment & Selection", "recruitment-selection", { R: "Dini", A: "Adrian", C: "Uswatun", I: "Outlet Manager" }),
    ],
  },
  {
    slug: "learning-development",
    label: "Learning & Development",
    icon: "GraduationCap",
    pic: "Riva",
    picRole: "Organization & People Development",
    ringkas: "Pelatihan, kompetensi, Fast Start & Fast Track, serta belajar mandiri.",
    submenus: [
      {
        slug: "training-calendar",
        label: "Training Calendar",
        fungsi: "Kalender pelatihan tatap muka & sesi kelompok.",
        icon: "CalendarDays",
        href: "/hc/pelatihan",
        hrefLabel: "Pelatihan",
        raci: { R: "Riva", A: "Adrian", C: "Outlet Manager", I: "Karyawan/Crew" },
      },
      {
        slug: "competency-matrix",
        label: "Competency Matrix",
        fungsi: "Pemetaan kompetensi karyawan terhadap standar jabatan.",
        icon: "Grid3x3",
        href: "/hc-mos/kinerja?tab=kompetensi",
        hrefLabel: "Competency Matrix",
        raci: { R: "Riva", A: "Adrian", C: "Dini", I: "Kepala Divisi" },
      },
      {
        slug: "modul-pelatihan",
        label: "Modul Pelatihan (LMS)",
        fungsi: "Modul pelatihan terstruktur dan terjadwal.",
        icon: "BookOpen",
        href: "/elearning",
        hrefLabel: "E-Learning",
        raci: { R: "Riva", A: "Adrian", C: "Kepala Divisi Terkait", I: "Karyawan/Crew" },
      },
      {
        slug: "fast-start-fast-track",
        label: "Fast Start & Fast Track",
        fungsi: "Program wajib crew outlet — Fast Start (dasar) lalu Fast Track (sesuai posisi/brand).",
        icon: "Rocket",
        href: "/hc-mos/fast-track",
        hrefLabel: "Fast Start & Fast Track",
        scopeOnly: "outlet",
        raci: { R: "Dini", A: "Riva", C: "Outlet Manager", I: "Crew Baru" },
      },
      {
        slug: "pre-post-test",
        label: "Pre Test & Post Test",
        fungsi: "Penilaian materi Fast Start & Fast Track — Pre Test, Role Play, Post Test; kelulusan minimal 65.",
        icon: "ClipboardCheck",
        scopeOnly: "outlet",
        href: "/hc-mos/fast-track",
        hrefLabel: "Pre Test & Post Test",
        raci: { R: "Dini", A: "Riva", C: "Supervisor/Outlet Manager", I: "Crew Baru" },
      },
      {
        slug: "self-learning",
        label: "Self-Learning (LMS)",
        fungsi: "Platform belajar mandiri beserta progres tiap karyawan.",
        icon: "MonitorPlay",
        href: "/elearning",
        hrefLabel: "E-Learning",
        raci: { R: "Riva", A: "Adrian", C: "Dini", I: "Seluruh Karyawan/Crew" },
      },
      sop("Learning & Development", "learning-development", { R: "Riva", A: "Adrian", C: "Uswatun", I: "Outlet Manager" }),
    ],
  },
  {
    slug: "performance-management",
    label: "Performance Management",
    icon: "Target",
    pic: "Riva",
    picRole: "Organization & People Development",
    ringkas: "Penilaian kinerja, kenaikan golongan, dan peninjauan appraisal.",
    submenus: [
      {
        slug: "penilaian-kinerja",
        label: "Penilaian Kinerja",
        fungsi: "Proses penilaian kinerja periodik untuk kedua scope.",
        icon: "Star",
        href: "/hc-mos/kinerja",
        hrefLabel: "Penilaian Kinerja",
        raci: { R: "Riva", A: "Adrian", C: "Atasan Langsung", I: "Karyawan Bersangkutan" },
      },
      {
        slug: "kenaikan-golongan",
        label: "Kenaikan Golongan",
        fungsi: "Assessment multi-penilai: Atasan 40%, HC 35%, Rekan Sejawat 25% — 6 parameter, skor layak minimal 85.",
        icon: "TrendingUp",
        href: "/assessment",
        hrefLabel: "Assessment Golongan",
        raci: { R: "Riva", A: "Adrian", C: "Atasan Langsung, Rekan Sejawat", I: "Uswatun" },
      },
      {
        slug: "appraisal-review",
        label: "Appraisal Review",
        fungsi: "Sesi peninjauan hasil appraisal bersama atasan.",
        icon: "ClipboardCheck",
        href: "/hc-mos/kinerja?tab=review",
        hrefLabel: "Appraisal Review",
        raci: { R: "Riva", A: "Adrian", C: "Kepala Divisi", I: "Karyawan Bersangkutan" },
      },
      sop("Performance Management", "performance-management", { R: "Riva", A: "Adrian", C: "Dini", I: "Seluruh Karyawan" }),
    ],
  },
  {
    slug: "talent-career",
    label: "Talent & Career Management",
    icon: "Award",
    pic: "Riva",
    picRole: "Organization & People Development",
    ringkas: "Jenjang karier dan perencanaan suksesi posisi kunci.",
    submenus: [
      {
        slug: "career-path",
        label: "Career Path",
        fungsi: "Jenjang karier untuk karyawan manajemen maupun outlet.",
        icon: "GitBranch",
        href: "/hc-mos/talent",
        hrefLabel: "Career Path",
        raci: { R: "Riva", A: "Adrian", C: "Kepala Divisi", I: "Karyawan Bersangkutan" },
      },
      {
        slug: "succession-plan",
        label: "Succession Plan",
        fungsi: "Perencanaan suksesi untuk posisi kunci.",
        icon: "UsersRound",
        href: "/hc-mos/talent?tab=suksesi",
        hrefLabel: "Succession Plan",
        raci: { R: "Riva", A: "Adrian", C: "Head of Operation, Dini", I: "Kepala Divisi" },
      },
      sop("Talent & Career Management", "talent-career", { R: "Riva", A: "Adrian", C: "Dini", I: "Kepala Divisi" }),
    ],
  },
  {
    slug: "compensation-benefit",
    label: "Compensation & Benefit",
    icon: "Wallet",
    pic: "Uswatun",
    picRole: "Compensation & Benefit Admin",
    ringkas: "Kehadiran, penggajian, BPJS, dan struktur kompensasi.",
    submenus: [
      {
        slug: "attendance-cuti",
        label: "Attendance & Cuti",
        fungsi: "Rekap kehadiran serta cuti dan izin.",
        icon: "CalendarCheck",
        href: "/hc-mos/kompensasi",
        hrefLabel: "Attendance & Cuti",
        raci: { R: "Uswatun", A: "Adrian", C: "Outlet Manager, Atasan Langsung", I: "Karyawan/Crew" },
      },
      {
        slug: "payroll",
        label: "Payroll",
        fungsi: "Pengelolaan penggajian bulanan.",
        icon: "Banknote",
        href: "/hc-mos/kompensasi?tab=payroll",
        hrefLabel: "Payroll",
        raci: { R: "Uswatun", A: "Adrian", C: "Finance & Accounting", I: "Karyawan/Crew" },
      },
      {
        slug: "bpjs-benefit",
        label: "BPJS & Benefit",
        fungsi: "Kepesertaan BPJS dan benefit lain per karyawan.",
        icon: "ShieldCheck",
        href: "/hc-mos/kompensasi?tab=bpjs",
        hrefLabel: "BPJS & Benefit",
        raci: { R: "Uswatun", A: "Adrian", C: "Finance & Accounting", I: "Karyawan Bersangkutan" },
      },
      {
        slug: "struktur-kompensasi",
        label: "Struktur Kompensasi",
        fungsi: "Kerangka gaji dan tunjangan berdasarkan golongan/jabatan.",
        icon: "ChartColumnBig",
        href: "/hc-mos/kompensasi?tab=golongan",
        hrefLabel: "Struktur Kompensasi",
        raci: { R: "Uswatun", A: "Adrian", C: "Finance & Accounting", I: "Kepala Divisi" },
      },
      sop("Compensation & Benefit", "compensation-benefit", { R: "Uswatun", A: "Adrian", C: "Finance & Accounting", I: "Seluruh Karyawan" }),
    ],
  },
  {
    slug: "employee-relations",
    label: "Employee & Industrial Relations",
    icon: "MessageSquare",
    pic: "Adrian",
    picRole: "Head of HC & Legal",
    ringkas: "Penanganan kasus, proses keluar karyawan, dan kontrak kerja.",
    submenus: [
      {
        slug: "case-management",
        label: "Case Management",
        fungsi: "Penanganan kasus hubungan industrial.",
        icon: "AlertCircle",
        href: "/hc-mos/relasi",
        hrefLabel: "Case Management",
        raci: { R: "Adrian", A: "Adrian", C: "Riva, Dini (sesuai kasus)", I: "Kepala Divisi, Outlet Manager" },
      },
      {
        slug: "offboarding",
        label: "Offboarding / Exit Process",
        fungsi: "Proses karyawan keluar — resign, PHK, maupun kontrak selesai.",
        icon: "LogOut",
        href: "/hc-mos/relasi?tab=keluar",
        hrefLabel: "Offboarding",
        raci: { R: "Uswatun", A: "Adrian", C: "Kepala Divisi/Outlet Manager Terkait", I: "Finance (Payroll Final)" },
      },
      {
        slug: "kontrak-tracker",
        label: "Kontrak Tracker (PKWT/PKWTT)",
        fungsi: "Kontrak kerja seluruh outlet: masa berlaku, prioritas perpanjangan, dan Update Bulanan Supervisor.",
        icon: "FileSignature",
        href: "/hc-mos/kontrak",
        raci: { R: "Uswatun", A: "Adrian", C: "—", I: "Karyawan Bersangkutan" },
      },
      sop("Employee & Industrial Relations", "employee-relations", { R: "Adrian", A: "Adrian", C: "Uswatun", I: "Seluruh Karyawan" }),
    ],
  },
  {
    slug: "legal-compliance",
    label: "Legal & Compliance",
    icon: "Scale",
    pic: "Adrian",
    picRole: "Head of HC & Legal",
    ringkas: "Dokumen legalitas, PKS kemitraan, dan kebijakan internal.",
    submenus: [
      {
        slug: "document-compliance",
        label: "Document & Compliance",
        fungsi: "Dokumen legalitas dan kepatuhan, termasuk PKS Kemitraan (sewa lokasi, kemitraan supplier/brand).",
        icon: "ShieldCheck",
        href: "/hc-mos/dokumen?jenis=compliance",
        hrefLabel: "Dokumen & Kepatuhan",
        raci: { R: "Adrian", A: "Adrian", C: "Riva", I: "Kepala Divisi" },
      },
      {
        slug: "kebijakan",
        label: "Kebijakan (Policy)",
        fungsi: "Kumpulan kebijakan internal perusahaan.",
        icon: "Book",
        href: "/hc-mos/dokumen?jenis=kebijakan",
        hrefLabel: "Kebijakan",
        raci: { R: "Adrian", A: "Adrian", C: "Riva, Uswatun", I: "Seluruh Karyawan" },
      },
      sop("Legal & Compliance", "legal-compliance", { R: "Adrian", A: "Adrian", C: "—", I: "Seluruh Karyawan" }),
    ],
  },
  {
    slug: "hr-analytics",
    label: "HR Analytics & CI",
    icon: "ChartColumnBig",
    pic: "Adrian",
    picRole: "Head of HC & Legal",
    ringkas: "Pemantauan metrik HR dan pelaporan berkelanjutan.",
    submenus: [
      {
        slug: "dashboard-monitoring",
        label: "Dashboard Monitoring",
        fungsi: "Metrik HR terpantau: headcount, rekrutmen, turnover, kontrak, dokumen, dan pelatihan.",
        icon: "LayoutDashboard",
        href: "/hc-mos/monitoring",
        hrefLabel: "Dashboard Monitoring",
        raci: { R: "Adrian", A: "Adrian", C: "Dini, Riva, Uswatun", I: "Head of Operation" },
      },
      {
        slug: "report-kpi",
        label: "Report & KPI",
        fungsi: "Indikator KPI Human Capital beserta tren dan tindak lanjutnya.",
        icon: "PieChart",
        href: "/hc-mos/kpi",
        hrefLabel: "Report & KPI",
        raci: { R: "Adrian", A: "Adrian", C: "Dini, Riva, Uswatun", I: "Owner/Manajemen" },
      },
      sop("HR Analytics & CI", "hr-analytics", { R: "Adrian", A: "Adrian", C: "Dini, Riva, Uswatun", I: "—" }),
    ],
  },
];

/** Pilar menurut slug — dipakai halaman `/hc-mos/[pilar]`. */
export function pillarBySlug(slug: string): HcPillar | undefined {
  return HC_PILLARS.find((p) => p.slug === slug);
}

/** Seluruh sub-menu, sudah membawa pilarnya — dipakai matriks RACI & pencarian. */
export function allSubmenus(): { pillar: HcPillar; sub: HcSubmenu }[] {
  return HC_PILLARS.flatMap((pillar) => pillar.submenus.map((sub) => ({ pillar, sub })));
}

/**
 * Sub-menu yang relevan untuk sebuah scope.
 *
 * Sebagian program memang hanya untuk crew outlet (Fast Start & Fast Track,
 * Pre/Post Test). Menampilkannya pada scope Manajemen membuat daftar tampak
 * lebih panjang daripada yang benar-benar berlaku.
 */
export function submenusForScope(pillar: HcPillar, scope: HcScope): HcSubmenu[] {
  return pillar.submenus.filter((s) => !s.scopeOnly || s.scopeOnly === scope);
}
