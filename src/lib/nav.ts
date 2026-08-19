import type { Role } from "./types";

/** Every navigable menu in the app. */
export type MenuKey =
  | "pesan"
  | "dashboard"
  | "analytics"
  | "work"
  | "events"
  | "hospitality"
  | "hygiene"
  | "complaints"
  | "outlets"
  | "reports"
  | "op_beban"
  | "op_pembelian"
  | "op_settings"
  | "op_fraud"
  | "op_seasonal"
  | "op_analysis"
  | "op_pnl"
  | "sys_review"
  | "it_review"
  | "hc_submit"
  | "hc_review"
  | "sys_submit"
  | "it_submit"
  | "elearning"
  | "elearning_admin"
  | "hcmos"
  | "hcmos_raci"
  | "hc_struktur"
  | "hc_karyawan"
  | "hc_culture"
  | "hc_sop"
  | "hc_rekrutmen"
  | "hc_kompetensi"
  | "hc_modul"
  | "hc_selflearning"
  | "hc_kinerja"
  | "hc_intervensi"
  | "hc_career"
  | "hc_kompensasi"
  | "hc_relasi"
  | "hc_compliance"
  | "hc_kebijakan"
  | "hc_monitoring"
  | "hc_kpi"
  | "hc_kontrak"
  | "hc_request"
  | "hc_reqreview"
  | "hc_training"
  | "fin_training"
  | "creative_design"
  | "mc_events"
  | "assessment"
  | "hpp_dash"
  | "hpp"
  | "hpp_db"
  | "hpp_bahan"
  | "hpp_price"
  | "hpp_comp"
  | "sc_hpp"
  | "sc_rekap"
  | "users"
  | "audit";

/** Division a role belongs to — used as the sidebar group header. */
export type Division =
  | "Operation"
  | "Supervisor"
  | "Product Development & Quality"
  | "Human Capital"
  | "Administrator"
  | "Finance"
  | "Creative"
  | "Project Manager"
  | "Auditor"
  | "Executive Assistant"
  | "Business Development"
  | "Supply Chain"
  | "Production"
  | "Marketing Communication";

export interface NavItem {
  key: MenuKey;
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Sidebar group — the user's division. Attached when building per-user nav. */
  section: string;
  /** Lucide icon name for the section header (built-in or admin-defined). */
  sectionIcon?: string;
  /** Sub-group inside the division ("Talent Acquisition"), if the menu is in one. */
  group?: string;
  /** Grup ini ditampilkan tanpa kepala lipat — barisnya berdiri sendiri. */
  groupFlat?: boolean;
  /** Lucide icon name for that sub-group's header. */
  groupIcon?: string;
  /** Reachable by route but never listed in the sidebar — it lives inside
   *  another page (the Pengajuan hub links to these). */
  hidden?: boolean;
}

