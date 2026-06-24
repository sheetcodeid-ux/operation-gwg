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
  director: ["view_all_outlets", "view_dashboard", "view_reports"],
  head_operation: ["view_all_outlets", "view_dashboard", "view_reports", "view_audit_logs"],
  area_coordinator: [
    "create_hospitality",
    "create_hygiene",
    "create_work_task",
    "create_event",
    "manage_complaint",
    "view_dashboard",
    "view_reports",
  ],
  supervisor: ["create_work_task", "view_dashboard", "view_reports"],
  pic_outlet: ["view_dashboard"],
};

export function can(user: Pick<UserProfile, "role">, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

/** Roles that can see every outlet regardless of assignment. */
export function hasGlobalScope(role: Role): boolean {
  return role === "super_admin" || role === "director" || role === "head_operation";
}

/**
 * Restrict a list of outlets to the ones a user is allowed to see.
 * - global roles: everything
 * - area_coordinator: outlets in their area
 * - supervisor / pic_outlet: explicitly assigned outlets
 */
export function scopeOutlets(user: UserProfile, outlets: Outlet[]): Outlet[] {
  if (hasGlobalScope(user.role)) return outlets;
  // Area Coordinators are assigned to several specific outlets (multi-select).
  if (user.role === "area_coordinator") {
    if (user.outletIds && user.outletIds.length) {
      const ids = new Set(user.outletIds);
      return outlets.filter((o) => ids.has(o.id));
    }
    if (user.areaId) return outlets.filter((o) => o.areaId === user.areaId);
    return [];
  }
  // Supervisor / PIC: explicitly assigned outlets (supervisor = exactly 1).
  const ids = new Set(user.outletIds ?? []);
  return outlets.filter((o) => ids.has(o.id));
}

/** Whether `user` may act on data for `outletId`. */
export function canAccessOutlet(user: UserProfile, outletId: string, allOutlets: Outlet[]): boolean {
  return scopeOutlets(user, allOutlets).some((o) => o.id === outletId);
}
