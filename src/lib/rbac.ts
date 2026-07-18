import type { Outlet, Role, UserProfile } from "./types";

/**
 * Capability-based RBAC. Each role maps to a set of permissions; UI and
 * server actions gate on `can(user, permission)`. Data visibility is handled
 * separately by `scopeOutlets` (row-level scoping).
 */

export type Permission =
  // platform admin
  | "manage_users"
  | "manage_org" // areas + outlets
  | "view_audit_logs"
  // operational data entry
  | "create_hospitality"
  | "create_hygiene"
  | "create_work_task"
  | "create_event"
  | "manage_complaint"
  // read access
  | "view_all_outlets"
  | "view_dashboard"
  | "view_reports";

const ALL: Permission[] = [
  "manage_users",
  "manage_org",
  "view_audit_logs",
  "create_hospitality",
  "create_hygiene",
  "create_work_task",
  "create_event",
  "manage_complaint",
  "view_all_outlets",
  "view_dashboard",
  "view_reports",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: ALL,
  head_operation: [
    "view_all_outlets",
    "view_dashboard",
    "view_reports",
    "view_audit_logs",
    "manage_complaint",
    "create_work_task",
    "create_event",
  ],
  area_coordinator: [
    "create_hospitality",
    "create_hygiene",
    "create_work_task",
    "create_event",
    "manage_complaint",
    "view_dashboard",
    "view_reports",
  ],
  data_operation: ["create_work_task"],
  pos_operation: ["create_work_task"],
  // Admin Operation now only handles Work Tracker + Complaints (no org/user admin).
  admin_operation: ["create_work_task", "manage_complaint"],
  // Supervisor division — fills Hygiene + Complaints for their own branch.
  supervisor: ["create_hygiene", "create_hospitality", "manage_complaint"],
  // R&D division — Work Tracker only.
  head_bar_rnd: ["create_work_task"],
  bar_rnd: ["create_work_task"],
  kitchen_rnd: ["create_work_task"],
  coordinator_rnd: ["create_work_task"],
  // HRD — Work Tracker only.
  legal: ["create_work_task"],
  // Assessment evaluator — no Work Tracker/ops permissions.
  assessor: [],
  // Generic division member — can add tasks in their division's Work Tracker.
  member: ["create_work_task"],
};

export function can(user: Pick<UserProfile, "role">, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

/** HQ roles that see every outlet regardless of assignment (no branch). */
export function hasGlobalScope(role: Role): boolean {
  return role === "super_admin" || role === "data_operation" || role === "admin_operation";
}

/**
 * Restrict a list of outlets to the ones a user is allowed to see.
 * - HQ roles (super_admin / data_operation / admin_operation): everything
 * - branch roles (head_operation / area_coordinator / pos_operation): their assigned
 *   outlet(s). Branch is optional — if none assigned, the user sees everything (HQ-like).
 */
export function scopeOutlets(user: UserProfile, outlets: Outlet[]): Outlet[] {
  if (hasGlobalScope(user.role)) return outlets;
  const ids = new Set(user.outletIds ?? []);
  // Assigned outletIds may hold the app id OR the POS branch code (assignments
  // historically stored the code), so match on either.
  if (ids.size) return outlets.filter((o) => ids.has(o.id) || ids.has(o.code));
  // Supervisor: only the outlet(s) they supervise (their own branch).
  if (user.role === "supervisor") return outlets.filter((o) => o.supervisorId === user.id);
  // Legacy area-based fallback for coordinators.
  if (user.role === "area_coordinator" && user.areaId) return outlets.filter((o) => o.areaId === user.areaId);
  // Branch role without any assignment → no restriction (e.g. a head_operation covering all).
  return outlets;
}

/** Whether `user` may act on data for `outletId`. */
export function canAccessOutlet(user: UserProfile, outletId: string, allOutlets: Outlet[]): boolean {
  return scopeOutlets(user, allOutlets).some((o) => o.id === outletId);
}
