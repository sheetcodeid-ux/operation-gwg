import { describe, expect, it } from "vitest";
import { can, hasGlobalScope, scopeOutlets } from "./rbac";
import {
  accessibleMenuKeys,
  canReachMenu,
  canSeeMenu,
  DIVISION_MENUS,
  homeDivision,
  navAll,
  navOpenPredicate,
  navSectionOpen,
  ROLE_MENUS,
} from "./nav";
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
      // hpp_comp = Analytics Harga Kompetitor (harga kita vs harga pasar).
      expect(ROLE_MENUS[r]).toEqual(["hpp_dash", "work", "hpp", "hpp_db", "hpp_bahan", "hpp_price", "hpp_comp", "assessment"]);
    }
  });

  it("memberi HRD (legal) seluruh kerangka HC-MOS, tanpa dasbor eksekutif", () => {
    // Daftarnya tidak lagi dieja satu per satu: kerangka HC-MOS punya 9 pilar
    // dan sub-menunya bertambah seiring modulnya jadi, sehingga menuliskannya
    // ulang di sini hanya membuat uji ini gagal setiap kali menu baru dipasang
    // — tanpa pernah menangkap satu pun kesalahan yang nyata.
    //
    // Yang benar-benar perlu dijaga: HRD memegang SETIAP menu divisinya, dan
    // tidak memegang yang bukan miliknya.
    const divisi = DIVISION_MENUS.find((d) => d.division === "Human Capital")!;
    expect([...ROLE_MENUS.legal].sort()).toEqual([...divisi.menus].sort());
    for (const key of ["hc_review", "assessment", "hcmos_raci", "hc_kpi"] as const) {
      expect(canSeeMenu("legal", key), key).toBe(true);
    }
    expect(canSeeMenu("legal", "dashboard")).toBe(false);
    expect(canSeeMenu("legal", "hpp")).toBe(false);
  });

  it("gives supervisor Hospitality + Hygiene + Complaints + HC Document Requests (field SPV, no dashboard/assessment)", () => {
    expect(ROLE_MENUS.supervisor).toEqual(["events", "hospitality", "hygiene", "complaints", "hc_kontrak", "hc_submit", "sys_submit"]);
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

  it("gives Marketing Communication its Work Tracker + Event Tracker, department-gated", () => {
    const mc = { role: "member" as const, department: "Marketing Communication" };
    expect(canReachMenu(mc, "mc_events")).toBe(true);
    expect(canReachMenu(mc, "work")).toBe(true);
    // Not exposed to unrelated roles/departments.
    expect(canReachMenu({ role: "supervisor", department: null }, "mc_events")).toBe(false);
    expect(canReachMenu({ role: "area_coordinator", department: "Operational" }, "mc_events")).toBe(false);
    // Super admin sees it in the sidebar.
    expect(canSeeMenu("super_admin", "mc_events")).toBe(true);
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

/**
 * Divisi mana yang benar-benar terbuka di sidebar seseorang.
 *
 * Ini memakai predikat yang SAMA dengan sidebar, menu ponsel, dan command
 * palette — bukan salinannya. Sebelumnya ketiganya punya salinan sendiri, dan
 * satu yang tertinggal berarti menu tampil terbuka di satu tempat dan terkunci
 * di tempat lain.
 */
describe("keterbukaan menu di sidebar", () => {
  // Akun nyata yang dikeluhkan: desainer Creative, peran generik `member`,
  // hibahnya hanya Work Tracker divisinya sendiri.
  const seka = {
    homeDivision: homeDivision("member"), // "Human Capital" — bawaan peran member
    department: "Creative",
    grants: ["Creative:work"],
    isAdmin: false,
  };

  it("orang Creative tidak membuka menu Human Capital saat assessment tutup", () => {
    // Inti keluhannya: `ROLE_MENUS.member = ["assessment"]` membuat setiap akun
    // member memegang menu itu, dan karena menu itu tinggal di divisi Human
    // Capital, divisi HC ikut terbuka di sidebar seorang desainer.
    const tutup = navOpenPredicate({
      ...seka,
      allowedKeys: accessibleMenuKeys("member").filter((k) => k !== "assessment"),
    });
    expect(tutup({ section: "Human Capital", key: "assessment" })).toBe(false);
    expect(tutup({ section: "Human Capital", key: "hc_review" })).toBe(false);
    expect(tutup({ section: "Human Capital", key: "hc_reqreview" })).toBe(false);
    expect(tutup({ section: "Human Capital", key: "hc_training" })).toBe(false);
  });

  it("tapi divisinya sendiri tetap terbuka", () => {
    const tutup = navOpenPredicate({
      ...seka,
      allowedKeys: accessibleMenuKeys("member").filter((k) => k !== "assessment"),
    });
    expect(tutup({ section: "Creative", key: "creative_design" })).toBe(true);
    expect(tutup({ section: "Creative", key: "work" })).toBe(true);
    // Pengajuan bersifat perusahaan-luas: tiap tim harus bisa mengajukan.
    expect(tutup({ section: "Creative", key: "hc_request" })).toBe(true);
  });

  it("saat periodenya jalan, menu assessment memang terbuka", () => {
    const buka = navOpenPredicate({ ...seka, allowedKeys: accessibleMenuKeys("member") });
    expect(buka({ section: "Human Capital", key: "assessment" })).toBe(true);
    // Selebihnya tetap terkunci — periode terbuka bukan kunci seluruh divisi HC.
    expect(buka({ section: "Human Capital", key: "hc_review" })).toBe(false);
  });

  it("super admin tetap membuka semuanya", () => {
    const admin = navOpenPredicate({
      homeDivision: homeDivision("super_admin"),
      allowedKeys: [],
      department: "",
      grants: [],
      isAdmin: true,
    });
    expect(admin({ section: "Human Capital", key: "hc_review" })).toBe(true);
    expect(admin({ section: "Administrator", key: "users" })).toBe(true);
  });
});

describe("kunci divisi di sidebar", () => {
  const canOpen = navOpenPredicate({
    homeDivision: homeDivision("member"), // "Human Capital"
    allowedKeys: accessibleMenuKeys("member").filter((k) => k !== "assessment"),
    department: "Creative",
    grants: ["Creative:work"],
    isAdmin: false,
  });
  const itemsOf = (section: string) => navAll().filter((i) => i.section === section);

  it("Pengajuan tidak membuka kunci divisi orang lain", () => {
    // Menu perusahaan-luas muncul di SETIAP divisi, jadi syarat lama
    // "ada satu menu yang bisa dibuka" tidak pernah gagal — divisi Human
    // Capital tampil terbuka di sidebar seorang desainer Creative.
    const hc = itemsOf("Human Capital");
    expect(hc.some((i) => i.key === "hc_request")).toBe(true); // memang ada di sana
    expect(hc.some((i) => canOpen(i))).toBe(true); // syarat lama: lolos
    expect(navSectionOpen(hc, canOpen)).toBe(false); // syarat baru: terkunci
  });

  it("divisi lain juga terkunci untuk akun Creative", () => {
    for (const s of ["Operation", "Finance", "Marketing Communication", "Administrator"]) {
      expect(navSectionOpen(itemsOf(s), canOpen), `${s} seharusnya terkunci`).toBe(false);
    }
  });

  it("divisinya sendiri tetap terbuka", () => {
    expect(navSectionOpen(itemsOf("Creative"), canOpen)).toBe(true);
  });

  it("orang HC tetap membuka divisinya sendiri", () => {
    const hcUser = navOpenPredicate({
      homeDivision: homeDivision("member"),
      allowedKeys: accessibleMenuKeys("member").filter((k) => k !== "assessment"),
      department: "Human Capital",
      grants: [],
      isAdmin: false,
    });
    expect(navSectionOpen(itemsOf("Human Capital"), hcUser)).toBe(true);
  });
});
