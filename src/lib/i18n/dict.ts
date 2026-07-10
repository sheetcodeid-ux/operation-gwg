export type Lang = "en" | "id";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "id", label: "ID" },
];

/** UI chrome dictionary. Keys are dot-paths; values per language. */
export const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "section.Overview": "Overview",
    "section.Operations": "Operations",
    "section.Quality": "Quality",
    "section.Insights": "Insights",
    "section.Admin": "Admin",

    "nav.Dashboard": "Dashboard",
    "nav.Work Tracker": "Work Tracker",
    "nav.Event Tracker": "Event Tracker",
    "nav.Hospitality": "Hospitality",
    "nav.Hygiene": "Hygiene",
    "nav.Complaints": "Complaints",
    "nav.Outlets": "Outlets",
    "nav.Reports": "Reports",
    "nav.Assessment Golongan": "Grade Assessment",
    "nav.Kalkulator HPP": "COGS Calculator",
    "nav.Database HPP": "COGS Database",
    "nav.User Management": "User Management",
    "nav.Organization": "Organization",
    "nav.Departemen & Divisi": "Departments & Divisions",
    "nav.Audit Logs": "Audit Logs",

    "common.commandCenter": "Command Center",
    "common.realtime": "Real-time monitoring",
    "common.realtimeSub": "50 outlets · 5 areas live",
    "common.live": "Live",
    "common.search": "Search outlets, tasks, complaints…",
    "common.profile": "Profile",
    "common.signOut": "Sign out",
    "common.signingOut": "Signing out…",
    "common.notifications": "Notifications",
    "common.markAllRead": "Mark all read",
    "common.allCaughtUp": "All caught up",
  },
  id: {
    "section.Overview": "Ringkasan",
    "section.Operations": "Operasional",
    "section.Quality": "Kualitas",
    "section.Insights": "Wawasan",
    "section.Admin": "Admin",

    "nav.Dashboard": "Dasbor",
    "nav.Work Tracker": "Pelacak Kerja",
    "nav.Event Tracker": "Pelacak Event",
    "nav.Hospitality": "Hospitality",
    "nav.Hygiene": "Kebersihan",
    "nav.Complaints": "Komplain",
    "nav.Outlets": "Outlet",
    "nav.Reports": "Laporan",
    "nav.Assessment Golongan": "Assessment Golongan",
    "nav.Kalkulator HPP": "Kalkulator HPP",
    "nav.Database HPP": "Database HPP",
    "nav.User Management": "Manajemen User",
    "nav.Organization": "Organisasi",
    "nav.Departemen & Divisi": "Departemen & Divisi",
    "nav.Audit Logs": "Log Audit",

    "common.commandCenter": "Pusat Kendali",
    "common.realtime": "Pemantauan real-time",
    "common.realtimeSub": "50 outlet · 5 wilayah live",
    "common.live": "Live",
    "common.search": "Cari outlet, tugas, komplain…",
    "common.profile": "Profil",
    "common.signOut": "Keluar",
    "common.signingOut": "Keluar…",
    "common.notifications": "Notifikasi",
    "common.markAllRead": "Tandai sudah dibaca",
    "common.allCaughtUp": "Semua terbaca",
  },
};

export function translate(lang: Lang, key: string): string {
  return DICT[lang]?.[key] ?? DICT.en[key] ?? key;
}
