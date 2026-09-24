import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_COMMAND_CENTER, MENU_WORK, NAV_MENUS, canReachMenu } from "@/lib/nav";
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

/* ───────────────────── 6. izin membuat Work (Z-02) ───────────────────── */

/**
 * `create_signal_work` — IZIN APLIKASI, DAN HANYA DI SINI.
 *
 * ┌─ KENAPA BUKAN `create_work_task` ────────────────────────────────────────┐
 * │                                                                          │
 * │ `create_work_task` dipegang 12 dari 14 peran, termasuk peran yang tidak  │
 * │ boleh membuka Operational V.1 sama sekali. Memakainya ulang akan memberi │
 * │ hak mengerjakan Signal kepada orang yang tidak boleh melihat Signalnya   │
 * │ (AD-19 · O-06).                                                          │
 * │                                                                          │
 * │ Dan KENAPA di TypeScript, bukan di SQL: AD-20 · C dan O-12 mengunci      │
 * │ otorisasi di lapisan aplikasi. Fungsi penulis `gwg_*` sengaja TIDAK      │
 * │ memeriksa izin apa pun — dua daftar izin untuk satu aturan berarti yang  │
 * │ kedua akan menyimpang diam-diam (AD-20 · J.1).                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
describe("membuat Work dari Signal — hanya pemegang create_signal_work", () => {
  const BOLEH: Role[] = ["super_admin", "head_operation", "area_coordinator"];

  it.each(BOLEH)("%s boleh", (r) => {
    expect(can(orang(r), "create_signal_work")).toBe(true);
  });

  it("peran lain TIDAK boleh — termasuk yang memegang create_work_task", () => {
    const lain: Role[] = [
      "data_operation",
      "pos_operation",
      "admin_operation",
      "supervisor",
      "head_bar_rnd",
      "bar_rnd",
      "kitchen_rnd",
      "coordinator_rnd",
      "legal",
      "assessor",
      "member",
    ];
    for (const r of lain) {
      expect(can(orang(r), "create_signal_work")).toBe(false);
    }
  });

  it("memegang create_work_task TIDAK berarti boleh membuat Work dari Signal", () => {
    const u = orang("member");
    expect(can(u, "create_work_task")).toBe(true);
    expect(can(u, "create_signal_work")).toBe(false);
  });

  it("membuat Work dan mengabaikan Signal dua pintu berbeda", () => {
    const u = orang("area_coordinator");
    expect(can(u, "create_signal_work")).toBe(true);
    expect(can(u, "manage_signals")).toBe(false);
  });

  it("yang tidak boleh membuka Command Center tidak boleh membuat Work", () => {
    for (const r of ["supervisor", "bar_rnd", "data_operation"] as Role[]) {
      expect(canReachMenu(orang(r), MENU_COMMAND_CENTER)).toBe(false);
      expect(can(orang(r), "create_signal_work")).toBe(false);
    }
  });
});

/* ──────────── 7. otorisasi TIDAK disalin ke basis data (AD-20 · J.1) ──────────── */

describe("fungsi penulis Z-02 bukan sumber kebenaran izin", () => {
  const migrasi = readFileSync(
    join(process.cwd(), "supabase/migrations/0116_work_rpc.sql"),
    "utf8",
  );
  // Komentar dibuang lebih dulu: berkas ini menjelaskan panjang lebar KENAPA
  // otorisasi tidak ada di dalamnya, dan penjelasan itu tidak boleh terbaca
  // sebagai pelanggaran oleh penjaganya sendiri.
  const kode = migrasi
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((b) => !b.trimStart().startsWith("--"))
    .join("\n");

  it("tidak menyalin ROLE_PERMISSIONS maupun peta peran→izin", () => {
    for (const pola of ["ROLE_PERMISSIONS", "role_permissions", "create_signal_work", "manage_signals"]) {
      expect(kode).not.toContain(pola);
    }
  });

  it("tidak membaca kolom role siapa pun", () => {
    expect(kode).not.toMatch(/\brole\b/i);
  });

  it("tidak memakai SQL dinamis", () => {
    expect(kode).not.toMatch(/execute\s+(format|immediate)|quote_ident|quote_literal/i);
  });

  it("tidak menyentuh tasks maupun lifecycle Signal", () => {
    expect(kode).not.toMatch(/\btasks\b/);
    expect(kode).not.toMatch(/(update|delete\s+from)\s+signals\b/i);
  });

  it("satu-satunya penjaga beraktor adalah konsistensi owner saat penyelesaian", () => {
    expect(kode).toContain("p_oleh is distinct from v_owner");
  });

  it("keenam fungsi penulis security definer dengan search_path eksplisit", () => {
    const nama = kode.match(/create or replace function (gwg_\w+)/g) ?? [];
    expect(nama).toHaveLength(6);
    expect((kode.match(/security definer/g) ?? []).length).toBe(6);
    // 6 fungsi penulis + 3 fungsi trigger yang diperluas. `work_riwayat_hanya_bertambah`
    // sengaja TIDAK ada di sini: isinya pada `0115` sudah persis yang dituntut kontrak.
    expect((kode.match(/set search_path = public, pg_temp/g) ?? []).length).toBe(9);
  });

  it("keenam fungsi dicabut dari public/anon/authenticated dan hanya service_role", () => {
    expect((kode.match(/revoke all on function gwg_\w+\([^)]*\) from public, anon, authenticated;/g) ?? []).length).toBe(6);
    expect((kode.match(/grant execute on function gwg_\w+\([^)]*\) to service_role;/g) ?? []).length).toBe(6);
  });

  it("tenggat offset murni — tanpa pembulatan akhir hari (AD-20 · J.2)", () => {
    expect(kode).toContain("v_tenggat := v_anchor + make_interval(days => v_hari);");
    expect(kode).not.toMatch(/23:59|date_trunc|end of day/i);
  });
});

