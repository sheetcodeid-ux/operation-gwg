import { describe, expect, it } from "vitest";
import { can, hasGlobalScope, scopeOutlets } from "./rbac";
import { canSeeMenu, ROLE_MENUS } from "./nav";
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

  it("limits admin_operation to Work Tracker + Complaints (no user/org admin)", () => {
    const adminOps = byRole("admin_operation");
    expect(can(adminOps, "create_work_task")).toBe(true);
    expect(can(adminOps, "manage_complaint")).toBe(true);
    expect(can(adminOps, "manage_users")).toBe(false);
    expect(can(adminOps, "manage_org")).toBe(false);
    expect(can(adminOps, "create_hospitality")).toBe(false);
  });

  it("lets area_coordinator manage work but not hygiene/hospitality entry or users", () => {
    const ac = byRole("area_coordinator");
    // Coordinators review outlets; Hygiene/Hospitality entry is the Supervisor's job.
    expect(can(ac, "create_hospitality")).toBe(false);
    expect(can(ac, "create_hygiene")).toBe(false);
    expect(can(ac, "create_work_task")).toBe(true);
    expect(can(ac, "manage_complaint")).toBe(true);
    expect(can(ac, "manage_users")).toBe(false);
  });

  it("limits pos_operation to Work Tracker only", () => {
    const pos = byRole("pos_operation");
    expect(can(pos, "create_work_task")).toBe(true);
    expect(can(pos, "view_dashboard")).toBe(false);
    expect(can(pos, "manage_users")).toBe(false);
  });
});

describe("menu access matrix", () => {
  it("gives R&D roles Work Tracker + full HPP suite (Kalkulator/Database/Bahan)", () => {
    for (const r of ["bar_rnd", "kitchen_rnd", "head_bar_rnd", "coordinator_rnd"] as const) {
      // Every non-supervisor role also gets Assessment (org-wide requirement);
      // hpp_price = Referensi Harga & HPP (ESB price vs HPP).
      expect(ROLE_MENUS[r]).toEqual(["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "assessment"]);
    }
  });

  it("gives HRD (legal) Work Tracker + HC Document Queue + Assessment Golongan", () => {
    expect(ROLE_MENUS.legal).toEqual(["work", "hc_review", "assessment"]);
    expect(canSeeMenu("legal", "hc_review")).toBe(true);
    expect(canSeeMenu("legal", "assessment")).toBe(true);
    expect(canSeeMenu("legal", "dashboard")).toBe(false);
  });

  it("gives supervisor Hospitality + Hygiene + Complaints + HC Document Requests (field SPV, no dashboard/assessment)", () => {
    expect(ROLE_MENUS.supervisor).toEqual(["hospitality", "hygiene", "complaints", "hc_submit", "sys_submit"]);
    expect(canSeeMenu("supervisor", "hc_submit")).toBe(true);
    expect(canSeeMenu("supervisor", "hygiene")).toBe(true);
    expect(canSeeMenu("supervisor", "hospitality")).toBe(true);
    expect(canSeeMenu("supervisor", "dashboard")).toBe(false);
    expect(canSeeMenu("supervisor", "assessment")).toBe(false);
    // Complaints are monitor-only for supervisors — no create/edit.
    expect(can({ role: "supervisor" }, "manage_complaint")).toBe(false);
    expect(can({ role: "supervisor" }, "create_hygiene")).toBe(true);
  });

  it("restricts admin menus to super_admin", () => {
    expect(canSeeMenu("super_admin", "users")).toBe(true);
    expect(canSeeMenu("admin_operation", "users")).toBe(false);
    expect(canSeeMenu("head_operation", "users")).toBe(false);
  });

  it("gives E-Learning management to Head Operational, learning-only to Coordinator Area", () => {
    // Head Operational manages (both menus) — the only role that can upload/edit.
    expect(canSeeMenu("head_operation", "elearning")).toBe(true);
    expect(canSeeMenu("head_operation", "elearning_admin")).toBe(true);
    // Coordinator Area learns only — no management menu.
    expect(canSeeMenu("area_coordinator", "elearning")).toBe(true);
    expect(canSeeMenu("area_coordinator", "elearning_admin")).toBe(false);
    // Other roles get neither.
    expect(canSeeMenu("supervisor", "elearning")).toBe(false);
    expect(canSeeMenu("pos_operation", "elearning_admin")).toBe(false);
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
