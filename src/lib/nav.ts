import type { Role } from "./types";

/** Every navigable menu in the app. */
export type MenuKey =
  | "dashboard"
  | "work"
  | "events"
  | "hospitality"
  | "hygiene"
  | "complaints"
  | "outlets"
  | "reports"
  | "assessment"
  | "users"
  | "departments"
  | "audit";

/** Division a role belongs to — used as the sidebar group header. */
export type Division =
  | "Operation"
  | "Supervisor"
  | "R&D"
  | "Human Capital"
  | "Administrator"
  | "Finance"
  | "Creative"
  | "Project Manager"
  | "Auditor"
  | "Sekretaris"
  | "Business Development";

export interface NavItem {
  key: MenuKey;
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Sidebar group — the user's division. Attached when building per-user nav. */
  section: string;
  /** Lucide icon name for the section header (built-in or admin-defined). */
  sectionIcon?: string;
}

/** Static definition of every menu (order = sidebar order within a group). */
export const NAV_MENUS: Omit<NavItem, "section">[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "work", label: "Work Tracker", href: "/work-tracker", icon: "ListChecks" },
  { key: "events", label: "Event Tracker", href: "/events", icon: "CalendarRange" },
  { key: "hospitality", label: "Hospitality", href: "/hospitality", icon: "ConciergeBell" },
  { key: "hygiene", label: "Hygiene", href: "/hygiene", icon: "SprayCan" },
  { key: "complaints", label: "Complaints", href: "/complaints", icon: "MessageSquareWarning" },
  { key: "outlets", label: "Outlets", href: "/outlets", icon: "Store" },
  { key: "reports", label: "Reports", href: "/reports", icon: "FileText" },
  { key: "assessment", label: "Assessment Golongan", href: "/assessment", icon: "Award" },
  { key: "users", label: "User Management", href: "/admin/users", icon: "Users" },
  { key: "departments", label: "Departemen & Divisi", href: "/admin/departments", icon: "Network" },
  { key: "audit", label: "Audit Logs", href: "/admin/audit", icon: "ScrollText" },
];

/** Icon (lucide name) shown next to each division's collapsible header. */
export const DIVISION_ICON: Record<Division, string> = {
  Operation: "Briefcase",
  Supervisor: "ShieldCheck",
  "R&D": "FlaskConical",
  "Human Capital": "Scale",
  Administrator: "Settings2",
  Finance: "ChartSpline",
  Creative: "Award",
  "Project Manager": "ListChecks",
  Auditor: "ShieldCheck",
  Sekretaris: "FileText",
  "Business Development": "Store",
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
  head_bar_rnd: "R&D",
  bar_rnd: "R&D",
  kitchen_rnd: "R&D",
  coordinator_rnd: "R&D",
  legal: "Human Capital",
  assessor: "Human Capital",
};

const OPERATION_FULL: MenuKey[] = [
  "dashboard",
  "work",
  "events",
  "hospitality",
  "hygiene",
  "complaints",
  "outlets",
  "reports",
];

/** The exact menus each role can see (single source of truth for the sidebar). */
export const ROLE_MENUS: Record<Role, MenuKey[]> = {
  super_admin: NAV_MENUS.map((m) => m.key), // everything, incl. admin menus
  head_operation: OPERATION_FULL, // monitors every branch (no area scope)
  area_coordinator: OPERATION_FULL, // same menus, scoped to their area
  data_operation: ["work"],
  pos_operation: ["work"],
  admin_operation: ["work", "complaints"],
  supervisor: ["hygiene", "complaints"], // their own branch only
  head_bar_rnd: ["work"],
  bar_rnd: ["work"],
  kitchen_rnd: ["work"],
  coordinator_rnd: ["work"],
  legal: ["work", "assessment"], // HRD — grade-promotion assessment
  assessor: ["assessment"], // division Head / evaluator — assessment only
};

