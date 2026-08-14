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
  | "hc_submit"
  | "hc_review"
  | "sys_submit"
  | "elearning"
  | "elearning_admin"
  | "hcmos"
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
  { key: "sys_review", label: "Antrian System", href: "/system/antrian", icon: "Headset" },
  // Kedua "pengajuan" ini kini menjadi kategori DI DALAM halaman Pengajuan —
  // tetap punya rute sendiri, tapi tidak lagi muncul terpisah di sidebar.
  { key: "hc_submit", label: "Pengajuan Dokumen", href: "/hc/pengajuan", icon: "FileUp", hidden: true },
  { key: "hc_review", label: "Antrian Dokumen", href: "/hc/antrian", icon: "FolderInput" },
  { key: "sys_submit", label: "Pengajuan System", href: "/system/pengajuan", icon: "MonitorCog", hidden: true },
  { key: "elearning", label: "E-Learning", href: "/elearning", icon: "GraduationCap" },
  { key: "elearning_admin", label: "Kelola E-Learning", href: "/elearning/kelola", icon: "LibraryBig" },
  { key: "hcmos", label: "HC-MOS", href: "/hc-mos", icon: "Network" },
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
  legal: ["work", "hcmos", "hc_kontrak", "hc_review", "hc_reqreview", "hc_training", "assessment"], // HRD — assessment + antrian dokumen HC
  assessor: ["assessment"], // division Head / evaluator — assessment only
  member: ["assessment"], // HO staff — assessment; other access via `department`
};

/** Menus every department gets automatically — including divisions an admin
 *  adds later, and roles that were never wired up for them. "Pengajuan" is
 *  company-wide by design: any team must be able to request headcount or a
 *  training programme without an admin granting it first. */
export const UNIVERSAL_MENUS: MenuKey[] = ["hc_request", "pesan"];

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

export interface NavGroupDef {
  name: string;
  icon: string; // lucide icon name
  menus: MenuKey[];
}

/** Pengelompokan bawaan per divisi. Bisa ditimpa admin lewat User Management. */
export const DIVISION_GROUPS: Partial<Record<Division, NavGroupDef[]>> = {
  Operation: [
    { name: "Monitoring Outlet", icon: "Store", menus: ["outlets", "hospitality", "hygiene", "complaints"] },
    { name: "Keuangan Operasional", icon: "Wallet", menus: ["op_beban", "op_pembelian", "op_pnl", "op_settings"] },
    { name: "Analisis & Laporan", icon: "ChartColumnBig", menus: ["analytics", "op_analysis", "op_fraud", "op_seasonal", "reports"] },
    { name: "Pembelajaran", icon: "GraduationCap", menus: ["elearning", "elearning_admin"] },
    { name: "System Support", icon: "Headset", menus: ["sys_review"] },
  ],
  Supervisor: [
    { name: "Operasional Outlet", icon: "Store", menus: ["hospitality", "hygiene", "complaints"] },
    { name: "Kepegawaian", icon: "UserRound", menus: ["hc_kontrak"] },
  ],
  "Product Development & Quality": [
    { name: "Kalkulasi HPP", icon: "Calculator", menus: ["hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp"] },
  ],
  "Human Capital": [
    { name: "Talent Acquisition", icon: "UserRound", menus: ["hc_reqreview", "hc_training"] },
    { name: "Administrasi Personalia", icon: "FolderInput", menus: ["hc_review"] },
    { name: "Kinerja & Penilaian", icon: "Target", menus: ["assessment"] },
    { name: "HC-MOS", icon: "Network", menus: ["hcmos", "hc_kontrak"] },
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
const DIVISION_MENUS: { division: Division; menus: MenuKey[] }[] = [
  // sys_review sits under Operation for placement, but access is jabatan-gated
  // (System Support) via an injected grant — it is NOT a general Operation menu.
  { division: "Operation", menus: [...OPERATION_FULL, "sys_review", "elearning", "elearning_admin"] },
  { division: "Supervisor", menus: ["events", "hospitality", "hygiene", "complaints", "hc_kontrak", "hc_submit", "sys_submit"] },
  // Complaints ikut di sini, tapi PDQ hanya melihat kategori Food Quality —
  // penyaringnya di `complaintCategoryScope`, dan memasukkan komplain tetap
  // milik Marketing Communication.
  { division: "Product Development & Quality", menus: ["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "complaints"] },
  { division: "Human Capital", menus: ["work", "hcmos", "hc_kontrak", "hc_review", "hc_reqreview", "hc_training", "assessment"] },
  // New department-aligned divisions — Work Tracker only for now.
  { division: "Finance", menus: ["work", "fin_training"] },
  { division: "Creative", menus: ["work", "creative_design"] },
  { division: "Project Manager", menus: ["work"] },
  { division: "Auditor", menus: ["work"] },
  { division: "Executive Assistant", menus: ["work"] },
  { division: "Business Development", menus: ["work"] },
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
  const visible = new Set(withUniversal(menus, division).filter((k) => !MENU_BY_KEY[k]?.hidden));
  const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "id");

  // Bidang kerja urut abjad, isinya juga urut abjad.
  const groups = [...groupsFor(division)].sort((a, b) => a.name.localeCompare(b.name, "id"));
  const grouped: NavItem[] = [];
  const used = new Set<MenuKey>();

  for (const g of groups) {
    const items = g.menus
      .filter((key) => visible.has(key) && !used.has(key) && MENU_BY_KEY[key])
      .map((key) => {
        used.add(key);
        return { ...MENU_BY_KEY[key]!, section: division, sectionIcon, group: g.name, groupIcon: g.icon };
      })
      .sort(byName);
    grouped.push(...items);
  }

  // Menu umum: selalu paling bawah, urut abjad.
  const loose = NAV_MENUS.filter((m) => visible.has(m.key) && !used.has(m.key))
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
  return !!user.department && divisionHasMenu(user.department, key);
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
    item.section === a.department ||
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
