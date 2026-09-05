import { describe, expect, it } from "vitest";
import { canReachMenu, kepalaDepartemen, menuKpi, navOpenPredicate, type MenuKey } from "@/lib/nav";
import { MENU_POSISI, bolehAngkaOutlet, picTerkunci } from "./akses";
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

describe("angka bulanan per outlet", () => {
  it("hanya super admin yang boleh mengubahnya", () => {
    expect(bolehAngkaOutlet(orang({ role: "super_admin" }))).toBe(true);
  });

  it("Coordinator Area tidak boleh — KETIGANYA angka yang menilai dirinya sendiri", () => {
    // Gross Sales, Net Profit, dan Harga Pokok Penjualan sama-sama bergerak
    // searah dengan skornya. Mengecualikan salah satunya — Net Profit sempat
    // dibiarkan terbuka — membuka celah yang persis sama dengan membuka
    // ketiganya.
    expect(bolehAngkaOutlet(orang({ role: "area_coordinator", department: "Operational" }))).toBe(false);
    expect(bolehAngkaOutlet(orang({ department: "Operational" }))).toBe(false);
    expect(bolehAngkaOutlet(orang({ role: "head_operation" }))).toBe(false);
    expect(bolehAngkaOutlet(null)).toBe(false);
  });
});

/**
 * Sidebar dan penjaga rute HARUS sepakat.
 *
 * Sebelumnya tidak: penjaga rute mengizinkan Coordinator Area membuka KPI-nya,
 * sementara sidebar menolak seluruh divisi "Key Performance Indicator" karena
 * ia bukan divisi asal siapa pun. Yang terlihat pengguna bukan dua aturan yang
 * berbeda, melainkan satu menu yang tidak pernah bisa diklik.
 */
describe("divisi Key Performance Indicator terbuka di sidebar", () => {
  const bisaBuka = (u: Partial<UserProfile>, key: MenuKey) => {
    const user = orang(u);
    return navOpenPredicate({
      homeDivision: user.role === "area_coordinator" ? "Operation" : "Human Capital",
      allowedKeys: user.role === "area_coordinator" ? (["kpi_op_ca"] as MenuKey[]) : [],
      department: user.department === "Operational" ? "Operation" : (user.department ?? ""),
      grants: user.grants ?? [],
      isAdmin: user.role === "super_admin",
    })({ section: "Key Performance Indicator", key });
  };

  it("Coordinator Area membuka barisnya sendiri", () => {
    expect(bisaBuka({ role: "area_coordinator", department: "Operational" }, "kpi_op_ca" as MenuKey)).toBe(true);
  });

  it("Coordinator Area TIDAK membuka KPI departemen lain", () => {
    expect(bisaBuka({ role: "area_coordinator", department: "Operational" }, "kpi_fin_tax" as MenuKey)).toBe(false);
    expect(bisaBuka({ role: "area_coordinator", department: "Operational" }, "kpi_creative_content" as MenuKey)).toBe(false);
  });

  it("staf departemen membuka baris departemennya", () => {
    expect(bisaBuka({ department: "Finance" }, "kpi_fin_tax" as MenuKey)).toBe(true);
    expect(bisaBuka({ department: "Finance" }, "kpi_op_ca" as MenuKey)).toBe(false);
  });
});

describe("kepala departemen membaca capaian seluruh posisi", () => {
  it("dikenali dari peran maupun dari jabatan yang diketik", () => {
    expect(kepalaDepartemen(orang({ role: "head_operation" }))).toBe(true);
    expect(kepalaDepartemen(orang({ jabatan: "Head of Finance" }))).toBe(true);
    expect(kepalaDepartemen(orang({ jabatan: "Staff Finance" }))).toBe(false);
    expect(kepalaDepartemen(orang({ role: "area_coordinator" }))).toBe(false);
  });

  it("boleh membuka SETIAP menu KPI", () => {
    const kepala = orang({ jabatan: "Head of Creative", department: "Creative" });
    for (const k of menuKpi()) expect(canReachMenu(kepala, k), k).toBe(true);
  });

  it("Coordinator Area tetap hanya KPI-nya sendiri", () => {
    const sainal = orang({ role: "area_coordinator", department: "Operational" });
    expect(canReachMenu(sainal, "kpi_op_ca" as MenuKey)).toBe(true);
    expect(canReachMenu(sainal, "kpi_fin_tax" as MenuKey)).toBe(false);
    expect(canReachMenu(sainal, "kpi" as MenuKey)).toBe(false);
  });
});
