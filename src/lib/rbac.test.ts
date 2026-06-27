import { describe, expect, it } from "vitest";
import { can, hasGlobalScope, scopeOutlets } from "./rbac";
import { getOutlets, getUsers } from "./data/store";
import type { UserProfile } from "./types";

const users = getUsers();
const outlets = getOutlets();
const byRole = (role: UserProfile["role"]) => users.find((u) => u.role === role)!;

describe("RBAC capabilities", () => {
  it("grants super_admin every capability", () => {
    const admin = byRole("super_admin");
    expect(can(admin, "manage_users")).toBe(true);
    expect(can(admin, "manage_org")).toBe(true);
    expect(can(admin, "manage_complaint")).toBe(true);
  });

  it("lets admin_operation manage users + org but not enter operational data", () => {
    const adminOps = byRole("admin_operation");
    expect(can(adminOps, "manage_users")).toBe(true);
    expect(can(adminOps, "manage_org")).toBe(true);
    expect(can(adminOps, "create_hospitality")).toBe(false);
  });

  it("lets area_coordinator create operational data but not manage users", () => {
    const ac = byRole("area_coordinator");
    expect(can(ac, "create_hospitality")).toBe(true);
    expect(can(ac, "create_hygiene")).toBe(true);
    expect(can(ac, "manage_users")).toBe(false);
  });

  it("limits pos_operation to tasks + viewing (no user management)", () => {
    const pos = byRole("pos_operation");
    expect(can(pos, "view_dashboard")).toBe(true);
    expect(can(pos, "create_work_task")).toBe(true);
    expect(can(pos, "manage_users")).toBe(false);
  });
});

describe("hasGlobalScope", () => {
  it("is true for HQ roles and false for branch roles", () => {
    expect(hasGlobalScope("super_admin")).toBe(true);
    expect(hasGlobalScope("data_operation")).toBe(true);
    expect(hasGlobalScope("admin_operation")).toBe(true);
    expect(hasGlobalScope("area_coordinator")).toBe(false);
    expect(hasGlobalScope("pos_operation")).toBe(false);
  });
});

describe("scopeOutlets row-level scoping", () => {
  it("returns all 50 outlets for a global role", () => {
    expect(scopeOutlets(byRole("super_admin"), outlets)).toHaveLength(50);
  });

  it("restricts area_coordinator to their own area", () => {
    const ac = byRole("area_coordinator");
    const scoped = scopeOutlets(ac, outlets);
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((o) => o.areaId === ac.areaId)).toBe(true);
  });

  it("restricts pos_operation to its assigned outlet only", () => {
    const pos = byRole("pos_operation");
    const scoped = scopeOutlets(pos, outlets);
    expect(scoped.map((o) => o.id)).toEqual(pos.outletIds);
  });
});
