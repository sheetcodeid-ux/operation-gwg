import { describe, expect, it } from "vitest";
import { DIVISI_TANPA_ANGGOTA, canReachMenu, navAll, navOpenPredicate, type MenuKey } from "./nav";
import { accessibleMenuKeys, homeDivision } from "./nav";

/**
 * Daily berdiri di bidangnya sendiri — dan bidang tanpa anggota adalah cara
 * paling mudah membuat sebuah menu terkunci untuk semua orang tanpa disadari:
 * tak seorang pun berdepartemen "Operational V.1", jadi aturan "departemennya
 * sama" tidak akan pernah cocok.
 */
describe("Operational V.1", () => {
  const daily = "op_daily" as MenuKey;

  it("punya bidang sendiri, bukan di dalam Operation", () => {
    const baris = navAll().filter((i) => i.key === daily);
    expect(baris.map((b) => b.section)).toEqual(["Operational V.1"]);
  });

  it("bidangnya tidak bisa dijadikan departemen seseorang", () => {
    // Kalau bisa dipilih di User Management, yang memilihnya keluar dari
    // Operation dan kehilangan seluruh menu operasionalnya.
    expect(DIVISI_TANPA_ANGGOTA).toContain("Operational V.1");
  });

  it("Coordinator Area bisa membukanya", () => {
    const co = { role: "area_coordinator" as const, department: "Operation", grants: [] };
    expect(canReachMenu(co, daily)).toBe(true);
  });

  it("super admin bisa membukanya", () => {
    expect(canReachMenu({ role: "super_admin" as const, department: "Administrator", grants: [] }, daily)).toBe(true);
  });

  it("yang bukan orang operasional tetap tertutup", () => {
    const lain = { role: "member" as const, department: "Creative", grants: [] };
    expect(canReachMenu(lain, daily)).toBe(false);
  });

  it("barisnya benar-benar tampil di sidebar Coordinator Area", () => {
    // Hak membuka rutenya tidak ada gunanya kalau barisnya tidak pernah
    // muncul: yang tidak terlihat sama saja dengan tidak ada.
    const bisa = navOpenPredicate({
      homeDivision: homeDivision("area_coordinator"),
      allowedKeys: accessibleMenuKeys("area_coordinator"),
      department: "Operation",
      grants: [],
      isAdmin: false,
    });
    const baris = navAll().find((i) => i.key === daily)!;
    expect(bisa(baris)).toBe(true);
  });
});
