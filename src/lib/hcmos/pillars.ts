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
export type RaciRole = "R" | "A" | "C" | "I";

export const RACI_LABEL: Record<RaciRole, string> = {
  R: "Responsible — mengerjakan",
  A: "Accountable — bertanggung jawab akhir",
  C: "Consulted — dimintai pendapat",
  I: "Informed — diberi tahu",
};

/** Pemegang peran yang muncul di matriks. */
export const RACI_ACTORS = ["Head HC", "PIC Pilar", "Kepala Divisi", "Supervisor Outlet", "Karyawan"] as const;
export type RaciActor = (typeof RACI_ACTORS)[number];

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
  /** Peran tiap aktor untuk aktivitas ini (matriks RACI Bab 8). */
  raci: Partial<Record<RaciActor, RaciRole>>;
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
const sop = (pilar: string): HcSubmenu => ({
  slug: "sop",
  label: "SOP",
  fungsi: `Prosedur standar operasional pilar ${pilar}.`,
  icon: "ScrollText",
  raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C", "Karyawan": "I" },
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
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C", "Karyawan": "I" },
      },
      {
        slug: "database-karyawan",
        label: "Database Karyawan",
        fungsi: "Data karyawan Manajemen (Office & Warehouse) dan rekap seluruh outlet.",
        icon: "Database",
        href: "/hc-mos/karyawan",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "I", "Supervisor Outlet": "C" },
      },
      {
        slug: "document-queue",
        label: "Document Queue",
        fungsi: "Antrian dokumen masuk dari cabang dan divisi.",
        icon: "FileText",
        href: "/hc/antrian",
        hrefLabel: "Antrian Dokumen",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Supervisor Outlet": "C", "Karyawan": "I" },
      },
      {
        slug: "culture-value",
        label: "Culture & Value",
        fungsi: "Nilai-nilai inti (core values) GWG Group.",
        icon: "HeartHandshake",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C", "Karyawan": "I" },
      },
      sop("Organization Development"),
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
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C", "Supervisor Outlet": "C" },
      },
      {
        slug: "database-kandidat",
        label: "Database Kandidat",
        fungsi: "Basis data pelamar untuk posisi manajemen maupun outlet.",
        icon: "Users",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "I" },
      },
      {
        slug: "jadwal-interview",
        label: "Jadwal Interview",
        fungsi: "Kalender jadwal wawancara kandidat.",
        icon: "Calendar",
        raci: { "Head HC": "I", "PIC Pilar": "R", "Kepala Divisi": "C" },
      },
      {
        slug: "onboarding",
        label: "Onboarding",
        fungsi: "Program orientasi karyawan baru — materi berbeda per scope.",
        icon: "LogIn",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Supervisor Outlet": "R", "Karyawan": "I" },
      },
      sop("Recruitment & Selection"),
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
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "I" },
      },
      {
        slug: "competency-matrix",
        label: "Competency Matrix",
        fungsi: "Pemetaan kompetensi karyawan terhadap standar jabatan.",
        icon: "Grid3x3",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C" },
      },
      {
        slug: "modul-pelatihan",
        label: "Modul Pelatihan (LMS)",
        fungsi: "Modul pelatihan terstruktur dan terjadwal.",
        icon: "BookOpen",
        href: "/elearning",
        hrefLabel: "E-Learning",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Karyawan": "I" },
      },
      {
        slug: "fast-start-fast-track",
        label: "Fast Start & Fast Track",
        fungsi: "Program wajib crew outlet — Fast Start (dasar) lalu Fast Track (sesuai posisi/brand).",
        icon: "Rocket",
        scopeOnly: "outlet",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Supervisor Outlet": "R", "Karyawan": "I" },
      },
      {
        slug: "pre-post-test",
        label: "Pre Test & Post Test",
        fungsi: "Penilaian materi Fast Start & Fast Track — Pre Test, Role Play, Post Test; kelulusan minimal 65.",
        icon: "ClipboardCheck",
        scopeOnly: "outlet",
        raci: { "Head HC": "I", "PIC Pilar": "R", "Supervisor Outlet": "R", "Karyawan": "I" },
      },
      {
        slug: "self-learning",
        label: "Self-Learning (LMS)",
        fungsi: "Platform belajar mandiri beserta progres tiap karyawan.",
        icon: "MonitorPlay",
        href: "/elearning",
        hrefLabel: "E-Learning",
        raci: { "Head HC": "I", "PIC Pilar": "R", "Karyawan": "R" },
      },
      sop("Learning & Development"),
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
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "R", "Karyawan": "I" },
      },
      {
        slug: "kenaikan-golongan",
        label: "Kenaikan Golongan",
        fungsi: "Assessment multi-penilai: Atasan 40%, HC 35%, Rekan Sejawat 25% — 6 parameter, skor layak minimal 85.",
        icon: "TrendingUp",
        href: "/assessment",
        hrefLabel: "Assessment Golongan",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "R", "Karyawan": "I" },
      },
      {
        slug: "appraisal-review",
        label: "Appraisal Review",
        fungsi: "Sesi peninjauan hasil appraisal bersama atasan.",
        icon: "ClipboardCheck",
        raci: { "Head HC": "A", "PIC Pilar": "C", "Kepala Divisi": "R", "Karyawan": "C" },
      },
      sop("Performance Management"),
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
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C", "Karyawan": "I" },
      },
      {
        slug: "succession-plan",
        label: "Succession Plan",
        fungsi: "Perencanaan suksesi untuk posisi kunci.",
        icon: "UsersRound",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C" },
      },
      sop("Talent & Career Management"),
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
        raci: { "Head HC": "A", "PIC Pilar": "R", "Supervisor Outlet": "R", "Karyawan": "I" },
      },
      {
        slug: "payroll",
        label: "Payroll",
        fungsi: "Pengelolaan penggajian bulanan.",
        icon: "Banknote",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "I" },
      },
      {
        slug: "bpjs-benefit",
        label: "BPJS & Benefit",
        fungsi: "Kepesertaan BPJS dan benefit lain per karyawan.",
        icon: "ShieldCheck",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Karyawan": "I" },
      },
      {
        slug: "struktur-kompensasi",
        label: "Struktur Kompensasi",
        fungsi: "Kerangka gaji dan tunjangan berdasarkan golongan/jabatan.",
        icon: "ChartColumnBig",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "C" },
      },
      sop("Compensation & Benefit"),
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
        raci: { "Head HC": "R", "PIC Pilar": "C", "Kepala Divisi": "C", "Supervisor Outlet": "I" },
      },
      {
        slug: "offboarding",
        label: "Offboarding / Exit Process",
        fungsi: "Proses karyawan keluar — resign, PHK, maupun kontrak selesai.",
        icon: "LogOut",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Supervisor Outlet": "C", "Karyawan": "I" },
      },
      {
        slug: "kontrak-tracker",
        label: "Kontrak Tracker (PKWT/PKWTT)",
        fungsi: "Kontrak kerja seluruh outlet: masa berlaku, prioritas perpanjangan, dan Update Bulanan Supervisor.",
        icon: "FileSignature",
        href: "/hc-mos/kontrak",
        raci: { "Head HC": "A", "PIC Pilar": "C", "Supervisor Outlet": "R", "Karyawan": "I" },
      },
      sop("Employee & Industrial Relations"),
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
        raci: { "Head HC": "R", "PIC Pilar": "C", "Kepala Divisi": "I" },
      },
      {
        slug: "kebijakan",
        label: "Kebijakan (Policy)",
        fungsi: "Kumpulan kebijakan internal perusahaan.",
        icon: "Book",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Karyawan": "I" },
      },
      sop("Legal & Compliance"),
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
        href: "/hc-mos",
        hrefLabel: "Dashboard HC-MOS",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "I" },
      },
      {
        slug: "report-kpi",
        label: "Report & KPI",
        fungsi: "Indikator KPI Human Capital beserta tren dan tindak lanjutnya.",
        icon: "PieChart",
        raci: { "Head HC": "A", "PIC Pilar": "R", "Kepala Divisi": "I" },
      },
      sop("HR Analytics & CI"),
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
