import { describe, expect, it } from "vitest";
import { MENU_COMMAND_CENTER, canReachMenu } from "@/lib/nav";
import { can } from "@/lib/rbac";
import { persempit } from "./scope-v1";
import type { Outlet, Role, UserProfile } from "@/lib/types";

/**
 * COMMAND CENTER — SIAPA BOLEH MELIHAT APA, DAN SIAPA BOLEH MENGHENTIKAN APA.
 *
 * ┌─ KENAPA UJI INI YANG PALING PENTING DI Z-01 ─────────────────────────────┐
 * │                                                                          │
 * │ Layar ini yang PERTAMA menampilkan angka KORPORAT di Operational V.1.    │
 * │ Seluruh halaman V.1 sebelumnya bersumbu outlet, jadi `persempit()` selalu │
 * │ menjadi jaring terakhirnya. Signal korporat ber-`outlet_id = NULL` dan    │
 * │ TIDAK PERNAH melewati jaring itu — gerbangnya `canReachMenu()`.          │
 * │                                                                          │
 * │ Basis data tidak menolong: RLS menyala di 110+ tabel dengan NOL policy,  │
 * │ dan data layer memakai service role yang mem-bypass-nya. Satu gerbang    │
 * │ yang salah di sini berarti angka seluruh perusahaan terbuka, dan tidak   │
 * │ ada apa pun di bawahnya yang akan menolak.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const orang = (role: Role, x: Partial<UserProfile> = {}): UserProfile => ({
  id: `usr_${role}`,
  name: role,
  email: `${role}@gwg.test`,
  role,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...x,
});

const outlet = (id: string, areaId: string | null = "area_1"): Outlet =>
  ({ id, name: id.toUpperCase(), code: id, areaId, active: true, createdAt: "2026-01-01T00:00:00.000Z" }) as Outlet;

const SEMUA = [outlet("out_a"), outlet("out_b"), outlet("out_c", "area_2")];

/* ───────────────────── 1. akses halaman ───────────────────── */

describe("akses Command Center", () => {
  it("super_admin boleh masuk", () => {
    expect(canReachMenu(orang("super_admin"), MENU_COMMAND_CENTER)).toBe(true);
  });

  it("head_operation boleh masuk", () => {
    expect(canReachMenu(orang("head_operation"), MENU_COMMAND_CENTER)).toBe(true);
  });

  it("area_coordinator boleh masuk", () => {
    expect(canReachMenu(orang("area_coordinator"), MENU_COMMAND_CENTER)).toBe(true);
  });

  it("supervisor TIDAK boleh masuk", () => {
    // Supervisor cabang tidak memegang Operational V.1 sama sekali.
    expect(canReachMenu(orang("supervisor"), MENU_COMMAND_CENTER)).toBe(false);
  });

  it("peran R&D TIDAK boleh masuk", () => {
    expect(canReachMenu(orang("bar_rnd"), MENU_COMMAND_CENTER)).toBe(false);
    expect(canReachMenu(orang("kitchen_rnd"), MENU_COMMAND_CENTER)).toBe(false);
  });

  it("peran operasional kantor yang lain TIDAK boleh masuk", () => {
    // `data_operation` dan `pos_operation` punya cakupan outlet GLOBAL lewat
    // `scopeOutlets`, tapi tidak memegang menu ini. Justru itu sebabnya
    // gerbangnya harus menu, bukan cakupan outlet.
    expect(canReachMenu(orang("data_operation"), MENU_COMMAND_CENTER)).toBe(false);
    expect(canReachMenu(orang("pos_operation"), MENU_COMMAND_CENTER)).toBe(false);
    expect(canReachMenu(orang("admin_operation"), MENU_COMMAND_CENTER)).toBe(false);
  });
});

/* ───────────────────── 2. cakupan outlet ───────────────────── */

