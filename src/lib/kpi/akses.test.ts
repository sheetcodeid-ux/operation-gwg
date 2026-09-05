import { describe, expect, it } from "vitest";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { MENU_POSISI, picTerkunci } from "./akses";
import { POSISI } from "./struktur";
import type { UserProfile } from "@/lib/types";

/**
 * Siapa boleh membuka KPI mana.
 *
 * Sebelumnya seluruh menu KPI hanya terbuka lewat izin per-pengguna, jadi
 * TIDAK SATU PUN departemen bisa membaca capaiannya sendiri — rapor yang hanya
 * bisa dibuka atasannya berhenti jadi alat kerja dan berubah jadi alat vonis.
 */

const orang = (p: Partial<UserProfile>): UserProfile =>
  ({ id: "u1", name: "Uji", role: "member", department: "", grants: [], ...p }) as UserProfile;

describe("tiap departemen membaca KPI-nya sendiri", () => {
  it("Coordinator Area membuka KPI Operational", () => {
    expect(canReachMenu(orang({ role: "area_coordinator", department: "Operational" }), "kpi_op_ca" as MenuKey)).toBe(true);
  });

  it("staf departemen lain membuka KPI departemennya", () => {
    const cek: [string, MenuKey][] = [
      ["Creative", "kpi_creative_content" as MenuKey],
      ["Finance", "kpi_fin_accounting" as MenuKey],
      ["Product Development & Quality", "kpi_pdq_food" as MenuKey],
      ["Marketing Communication", "kpi_marcomm" as MenuKey],
    ];
    for (const [departemen, menu] of cek) {
      expect(canReachMenu(orang({ department: departemen }), menu), `${departemen} → ${menu}`).toBe(true);
    }
  });

  it("tidak bisa membuka KPI departemen lain", () => {
    // Capaian departemen lain bukan urusannya, dan membiarkannya terbuka
    // membuat rapor orang beredar tanpa sepengetahuan yang dinilai.
    const creative = orang({ department: "Creative" });
    expect(canReachMenu(creative, "kpi_fin_finance" as MenuKey)).toBe(false);
    expect(canReachMenu(creative, "kpi_op_ca" as MenuKey)).toBe(false);
  });

  it("setiap posisi punya menunya, dan menu itu dikenali", () => {
    for (const p of POSISI) expect(MENU_POSISI[p.kode], p.kode).toBeTruthy();
  });
});

describe("Coordinator Area terkunci ke areanya sendiri", () => {
  it("hanya boleh membaca dirinya", () => {
    const sainal = orang({ id: "u_sainal", role: "area_coordinator", department: "Operational" });
    expect(picTerkunci(sainal)).toBe("u_sainal");
  });

  it("yang memegang Ringkasan KPI tidak ikut terkunci", () => {
    // Menu itu memang diberikan kepada orang yang tugasnya membaca capaian
    // seluruh departemen.
    const pemantau = orang({ id: "u_x", role: "area_coordinator", department: "Operational", grants: ["kpi"] });
    expect(picTerkunci(pemantau)).toBeNull();
  });

  it("peran lain tidak terkunci", () => {
    expect(picTerkunci(orang({ role: "super_admin" }))).toBeNull();
    expect(picTerkunci(orang({ department: "Creative" }))).toBeNull();
    expect(picTerkunci(null)).toBeNull();
  });
});