/** Static definition of every menu (order = sidebar order within a group). */
export const NAV_MENUS: Omit<NavItem, "section" | "group" | "groupIcon">[] = [
  // Pintu masuk Pesan ada di topbar (ikon + jumlah belum dibaca), jadi ia
  // tidak perlu memakan satu baris di setiap divisi sidebar.
  { key: "pesan", label: "Pesan", href: "/pesan", icon: "MessagesSquare", hidden: true },
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "analytics", label: "Analytics", href: "/analytics", icon: "TrendingUp" },
  { key: "work", label: "Work Tracker", href: "/work-tracker", icon: "ListChecks" },
  { key: "events", label: "Event Tracker", href: "/events", icon: "CalendarRange" },
  { key: "hospitality", label: "Hospitality", href: "/hospitality", icon: "ConciergeBell" },
  { key: "hygiene", label: "Hygiene", href: "/hygiene", icon: "SprayCan" },
  { key: "complaints", label: "Complaints", href: "/complaints", icon: "MessageSquareWarning" },
  { key: "outlets", label: "Outlets", href: "/outlets", icon: "Store" },
  { key: "op_beban", label: "Beban Operasional", href: "/operation/beban", icon: "Wallet" },
  { key: "op_pembelian", label: "Pembelian", href: "/operation/pembelian", icon: "ShoppingCart" },
  { key: "op_settings", label: "Pengaturan Threshold", href: "/operation/settings", icon: "Settings2" },
  { key: "op_fraud", label: "Analisis Fraud", href: "/operation/fraud", icon: "ShieldAlert" },
  { key: "op_seasonal", label: "Musiman", href: "/operation/musiman", icon: "Waves" },
  { key: "op_analysis", label: "Data Analysis", href: "/operation/analysis", icon: "ChartColumnBig" },
  { key: "op_pnl", label: "Laba Rugi", href: "/operation/laba-rugi", icon: "Banknote" },
  { key: "sys_review", label: "Antrian POS", href: "/system/antrian", icon: "Headset" },
  { key: "it_review", label: "Antrian IT", href: "/it-helpdesk/antrian", icon: "CodeXml" },
  // Kedua "pengajuan" ini kini menjadi kategori DI DALAM halaman Pengajuan —
  // tetap punya rute sendiri, tapi tidak lagi muncul terpisah di sidebar.
  { key: "hc_submit", label: "Pengajuan Dokumen", href: "/hc/pengajuan", icon: "FileUp", hidden: true },
  { key: "hc_review", label: "Antrian Dokumen", href: "/hc/antrian", icon: "FolderInput" },
  { key: "sys_submit", label: "Pengajuan System POS", href: "/system/pengajuan", icon: "MonitorCog", hidden: true },
  { key: "it_submit", label: "Pengajuan IT Help Desk", href: "/it-helpdesk/pengajuan", icon: "CodeXml", hidden: true },
  { key: "elearning", label: "E-Learning", href: "/elearning", icon: "GraduationCap" },
  { key: "elearning_admin", label: "Kelola E-Learning", href: "/elearning/kelola", icon: "LibraryBig" },
  { key: "hcmos", label: "Dashboard HC-MOS", href: "/hc-mos", icon: "LayoutDashboard" },
  { key: "hcmos_raci", label: "Matriks RACI", href: "/hc-mos/raci", icon: "Table2" },
  { key: "hc_struktur", label: "Struktur Organisasi", href: "/hc-mos/struktur", icon: "Building2" },
  { key: "hc_karyawan", label: "Database Karyawan", href: "/hc-mos/karyawan", icon: "Database" },
  { key: "hc_culture", label: "Culture & Value", href: "/hc-mos/dokumen?jenis=culture", icon: "HeartHandshake" },
  // Satu izin untuk seluruh SOP; tautannya berbeda per pilar lewat baris
  // berbentuk panjang di `DIVISION_GROUPS`.
  { key: "hc_sop", label: "SOP", href: "/hc-mos/dokumen?jenis=sop", icon: "ScrollText", hidden: true },
  { key: "hc_rekrutmen", label: "Rekrutmen & Seleksi", href: "/hc-mos/rekrutmen", icon: "Users" },
  { key: "hc_kompetensi", label: "Competency Matrix", href: "/hc-mos/kinerja?tab=kompetensi", icon: "Grid3x3" },
  { key: "hc_modul", label: "Modul Pelatihan (LMS)", href: "/hc-mos/modul", icon: "BookOpen" },
  { key: "hc_selflearning", label: "Self-Learning (LMS)", href: "/elearning", icon: "MonitorPlay" },
  { key: "hc_kinerja", label: "Penilaian Kinerja", href: "/hc-mos/kinerja", icon: "Star" },
  { key: "hc_intervensi", label: "Request Intervensi", href: "/hc-mos/kinerja?tab=intervensi", icon: "LifeBuoy" },
  { key: "hc_career", label: "Career Path", href: "/hc-mos/talent", icon: "GitBranch" },
  { key: "hc_kompensasi", label: "Attendance & Cuti", href: "/hc-mos/kompensasi", icon: "CalendarCheck" },
  { key: "hc_relasi", label: "Case Management", href: "/hc-mos/relasi", icon: "AlertCircle" },
  { key: "hc_compliance", label: "Document & Compliance", href: "/hc-mos/dokumen?jenis=compliance", icon: "ShieldCheck" },
  { key: "hc_kebijakan", label: "Kebijakan (Policy)", href: "/hc-mos/dokumen?jenis=kebijakan", icon: "Book" },
  { key: "hc_monitoring", label: "Dashboard Monitoring", href: "/hc-mos/monitoring", icon: "Gauge" },
  { key: "hc_kpi", label: "Report & KPI", href: "/hc-mos/kpi", icon: "PieChart" },
  { key: "hc_kontrak", label: "Kontrak Tracker", href: "/hc-mos/kontrak", icon: "FileSignature" },
  { key: "hc_request", label: "Pengajuan", href: "/pengajuan", icon: "Send" },
  { key: "hc_reqreview", label: "Permintaan Karyawan", href: "/hc/permintaan", icon: "ClipboardCheck" },
  { key: "hc_training", label: "Pelatihan", href: "/hc/pelatihan", icon: "GraduationCap" },
  { key: "fin_training", label: "ACC Dana Pelatihan", href: "/finance/pelatihan", icon: "Wallet" },
  { key: "creative_design", label: "Antrian Design", href: "/creative/design", icon: "Palette" },
  { key: "mc_events", label: "Event Tracker", href: "/marcomm/events", icon: "Megaphone" },
  { key: "reports", label: "Reports", href: "/reports", icon: "FileText" },
  { key: "assessment", label: "Assessment Golongan", href: "/assessment", icon: "Award" },
  { key: "hpp_dash", label: "Dashboard R&D", href: "/rnd/dashboard", icon: "ChartSpline" },
  { key: "hpp", label: "Kalkulator HPP", href: "/rnd/hpp", icon: "Calculator" },
  { key: "hpp_db", label: "Database HPP", href: "/rnd/hpp/rekap", icon: "Table2" },
  { key: "hpp_bahan", label: "Master Bahan Baku", href: "/rnd/hpp/bahan", icon: "Package" },
  { key: "hpp_price", label: "Referensi Harga & HPP", href: "/rnd/hpp/price", icon: "Scale" },
  { key: "hpp_comp", label: "Analytics Harga Kompetitor", href: "/rnd/hpp/kompetitor", icon: "Store" },
  { key: "sc_hpp", label: "Kalkulator HPP Produksi", href: "/supply-chain/hpp", icon: "Calculator" },
  { key: "sc_rekap", label: "Database Produksi", href: "/supply-chain/rekap", icon: "Table2" },
  { key: "users", label: "User Management", href: "/admin/users", icon: "Users" },
  { key: "audit", label: "Audit Logs", href: "/admin/audit", icon: "ScrollText" },
];

/** Menu definition by key — lookup used when assembling the sidebar. */
const MENU_BY_KEY = Object.fromEntries(NAV_MENUS.map((m) => [m.key, m])) as Record<
  MenuKey,
  (typeof NAV_MENUS)[number] | undefined
>;

/** Icon (lucide name) shown next to each division's collapsible header. */
export const DIVISION_ICON: Record<Division, string> = {
  Operation: "Briefcase",
  Supervisor: "ShieldCheck",
  "Product Development & Quality": "FlaskConical",
  "Human Capital": "UserRound", // people, not a legal scale
  Administrator: "Settings2",
  Finance: "Wallet",
  Creative: "Palette",
  "Project Manager": "FolderKanban",
  Auditor: "SearchCheck", // distinct from Supervisor's shield
  "Executive Assistant": "NotebookPen",
  "Business Development": "Handshake",
  "Supply Chain": "Truck",
  Production: "ChefHat",
  "Marketing Communication": "Megaphone",
};