describe("cakupan outlet tetap dipersempit", () => {
  it("super_admin melihat seluruh outlet", () => {
    expect(persempit(orang("super_admin"), SEMUA).ids).toEqual(["out_a", "out_b", "out_c"]);
  });

  it("pengguna bercakupan terbatas hanya melihat outlet yang ditugaskan", () => {
    const u = orang("area_coordinator", { outletIds: ["out_b"] });
    expect(persempit(u, SEMUA).ids).toEqual(["out_b"]);
  });

  it("permintaan outlet di luar cakupan dibuang tanpa pesan", () => {
    const u = orang("area_coordinator", { outletIds: ["out_b"] });
    // `?outlet=out_a` dari peramban tidak boleh menembus apa pun.
    expect(persempit(u, SEMUA, ["out_a", "out_b"]).ids).toEqual(["out_b"]);
  });

  it("area_coordinator berareaId hanya melihat area-nya", () => {
    const u = orang("area_coordinator", { areaId: "area_2" });
    expect(persempit(u, SEMUA).ids).toEqual(["out_c"]);
  });
});

/* ───────────────────── 3. korporat TIDAK lewat cakupan outlet ───────────────────── */

describe("korporat tidak pernah melewati penyaring outlet", () => {
  it("cakupan outlet kosong TIDAK berarti korporat ikut tertutup", () => {
    // Inilah sebabnya `sertakanKorporat` disampaikan halaman dari hasil
    // `canReachMenu()`, bukan disimpulkan dari panjang daftar outlet.
    const u = orang("area_coordinator", { outletIds: ["out_tidak_ada"] });
    expect(persempit(u, SEMUA).ids).toEqual([]);
    expect(canReachMenu(u, MENU_COMMAND_CENTER)).toBe(true);
  });

  it("cakupan outlet global TIDAK memberi akses Command Center", () => {
    // `data_operation` melihat seluruh outlet lewat `scopeOutlets`, tapi tidak
    // boleh membuka layar ini — jadi ia juga tidak melihat korporat.
    const u = orang("data_operation");
    expect(persempit(u, SEMUA).ids).toEqual(["out_a", "out_b", "out_c"]);
    expect(canReachMenu(u, MENU_COMMAND_CENTER)).toBe(false);
  });
});

/* ───────────────────── 4. izin mengabaikan ───────────────────── */

describe("mengabaikan Signal — hanya pemegang manage_signals", () => {
  it("super_admin boleh", () => {
    expect(can(orang("super_admin"), "manage_signals")).toBe(true);
  });

  it("head_operation boleh", () => {
    expect(can(orang("head_operation"), "manage_signals")).toBe(true);
  });

  it("area_coordinator TIDAK boleh — walau ia boleh membuka layarnya", () => {
    const u = orang("area_coordinator");
    expect(canReachMenu(u, MENU_COMMAND_CENTER)).toBe(true);
    expect(can(u, "manage_signals")).toBe(false);
  });

  it("supervisor TIDAK boleh", () => {
    expect(can(orang("supervisor"), "manage_signals")).toBe(false);
  });
});

/* ───────────────────── 5. izin mengakui ───────────────────── */

describe("mengakui Signal — mengikuti akses layar, bukan manage_signals", () => {
  it("ketiga peran ber-akses Command Center boleh mengakui", () => {
    for (const r of ["super_admin", "head_operation", "area_coordinator"] as Role[]) {
      expect(canReachMenu(orang(r), MENU_COMMAND_CENTER)).toBe(true);
    }
  });

  it("yang tidak punya akses layar tidak boleh mengakui", () => {
    for (const r of ["supervisor", "bar_rnd", "data_operation"] as Role[]) {
      expect(canReachMenu(orang(r), MENU_COMMAND_CENTER)).toBe(false);
    }
  });

  it("mengakui TIDAK menuntut manage_signals — dua pintu yang berbeda", () => {
    const u = orang("area_coordinator");
    expect(canReachMenu(u, MENU_COMMAND_CENTER) && !can(u, "manage_signals")).toBe(true);
  });
});
