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

  it("makes director read-only (no operational writes)", () => {
    const director = byRole("director");
    expect(can(director, "view_dashboard")).toBe(true);
    expect(can(director, "create_work_task")).toBe(false);
    expect(can(director, "manage_users")).toBe(false);
  });

  it("lets area_coordinator create operational data but not manage users", () => {
    const ac = byRole("area_coordinator");
    expect(can(ac, "create_hospitality")).toBe(true);
    expect(can(ac, "create_hygiene")).toBe(true);
    expect(can(ac, "manage_users")).toBe(false);
  });

  it("limits pic_outlet to viewing the dashboard", () => {
    const pic = byRole("pic_outlet");
    expect(can(pic, "view_dashboard")).toBe(true);
    expect(can(pic, "create_work_task")).toBe(false);
  });
});

describe("hasGlobalScope", () => {
  it("is true for executives and false for field roles", () => {
    expect(hasGlobalScope("super_admin")).toBe(true);
    expect(hasGlobalScope("director")).toBe(true);
    expect(hasGlobalScope("head_operation")).toBe(true);
    expect(hasGlobalScope("area_coordinator")).toBe(false);
    expect(hasGlobalScope("pic_outlet")).toBe(false);
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

  it("restricts pic_outlet to assigned outlets only", () => {
    const pic = byRole("pic_outlet");
    const scoped = scopeOutlets(pic, outlets);
    expect(scoped.map((o) => o.id)).toEqual(pic.outletIds);
  });
});