/** Menus shown per division in the Super Admin sidebar (all divisions listed). */
const DIVISION_MENUS: { division: Division; menus: MenuKey[] }[] = [
  { division: "Operation", menus: OPERATION_FULL },
  { division: "Supervisor", menus: ["hygiene", "complaints"] },
  { division: "R&D", menus: ["work"] },
  { division: "Human Capital", menus: ["work", "assessment"] },
  // New department-aligned divisions — Work Tracker only for now.
  { division: "Finance", menus: ["work"] },
  { division: "Creative", menus: ["work"] },
  { division: "Project Manager", menus: ["work"] },
  { division: "Auditor", menus: ["work"] },
  { division: "Sekretaris", menus: ["work"] },
  { division: "Business Development", menus: ["work"] },
  { division: "Administrator", menus: ["users", "departments", "audit"] },
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
export interface NavExtra {
  divisions: NavExtraDivision[];
}

/** Shape a stable division id from its name (matches the data layer). */
export const navDivisionId = (name: string) =>
  `div_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** Names reserved by built-in divisions — custom ones can't shadow them. */
const RESERVED_DIVISIONS = new Set<string>(DIVISION_MENUS.map((d) => d.division));

/** Built-in (hardcoded) division names — the reserved set as a list. */
export const builtInDivisions = (): string[] => [...RESERVED_DIVISIONS];

let EXTRA_DIVISIONS: NavExtraDivision[] = [];

/** Inject DB-added sidebar divisions (called once with page-fetched data). */
export function setNavExtras(extra: NavExtra) {
  const valid = new Set<MenuKey>(NAV_MENUS.map((m) => m.key));
  EXTRA_DIVISIONS = (extra.divisions ?? [])
    .filter((d) => d.name && !RESERVED_DIVISIONS.has(d.name))
    .map((d) => ({ ...d, menus: d.menus.filter((k) => valid.has(k)) }));
}

/** The admin-defined divisions currently merged (for the management UI). */
export const extraDivisions = (): NavExtraDivision[] => EXTRA_DIVISIONS;

/** Build the NavItems for the admin-defined divisions (custom sidebar groups). */
function extraNavItems(): NavItem[] {
  return EXTRA_DIVISIONS.flatMap((div) => {
    const set = new Set(div.menus);
    return NAV_MENUS.filter((m) => set.has(m.key)).map((m) => ({ ...m, section: div.name, sectionIcon: div.icon }));
  });
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
    const base = DIVISION_MENUS.flatMap(({ division, menus }) => {
      const allowed = new Set(menus);
      return NAV_MENUS.filter((m) => allowed.has(m.key)).map((m) => ({ ...m, section: division, sectionIcon: DIVISION_ICON[division] }));
    });
    return [...base, ...extraNavItems()];
  }
  const allowed = new Set(ROLE_MENUS[role]);
  const division = ROLE_DIVISION[role];
  return NAV_MENUS.filter((m) => allowed.has(m.key)).map((m) => ({ ...m, section: division, sectionIcon: DIVISION_ICON[division] }));
}

/** Every division + its menus (the full sidebar) — shown to EVERY role.
 *  Access is enforced separately via accessibleMenuKeys(); non-accessible
 *  menus render locked. Admin-defined divisions are appended after the base. */
export function navAll(): NavItem[] {
  const base = DIVISION_MENUS.flatMap(({ division, menus }) => {
    const set = new Set(menus);
    return NAV_MENUS.filter((m) => set.has(m.key)).map((m) => ({ ...m, section: division, sectionIcon: DIVISION_ICON[division] }));
  });
  return [...base, ...extraNavItems()];
}

/** The menus a role may actually open (everything else is shown but locked). */
export function accessibleMenuKeys(role: Role): MenuKey[] {
  return [...ROLE_MENUS[role]];
}

/** The division a role belongs to (its own, unlocked division header). */
export function homeDivision(role: Role): Division {
  return ROLE_DIVISION[role];
}

/** Whether a role may open a given menu (route guard helper). */
export function canSeeMenu(role: Role, key: MenuKey): boolean {
  return ROLE_MENUS[role].includes(key);
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

/** Where a role should land after login — its first visible menu.
 *  Roles without the executive dashboard (legal, assessor) go to their own
 *  first menu instead of an empty /dashboard. */
export function landingFor(role: Role): string {
  return navFor(role)[0]?.href ?? "/dashboard";
}