/* ──────── 8. MenuKey Work berjalan seiring Command Center (Z-02 · OD-06) ──────── */

/**
 * SATU BATAS AKSES, DUA LAYAR.
 *
 * ┌─ KENAPA SINKRONNYA YANG DIJAGA, BUKAN DAFTAR PERANNYA ───────────────────┐
 * │                                                                          │
 * │ O-06 mengunci VIEW Work sebagai "batas akses Command Center yang sudah   │
 * │ ada, ATAU penugasan executor eksplisit". Batas itu punya EMPAT pintu di  │
 * │ `nav.ts` — peran super admin, `ROLE_MENUS`, izin per-pengguna, dan       │
 * │ keanggotaan divisi. Menambahkan Work hanya ke sebagian di antaranya      │
 * │ melahirkan orang yang melihat Signal tetapi tidak Work, atau            │
 * │ sebaliknya — dan tidak satu pun dari keduanya akan terlihat sebagai      │
 * │ galat.                                                                   │
 * │                                                                          │
 * │ Karena itu yang diuji KESAMAANNYA, bukan daftar peran yang ditulis ulang │
 * │ di sini. Daftar yang disalin akan menyimpang diam-diam; kesamaan tidak.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
describe("MENU_WORK mengikuti batas akses Command Center", () => {
  const SEMUA: Role[] = [
    "super_admin",
    "head_operation",
    "area_coordinator",
    "data_operation",
    "pos_operation",
    "admin_operation",
    "supervisor",
    "head_bar_rnd",
    "bar_rnd",
    "kitchen_rnd",
    "coordinator_rnd",
    "legal",
    "assessor",
    "member",
  ];

  it("pintu 1 & 2 — setiap peran menjawab sama untuk keduanya", () => {
    for (const r of SEMUA) {
      expect(canReachMenu(orang(r), MENU_WORK)).toBe(canReachMenu(orang(r), MENU_COMMAND_CENTER));
    }
  });

  it("ketiga peran yang memegang Command Center memegang Work", () => {
    for (const r of ["super_admin", "head_operation", "area_coordinator"] as Role[]) {
      expect(canReachMenu(orang(r), MENU_WORK)).toBe(true);
    }
  });

  it("pintu 3 — izin per-pengguna membuka Work persis seperti ia membuka Command Center", () => {
    const tanpa = orang("member");
    expect(canReachMenu(tanpa, MENU_WORK)).toBe(false);

    const berizin = orang("member", { grants: ["menu:op_work"] } as Partial<UserProfile>);
    expect(canReachMenu(berizin, MENU_WORK)).toBe(true);

    const berizinSignal = orang("member", { grants: ["menu:op_command"] } as Partial<UserProfile>);
    expect(canReachMenu(berizinSignal, MENU_COMMAND_CENTER)).toBe(true);
  });

  it("pintu 4 — divisi Operational V.1 membuka keduanya", () => {
    const u = orang("member", { department: "Operational V.1" });
    expect(canReachMenu(u, MENU_WORK)).toBe(true);
    expect(canReachMenu(u, MENU_COMMAND_CENTER)).toBe(true);
  });

  it("Work punya rutenya sendiri, dan itu bukan rute Command Center", () => {
    const work = NAV_MENUS.find((m) => m.key === MENU_WORK);
    const signal = NAV_MENUS.find((m) => m.key === MENU_COMMAND_CENTER);
    expect(work?.href).toBe("/operational/work");
    expect(signal?.href).toBe("/operational/command-center");
    expect(work?.href).not.toBe(signal?.href);
  });
});
