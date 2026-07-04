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
  | "users"
  | "organization"
  | "audit";

/** Division a role belongs to — used as the sidebar group header. */
export type Division = "Operation" | "Supervisor" | "R&D" | "HRD" | "Administrator";

export interface NavItem {
  key: MenuKey;
  label: string;
  href: string;
  icon: string; // lucide icon name
  /** Sidebar group — the user's division. Attached when building per-user nav. */
  section: string;
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
  { key: "users", label: "User Management", href: "/admin/users", icon: "Users" },
  { key: "organization", label: "Organization", href: "/admin/organization", icon: "Network" },
  { key: "audit", label: "Audit Logs", href: "/admin/audit", icon: "ScrollText" },
];

/** Icon (lucide name) shown next to each division's collapsible header. */
export const DIVISION_ICON: Record<Division, string> = {
  Operation: "Briefcase",
  Supervisor: "ShieldCheck",
  "R&D": "FlaskConical",
  HRD: "Scale",
  Administrator: "Settings2",
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
  legal: "HRD",
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
  legal: ["work"],
};

/** Menus shown per division in the Super Admin sidebar (all divisions listed). */
const DIVISION_MENUS: { division: Division; menus: MenuKey[] }[] = [
  { division: "Operation", menus: OPERATION_FULL },
  { division: "Supervisor", menus: ["hygiene", "complaints"] },
  { division: "R&D", menus: ["work"] },
  { division: "HRD", menus: ["work"] },
  { division: "Administrator", menus: ["users", "organization", "audit"] },
];

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
    return DIVISION_MENUS.flatMap(({ division, menus }) => {
      const allowed = new Set(menus);
      return NAV_MENUS.filter((m) => allowed.has(m.key)).map((m) => ({ ...m, section: division }));
    });
  }
  const allowed = new Set(ROLE_MENUS[role]);
  const division = ROLE_DIVISION[role];
  return NAV_MENUS.filter((m) => allowed.has(m.key)).map((m) => ({ ...m, section: division }));
}

/** Whether a role may open a given menu (route guard helper). */
export function canSeeMenu(role: Role, key: MenuKey): boolean {
  return ROLE_MENUS[role].includes(key);
}