/** Which division each role sits in (drives the sidebar group header). */
export const ROLE_DIVISION: Record<Role, Division> = {
  super_admin: "Administrator",
  head_operation: "Operation",
  area_coordinator: "Operation",
  data_operation: "Operation",
  pos_operation: "Operation",
  admin_operation: "Operation",
  supervisor: "Supervisor",
  head_bar_rnd: "Product Development & Quality",
  bar_rnd: "Product Development & Quality",
  kitchen_rnd: "Product Development & Quality",
  coordinator_rnd: "Product Development & Quality",
  legal: "Human Capital",
  assessor: "Human Capital",
  // Generic member: a placeholder home division; real access comes from their
  // per-user `department` (ROLE_MENUS is empty, so the home division shows nothing).
  member: "Human Capital",
};

const OPERATION_FULL: MenuKey[] = [
  "dashboard",
  "analytics",
  "work",
  "events",
  "hospitality",
  "hygiene",
  "complaints",
  "outlets",
  "op_beban",
  "op_pembelian",
  "op_settings",
  "op_fraud",
  "op_seasonal",
  "op_analysis",
  "op_pnl",
  "reports",
];

/** The exact menus each role can see (single source of truth for the sidebar).
 *  Assessment (kenaikan golongan) is a Head-Office feature: every role EXCEPT
 *  supervisor (field staff at the branches) gets it. */
export const ROLE_MENUS: Record<Role, MenuKey[]> = {
  super_admin: NAV_MENUS.map((m) => m.key), // everything, incl. admin menus
  head_operation: [...OPERATION_FULL, "elearning", "elearning_admin", "assessment"], // manages E-Learning + monitors every branch
  area_coordinator: [...OPERATION_FULL, "elearning", "assessment"], // learner (E-Learning), menus scoped to their area
  data_operation: ["work", "op_analysis", "assessment"],
  pos_operation: ["work", "op_analysis", "assessment"],
  admin_operation: ["work", "complaints", "op_analysis", "assessment"],
  supervisor: ["events", "hospitality", "hygiene", "complaints", "hc_kontrak", "hc_submit", "sys_submit"], // field SPV — event/promo proposals + visits + HC docs + system requests
  head_bar_rnd: ["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "assessment"],
  bar_rnd: ["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "assessment"],
  kitchen_rnd: ["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "assessment"],
  coordinator_rnd: ["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "assessment"],
  legal: ["work", "hcmos", "hcmos_raci", "hc_struktur", "hc_karyawan", "hc_culture", "hc_sop", "hc_rekrutmen", "hc_kompetensi", "hc_modul", "hc_selflearning", "hc_kinerja", "hc_intervensi", "hc_career", "hc_kompensasi", "hc_relasi", "hc_compliance", "hc_kebijakan", "hc_monitoring", "hc_kpi", "hc_kontrak", "hc_review", "hc_reqreview", "hc_training", "assessment", "elearning"], // HRD — seluruh kerangka HC-MOS
  assessor: ["assessment"], // division Head / evaluator — assessment only
  member: ["assessment"], // HO staff — assessment; other access via `department`
};

/** Menus every department gets automatically — including divisions an admin
 *  adds later, and roles that were never wired up for them. "Pengajuan" is
 *  company-wide by design: any team must be able to request headcount or a
 *  training programme without an admin granting it first.
 *
 *  `it_submit` (IT Help Desk) ada di sini karena alasan yang sama, dan lebih
 *  keras lagi: aplikasi yang error bisa menimpa SIAPA PUN di kantor. Selama ini
 *  Finance, Creative, dan Human Capital melaporkannya lewat WhatsApp — di luar
 *  sistem, tanpa nomor tiket, tidak terhitung di mana-mana. Yang tidak tercatat
 *  tidak bisa diperbaiki.
 *
 *  `sys_submit` (Pengajuan System POS) ikut di sini karena alasan yang sama.
 *  Sempat hanya milik supervisor, dan akibatnya nyata: Marketing Communication
 *  yang mau menambah menu di ESB tidak melihat kategorinya sama sekali, lalu
 *  memilih IT Help Desk — meja yang salah, ditangani orang yang berbeda.
 *
 *  Keduanya TETAP dua meja terpisah. Yang dibuka di sini hanya PINTU MASUKNYA;
 *  antreannya tetap milik penanganya masing-masing. */
export const UNIVERSAL_MENUS: MenuKey[] = ["hc_request", "sys_submit", "it_submit", "pesan"];

/** Divisions that are NOT a department doing day-to-day work — they don't get
 *  the company-wide menus (Administrator is app configuration, not a team). */
const NO_UNIVERSAL: string[] = ["Administrator"];

/** A menu list plus the company-wide menus, without duplicates. */
const withUniversal = (menus: MenuKey[], division: string): MenuKey[] =>
  NO_UNIVERSAL.includes(division) ? [...menus] : [...new Set([...menus, ...UNIVERSAL_MENUS])];

/* ───────────────────────── sub-grup di dalam divisi ─────────────────────────
 * Satu departemen berisi beberapa bidang kerja, dan tiap bidang punya menu
 * wajibnya sendiri (mis. Human Capital → Talent Acquisition → Permintaan
 * Karyawan + Pelatihan). Menu yang tidak masuk bidang mana pun dianggap umum
 * dan diletakkan di bawah, urut abjad.                                       */

/**
 * Satu baris di dalam sebuah bidang kerja.
 *
 * Biasanya cukup kunci menunya, dan judul/rute/ikonnya diambil dari
 * `NAV_MENUS`. Bentuk panjangnya dipakai saat BEBERAPA BARIS berbagi satu izin
 * tetapi menuju tempat yang berbeda — misalnya "SOP", yang muncul di kesembilan
 * pilar Human Capital dengan tautan berbeda per pilar, atau tab-tab di dalam
 * satu halaman Kompensasi.
 *
 * Membuat kunci izin tersendiri untuk tiap baris seperti itu terlihat lebih
 * rapi, tapi keliru: yang dibatasi memang satu hal ("boleh membuka SOP"), dan
 * memecahnya jadi sembilan izin berarti sembilan kotak centang di User
 * Management yang harus selalu dicentang bersamaan.
 */
export type NavGroupEntry = MenuKey | { key: MenuKey; label: string; href: string; icon: string };

/** Kunci menu dari sebuah baris bidang kerja, apa pun bentuknya. */
export const kunciEntri = (e: NavGroupEntry): MenuKey => (typeof e === "string" ? e : e.key);

export interface NavGroupDef {
  name: string;
  icon: string; // lucide icon name
  menus: NavGroupEntry[];
  /**
   * Nomor urut bidang kerja. Diisi hanya bila urutannya PUNYA ARTI.
   *
   * Bawaannya urut abjad, dan itu tepat untuk kebanyakan divisi: tanpa urutan
   * yang bermakna, abjad adalah satu-satunya susunan yang bisa ditebak. Tapi
   * kerangka HC-MOS punya alur yang disepakati — orang direkrut sebelum
   * dilatih, dilatih sebelum dinilai — dan mengurutkannya secara abjad
   * ("Compensation" duluan, "Recruitment" belakangan) memutus alur itu.
   *
   * Bidang kerja yang punya nomor selalu di atas yang tidak, dan isinya ikut
   * mengikuti urutan yang ditulis, bukan abjad.
   */
  urutan?: number;
  /**
   * Isinya ditampilkan sebagai baris lepas, tanpa kepala grup yang bisa dilipat.
   *
   * Dipakai untuk baris pembuka sebuah divisi — Matriks RACI dan Dashboard
   * HC-MOS — yang memang tujuan pertama orang saat membuka divisinya. Menaruh
   * keduanya di balik satu lipatan berarti dua klik untuk sesuatu yang
   * seharusnya langsung terlihat, dan kepalanya sendiri ("HC-MOS") tidak
   * menerangkan apa pun yang belum diterangkan nama divisinya.
   *
   * Bukan sekadar "menu tanpa grup": menu tanpa grup selalu jatuh ke bawah,
   * sedangkan baris pembuka justru harus paling atas.
   */
  datar?: boolean;
}

/**
 * Baris "SOP" milik satu pilar.
 *
 * Muncul di kesembilan pilar dengan judul yang sama tapi tautan berbeda, dan
 * semuanya memakai satu izin (`hc_sop`) — yang dibatasi memang "boleh membuka
 * SOP", bukan sembilan hal yang berbeda.
 */
const sopPilar = (slugPilar: string): NavGroupEntry => ({
  key: "hc_sop",
  label: "SOP",
  href: `/hc-mos/dokumen?jenis=sop&pilar=${slugPilar}`,
  icon: "ScrollText",
});

/** Pengelompokan bawaan per divisi. Bisa ditimpa admin lewat User Management. */
export const DIVISION_GROUPS: Partial<Record<Division, NavGroupDef[]>> = {
  Operation: [
    { name: "Monitoring Outlet", icon: "Store", menus: ["outlets", "hospitality", "hygiene", "complaints"] },
    { name: "Keuangan Operasional", icon: "Wallet", menus: ["op_beban", "op_pembelian", "op_pnl", "op_settings"] },
    { name: "Analisis & Laporan", icon: "ChartColumnBig", menus: ["analytics", "op_analysis", "op_fraud", "op_seasonal", "reports"] },
    { name: "Pembelajaran", icon: "GraduationCap", menus: ["elearning", "elearning_admin"] },
    { name: "System Support", icon: "Headset", menus: ["sys_review", "it_review"] },
  ],
  Supervisor: [
    { name: "Operasional Outlet", icon: "Store", menus: ["hospitality", "hygiene", "complaints"] },
    { name: "Kepegawaian", icon: "UserRound", menus: ["hc_kontrak"] },
  ],
  "Product Development & Quality": [
    { name: "Kalkulasi HPP", icon: "Calculator", menus: ["hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp"] },
  ],
  "Supply Chain": [
    { name: "Biaya Produksi", icon: "Calculator", menus: ["sc_hpp", "sc_rekap"] },
  ],
  /**
   * Human Capital mengikuti kerangka HC-MOS: sembilan pilar, urut sesuai alur
   * kerjanya (orang direkrut → dilatih → dinilai → dikembangkan), lalu menu
   * administrasi di bawahnya.
   *
   * Susunannya sengaja SAMA PERSIS dengan `HC_PILLARS` di
   * `src/lib/hcmos/pillars.ts`, yang jadi rujukan halaman pilar, matriks RACI,
   * dan dasbor. Kalau salah satu berubah tanpa yang lain, sidebar dan isi
   * halamannya menampilkan kerangka yang berbeda — dan yang membacanya tidak
   * punya cara tahu mana yang benar. Uji `hcmos/kerangka.test.ts` menjaga
   * keduanya tetap sama.
   */
  "Human Capital": [
    { name: "HC-MOS", icon: "Network", urutan: 0, datar: true, menus: ["hcmos_raci", "hcmos"] },
    {
      name: "Organization Development",
      icon: "Network",
      urutan: 1,
      menus: [
        "hc_struktur",
        "hc_karyawan",
        // Antrian dokumen memang milik HC-MOS, bukan menu HC yang berdiri
        // sendiri — hasil Meeting Fitur HRD.
        "hc_review",
        "hc_culture",
        sopPilar("organization-development"),
      ],
    },
    {
      name: "Recruitment & Selection",
      icon: "UserPlus",
      urutan: 2,
      menus: ["hc_reqreview", "hc_rekrutmen", sopPilar("recruitment-selection")],
    },
    {
      name: "Learning & Development",
      icon: "GraduationCap",
      urutan: 3,
      menus: ["hc_training", "hc_kompetensi", "hc_modul", "hc_selflearning", sopPilar("learning-development")],
    },
    {
      name: "Performance Management",
      icon: "Target",
      urutan: 4,
      menus: ["hc_kinerja", "assessment", "hc_intervensi", sopPilar("performance-management")],
    },
    {
      name: "Talent & Career Management",
      icon: "Award",
      urutan: 5,
      menus: [
        "hc_career",
        { key: "hc_career", label: "Succession Plan", href: "/hc-mos/talent?tab=suksesi", icon: "UsersRound" },
        sopPilar("talent-career"),
      ],
    },
    {
      name: "Compensation & Benefit",
      icon: "Wallet",
      urutan: 6,
      menus: [
        "hc_kompensasi",
        { key: "hc_kompensasi", label: "Payroll", href: "/hc-mos/kompensasi?tab=payroll", icon: "Banknote" },
        { key: "hc_kompensasi", label: "BPJS & Benefit", href: "/hc-mos/kompensasi?tab=bpjs", icon: "ShieldCheck" },
        { key: "hc_kompensasi", label: "Struktur Kompensasi", href: "/hc-mos/kompensasi?tab=golongan", icon: "ChartColumnBig" },
        sopPilar("compensation-benefit"),
      ],
    },
    {
      name: "Employee & Industrial Relations",
      icon: "MessageSquare",
      urutan: 7,
      menus: [
        "hc_relasi",
        { key: "hc_relasi", label: "Offboarding / Exit Process", href: "/hc-mos/relasi?tab=keluar", icon: "LogOut" },
        sopPilar("employee-relations"),
      ],
    },
    {
      name: "Legal & Compliance",
      icon: "Scale",
      urutan: 8,
      menus: ["hc_compliance", "hc_kebijakan", sopPilar("legal-compliance")],
    },
    {
      name: "HR Analytics & CI",
      icon: "ChartColumnBig",
      urutan: 9,
      menus: ["hc_monitoring", "hc_kpi", sopPilar("hr-analytics")],
    },
    {
      name: "Menu Administrasi",
      icon: "FolderCog",
      urutan: 10,
      menus: ["hc_kontrak", "hc_request", "work"],
    },
  ],
  Creative: [
    { name: "Permintaan Masuk", icon: "Palette", menus: ["creative_design"] },
  ],
  Finance: [{ name: "Persetujuan Dana", icon: "Wallet", menus: ["fin_training"] }],
  "Marketing Communication": [
    { name: "Event & Promo", icon: "Megaphone", menus: ["mc_events"] },
    { name: "Suara Pelanggan", icon: "MessageSquareWarning", menus: ["complaints"] },
  ],
};

/** Menus shown per division in the Super Admin sidebar (all divisions listed). */
export const DIVISION_MENUS: { division: Division; menus: MenuKey[] }[] = [
  // sys_review sits under Operation for placement, but access is jabatan-gated
  // (System Support) via an injected grant — it is NOT a general Operation menu.
  { division: "Operation", menus: [...OPERATION_FULL, "sys_review", "it_review", "elearning", "elearning_admin"] },
  { division: "Supervisor", menus: ["events", "hospitality", "hygiene", "complaints", "hc_kontrak", "hc_submit", "sys_submit"] },
  // Complaints ikut di sini, tapi PDQ hanya melihat kategori Food Quality —
  // penyaringnya di `complaintCategoryScope`, dan memasukkan komplain tetap
  // milik Marketing Communication.
  { division: "Product Development & Quality", menus: ["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "complaints"] },
  { division: "Human Capital", menus: ["work", "hcmos", "hcmos_raci", "hc_struktur", "hc_karyawan", "hc_culture", "hc_sop", "hc_rekrutmen", "hc_kompetensi", "hc_modul", "hc_selflearning", "hc_kinerja", "hc_intervensi", "hc_career", "hc_kompensasi", "hc_relasi", "hc_compliance", "hc_kebijakan", "hc_monitoring", "hc_kpi", "hc_kontrak", "hc_review", "hc_reqreview", "hc_training", "assessment", "elearning"] },
  // New department-aligned divisions — Work Tracker only for now.
  { division: "Finance", menus: ["work", "fin_training"] },
  { division: "Creative", menus: ["work", "creative_design"] },
  { division: "Project Manager", menus: ["work"] },
  { division: "Auditor", menus: ["work"] },
  { division: "Executive Assistant", menus: ["work"] },
  { division: "Business Development", menus: ["work"] },
  // Dua departemen ini punya pegawai aktif tapi belum pernah punya divisi, jadi
  // sidebar mereka kosong sama sekali. Diberi dasar yang sama dengan divisi
  // selaras-departemen lainnya; menu khususnya menyusul saat modulnya ada.
  { division: "Supply Chain", menus: ["work", "sc_hpp", "sc_rekap"] },
  { division: "Production", menus: ["work"] },
  // Marketing Communication: Work Tracker + the Event/Promo ACC & impact tracker.
  // MarComm adalah pintu masuk keluhan dari kanal publik (Google Review,
  // Instagram, TikTok), jadi Complaints ikut di divisinya.
  { division: "Marketing Communication", menus: ["work", "mc_events", "complaints"] },
  { division: "Administrator", menus: ["users", "audit"] },
];

// ── Admin-defined extra divisions (DB-backed) ──────────────────────────────
// A custom division is a named sidebar group over EXISTING menus. It never
// alters the built-in divisions, roles, menus or access rules; it only adds new
// groups. Access to its menus is granted per-user through the existing grants
// mechanism ("<Division>:<menuKey>"). Empty extras ⇒ behaviour identical to base.

/** One admin-defined sidebar division. */
export interface NavExtraDivision {
  id: string;
  name: string;
  icon: string; // lucide icon name (see NAV_ICONS)
  menus: MenuKey[]; // subset of NAV_MENUS keys
}
/** Pengelompokan menu di dalam SATU divisi, disusun admin di User Management. */
export interface NavExtraGroup {
  division: string;
  name: string;
  icon: string;
  menus: MenuKey[];
}
export interface NavExtra {
  divisions: NavExtraDivision[];
  /** Bila sebuah divisi punya entri di sini, ia MENGGANTI grup bawaannya. */
  groups?: NavExtraGroup[];
}

/** Shape a stable division id from its name (matches the data layer). */
export const navDivisionId = (name: string) =>
  `div_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** Names reserved by built-in divisions — custom ones can't shadow them. */
const RESERVED_DIVISIONS = new Set<string>(DIVISION_MENUS.map((d) => d.division));

/** Built-in (hardcoded) division names — the reserved set as a list. */
export const builtInDivisions = (): string[] => [...RESERVED_DIVISIONS];

let EXTRA_DIVISIONS: NavExtraDivision[] = [];
let EXTRA_GROUPS: NavExtraGroup[] = [];

/** Inject DB-added sidebar divisions & groupings (called with page-fetched data). */
export function setNavExtras(extra: NavExtra) {
  const valid = new Set<MenuKey>(NAV_MENUS.map((m) => m.key));
  EXTRA_DIVISIONS = (extra.divisions ?? [])
    .filter((d) => d.name && !RESERVED_DIVISIONS.has(d.name))
    .map((d) => ({ ...d, menus: d.menus.filter((k) => valid.has(k)) }));
  EXTRA_GROUPS = (extra.groups ?? [])
    .filter((g) => g.division && g.name)
    .map((g) => ({ ...g, menus: (g.menus ?? []).filter((k) => valid.has(k)) }));
}

/** The admin-defined divisions currently merged (for the management UI). */
export const extraDivisions = (): NavExtraDivision[] => EXTRA_DIVISIONS;

/** The admin-defined groupings currently merged (for the management UI). */
export const extraGroups = (): NavExtraGroup[] => EXTRA_GROUPS;

/** Sub-grup yang berlaku untuk sebuah divisi: susunan admin bila ada, kalau
 *  tidak pakai bawaan. Divisi tambahan tanpa susunan ⇒ semua menu jadi umum. */
export function groupsFor(division: string): NavGroupDef[] {
  const custom = EXTRA_GROUPS.filter((g) => g.division === division);
  if (custom.length > 0) return custom.map((g) => ({ name: g.name, icon: g.icon, menus: g.menus }));
  return DIVISION_GROUPS[division as Division] ?? [];
}

/**
 * Menu satu divisi menjadi NavItem terurut: sub-grup dulu (sesuai urutan yang
 * ditetapkan), lalu menu umum di bawahnya urut abjad. Menu `hidden` tidak
 * pernah ikut — rutenya tetap hidup, hanya tidak muncul di sidebar.
 */
function itemsForDivision(division: string, menus: MenuKey[], sectionIcon: string): NavItem[] {
  const diizinkan = new Set(withUniversal(menus, division));
  // `hidden` berarti "jangan tampil sebagai barisnya sendiri", bukan "tidak
  // boleh dibuka". Bedanya penting untuk kunci yang memang hanya membawa izin:
  // `hc_sop` tidak punya satu halaman SOP, ia dipakai sembilan baris SOP milik
  // tiap pilar. Menyaringnya di sini membuat kesembilan baris itu lenyap.
  const visible = new Set([...diizinkan].filter((k) => !MENU_BY_KEY[k]?.hidden));
  const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "id");

  // Bidang kerja bernomor lebih dulu dan sesuai nomornya; sisanya urut abjad.
  const groups = [...groupsFor(division)].sort(
    (a, b) => (a.urutan ?? Infinity) - (b.urutan ?? Infinity) || a.name.localeCompare(b.name, "id"),
  );
  const grouped: NavItem[] = [];
  const used = new Set<MenuKey>();

  for (const g of groups) {
    const items = g.menus
      .filter((e) => {
        const key = kunciEntri(e);
        // Baris berbentuk panjang membawa judul & rutenya sendiri, jadi ia boleh
        // muncul berkali-kali dengan kunci yang sama — itu memang gunanya.
        if (typeof e !== "string") return diizinkan.has(key);
        return visible.has(key) && !used.has(key) && !!MENU_BY_KEY[key];
      })
      .map((e) => {
        if (typeof e !== "string") {
          return { ...e, section: division, sectionIcon, group: g.name, groupIcon: g.icon, groupFlat: g.datar };
        }
        used.add(e);
        return { ...MENU_BY_KEY[e]!, section: division, sectionIcon, group: g.name, groupIcon: g.icon, groupFlat: g.datar };
      });
    // Bidang kerja yang urutannya bermakna mempertahankan urutan tulisnya.
    grouped.push(...(g.urutan === undefined ? [...items].sort(byName) : items));
  }

  // Menu umum: selalu paling bawah, urut abjad.
  //
  // Alamat yang sudah tampil di salah satu bidang kerja tidak diulang di sini.
  // Dua baris menuju halaman yang sama membuat orang mengira isinya berbeda,
  // lalu membuka keduanya untuk memastikan — dan tetap tidak yakin.
  const sudahTampil = new Set(grouped.map((i) => i.href));
  const loose = NAV_MENUS.filter((m) => visible.has(m.key) && !used.has(m.key) && !sudahTampil.has(m.href))
    .map((m) => ({ ...m, section: division, sectionIcon }))
    .sort(byName);

  return [...grouped, ...loose];
}

/** Every assignable sidebar division + its menus (built-in + admin-defined).
 *  Used by the "Role (Akses)" picker in Add User: choosing a division grants
 *  the user access to that sidebar's menus. */
export function assignableDivisions(): { name: string; menus: MenuKey[] }[] {
  return [
    ...DIVISION_MENUS.map((d) => ({ name: d.division as string, menus: withUniversal(d.menus, d.division) })),
    ...EXTRA_DIVISIONS.map((d) => ({ name: d.name, menus: withUniversal(d.menus, d.name) })),
  ];
}

/** Menu sebuah divisi yang benar-benar tampil di sidebar (tanpa yang `hidden`),
 *  lengkap dengan labelnya — dipakai penyusun bidang di User Management. */
export function visibleMenusOf(division: string): { key: MenuKey; label: string }[] {
  const d = assignableDivisions().find((x) => x.name === division);
  if (!d) return [];
  const set = new Set(d.menus);
  return NAV_MENUS.filter((m) => set.has(m.key) && !m.hidden).map((m) => ({ key: m.key, label: m.label }));
}

/** Per-user grants that unlock a whole sidebar division ("<div>:<menu>" each). */
export function grantsForDivision(name: string): string[] {
  const d = assignableDivisions().find((x) => x.name === name);
  return d ? d.menus.map((m) => `${name}:${m}`) : [];
}

/** Build the NavItems for the admin-defined divisions (custom sidebar groups). */
function extraNavItems(): NavItem[] {
  return EXTRA_DIVISIONS.flatMap((div) => itemsForDivision(div.name, div.menus, div.icon));
}

/** Roles that own Work-Tracker tasks — used as the "division" options when
 *  creating a task (every division that does Work Tracker, incl. R&D & HRD). */
export const WORK_DIVISIONS: Role[] = [
  "head_operation",
  "area_coordinator",
  "data_operation",
  "pos_operation",
  "admin_operation",
  "head_bar_rnd",
  "bar_rnd",
  "kitchen_rnd",
  "coordinator_rnd",
  "legal",
];

/** Build the ordered, division-tagged nav items visible to a role.
 *  Super Admin sees every division as its own group; everyone else sees only
 *  their own division's menus. */
export function navFor(role: Role): NavItem[] {
  if (role === "super_admin") {
    const base = DIVISION_MENUS.flatMap(({ division, menus }) =>
      itemsForDivision(division, menus, DIVISION_ICON[division]),
    );
    return [...base, ...extraNavItems()];
  }
  const division = ROLE_DIVISION[role];
  return itemsForDivision(division, ROLE_MENUS[role], DIVISION_ICON[division]);
}

/** Every division + its menus (the full sidebar) — shown to EVERY role.
 *  Access is enforced separately via accessibleMenuKeys(); non-accessible
 *  menus render locked. Admin-defined divisions are appended after the base. */
export function navAll(): NavItem[] {
  const base = DIVISION_MENUS.flatMap(({ division, menus }) =>
    itemsForDivision(division, menus, DIVISION_ICON[division]),
  );
  return [...base, ...extraNavItems()];
}

/** The menus a role may actually open (everything else is shown but locked). */
export function accessibleMenuKeys(role: Role): MenuKey[] {
  return withUniversal(ROLE_MENUS[role], ROLE_DIVISION[role]);
}

/** The division a role belongs to (its own, unlocked division header). */
export function homeDivision(role: Role): Division {
  return ROLE_DIVISION[role];
}

/** Whether a role may open a given menu (route guard helper). */
export function canSeeMenu(role: Role, key: MenuKey): boolean {
  return UNIVERSAL_MENUS.includes(key) || ROLE_MENUS[role].includes(key);
}

/** Whether any per-user grant unlocks a menu, in ANY division. Grants are
 *  stored as "<Division>:<menuKey>"; we compare only the menu-key segment so a
 *  grant from a custom division (e.g. "Marketing:reports") also counts. */
export function hasMenuGrant(grants: string[] | undefined, key: MenuKey): boolean {
  return (grants ?? []).some((g) => g.slice(g.lastIndexOf(":") + 1) === key);
}

/** Grant-aware route access: role's own menus OR an explicit grant (admin: all). */
export function canOpenMenu(role: Role, key: MenuKey, grants?: string[]): boolean {
  return role === "super_admin" || canSeeMenu(role, key) || hasMenuGrant(grants, key);
}

/**
 * Nama departemen di data pegawai TIDAK selalu sama persis dengan nama divisi
 * di sidebar, dan selisihnya diam-diam mematikan seluruh akses per-departemen.
 *
 * Contoh nyatanya: 12 orang tercatat berdepartemen "Operational", sementara
 * divisinya bernama "Operation". Perbandingannya `===`, jadi hasilnya selalu
 * salah — dan akibatnya tidak terlihat sebagai galat, melainkan sebagai
 * "menunya terkunci terus". Satu-satunya jalan keluar selama ini adalah
 * memberi izin satu per satu ke tiap orang, yang lalu terlihat wajar padahal
 * hanya menambal gejalanya.
 *
 * Nama yang tidak dikenal dikembalikan apa adanya — divisi buatan admin lewat
 * User Management memang bernama persis seperti departemennya.
 */
const ALIAS_DEPARTEMEN: Record<string, Division> = {
  operational: "Operation",
  operasional: "Operation",
  "finance accounting tax": "Finance",
  "finance & accounting": "Finance",
  "human capital management": "Human Capital",
  hrd: "Human Capital",
  pdq: "Product Development & Quality",
  "marcomm": "Marketing Communication",
};

/**
 * Menu yang DITEMPATKAN di sebuah divisi hanya demi letaknya di sidebar, tapi
 * aksesnya ditentukan JABATAN — bukan keanggotaan departemen.
 *
 * Keduanya adalah kotak masuk pekerjaan milik orang tertentu, bukan halaman
 * informasi. Antrian POS dikerjakan tim System Support; Antrian IT dikerjakan
 * pemegang Help Desk seorang diri. Membukanya untuk seluruh departemen
 * Operation berarti tiket bisa ditutup oleh orang yang tidak mengerjakannya,
 * dan pemiliknya tidak akan pernah tahu.
 *
 * Tanpa daftar ini, aturan "satu departemen boleh semua menunya" akan menelan
 * keduanya — dan sidebar menampilkannya terbuka padahal halamannya menolak,
 * sehingga yang menekan terlempar balik ke dashboard tanpa penjelasan.
 */
export const MENU_DIGERBANGI_JABATAN: MenuKey[] = ["sys_review", "it_review"];

export function divisiDari(department: string | null | undefined): string {
  const nama = (department ?? "").trim();
  if (!nama) return "";
  return ALIAS_DEPARTEMEN[nama.toLowerCase()] ?? nama;
}

/** Does the division named `division` (built-in or admin-defined) include `key`? */
export function divisionHasMenu(division: string, key: MenuKey): boolean {
  if (UNIVERSAL_MENUS.includes(key) && !NO_UNIVERSAL.includes(division)) return true;
  if (DIVISION_MENUS.some((d) => d.division === division && d.menus.includes(key))) return true;
  return EXTRA_DIVISIONS.some((d) => d.name === division && d.menus.includes(key));
}

/** Full route access, mirroring the sidebar's `canOpen` exactly: super admin,
 *  the role's own menus, an explicit per-user grant, OR the user's department
 *  division containing the menu (department-aligned members). Use this in page
 *  guards so a menu the sidebar shows as open never bounces to /dashboard. */
export function canReachMenu(
  user: { role: Role; grants?: string[] | null; department?: string | null },
  key: MenuKey,
): boolean {
  if (canOpenMenu(user.role, key, user.grants ?? undefined)) return true;
  if (MENU_DIGERBANGI_JABATAN.includes(key)) return false;
  const divisi = divisiDari(user.department);
  return !!divisi && divisionHasMenu(divisi, key);
}

/**
 * Apakah satu baris sidebar boleh dibuka.
 *
 * Aturan yang sama dipakai sidebar, menu ponsel, dan command palette. Dulu
 * ketiganya menyalin syarat ini masing-masing — tiga tempat yang harus diubah
 * serempak setiap kali aturannya bergeser, dan satu yang tertinggal berarti
 * menu tampil terbuka di satu tempat dan terkunci di tempat lain.
 *
 * `allowedKeys` sengaja diterima apa adanya, bukan dihitung ulang dari peran:
 * ada menu yang keterbukaannya bergantung keadaan (Assessment hanya selama
 * periodenya jalan), dan itu hanya bisa ditentukan di server.
 */
export interface NavAccess {
  homeDivision: string;
  allowedKeys: Iterable<MenuKey>;
  department: string;
  grants: Iterable<string>;
  isAdmin: boolean;
}

export function navOpenPredicate(a: NavAccess): (item: { section: string; key: MenuKey }) => boolean {
  const allowed = new Set(a.allowedKeys);
  const grants = new Set(a.grants);
  return (item) =>
    a.isAdmin ||
    (item.section === a.homeDivision && allowed.has(item.key)) ||
    // Keanggotaan departemen membuka seluruh menu divisinya — kecuali kotak
    // masuk yang digerbangi jabatan, yang tetap hanya lewat grant.
    (item.section === a.department && !MENU_DIGERBANGI_JABATAN.includes(item.key)) ||
    grants.has(`${item.section}:${item.key}`);
}

/**
 * Apakah sebuah DIVISI benar-benar milik seseorang.
 *
 * Bukan sekadar "ada satu menu yang bisa dibuka di dalamnya". Menu
 * perusahaan-luas (`UNIVERSAL_MENUS` — Pengajuan, Pesan) sengaja muncul di
 * SETIAP divisi, jadi syarat itu tidak pernah gagal: divisi Human Capital ikut
 * tampil terbuka di sidebar seorang desainer Creative hanya karena "Pengajuan"
 * ada di dalamnya.
 *
 * Sebuah divisi terbuka hanya bila ada menu KHAS divisi itu yang boleh dibuka.
 * Menu perusahaan-luas tetap bisa dijangkau lewat divisi orangnya sendiri.
 */
export function navSectionOpen(
  sectionItems: { section: string; key: MenuKey }[],
  canOpen: (item: { section: string; key: MenuKey }) => boolean,
): boolean {
  return sectionItems.some((i) => !UNIVERSAL_MENUS.includes(i.key) && canOpen(i));
}

/** Where a role should land after login — its first visible menu.
 *  Roles without the executive dashboard (legal, assessor) go to their own
 *  first menu instead of an empty /dashboard. */
export function landingFor(role: Role): string {
  return navFor(role)[0]?.href ?? "/dashboard";
}
