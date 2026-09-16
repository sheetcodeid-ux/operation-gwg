import { describe, expect, it } from "vitest";
import { bolehBacaOutlet, cakupanBidang, cakupanOutlet, persempit } from "./scope-v1";
import type { Outlet, Role, UserProfile } from "@/lib/types";

/**
 * CAKUPAN OUTLET — yang diuji di sini siapa boleh membaca omzet siapa.
 *
 * Basis data ini punya RLS aktif di 110 tabel dan NOL policy, dan data layer
 * memakai service role — jadi setiap query mem-bypass RLS. Tidak ada apa pun di
 * bawah lapisan kode ini yang akan menolak permintaan yang terlalu lebar.
 *
 * Artinya berkas uji ini BUKAN pelengkap jaring pengaman, melainkan
 * penggantinya. Yang lolos dari sini lolos sampai ke layar.
 *
 * Diuji pada tingkat server — fungsi yang benar-benar menentukan baris mana
 * yang dikirim — bukan pada penyaring tampilan. Baris yang cuma disembunyikan
 * di peramban tetap terkirim ke peramban, dan siapa pun bisa membacanya dari
 * sana.
 */

/* ───────────────────────────── contoh data ───────────────────────────── */

const outlet = (id: string, extra: Partial<Outlet> = {}): Outlet =>
  ({
    id,
    name: `Outlet ${id}`,
    code: `K-${id}`,
    city: "Pontianak",
    areaId: "area-1",
    supervisorId: null,
    picId: null,
    active: true,
    esbBranchId: `${id}-fnb`,
    ...extra,
  }) as Outlet;

const SEMUA: Outlet[] = [
  outlet("o1"),
  outlet("o2"),
  outlet("o3", { areaId: "area-2" }),
  outlet("o4", { areaId: "area-2", supervisorId: "spv-1" }),
  outlet("o5", { esbBranchId: null }), // aktif tapi belum punya cabang ESB
];

const orang = (role: Role, extra: Partial<UserProfile> = {}): UserProfile =>
  ({
    id: `u-${role}`,
    name: role,
    email: `${role}@gwg.test`,
    role,
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...extra,
  }) as UserProfile;

/* ───────────────────── matriks lima peran ───────────────────── */

describe("lima peran terhadap outlet di dalam dan di luar cakupan", () => {
  it("super_admin: seluruh outlet", () => {
    const c = cakupanOutlet(orang("super_admin"), SEMUA);
    expect(c.ids).toEqual(["o1", "o2", "o3", "o4", "o5"]);
    expect(c.alasan).toBe("global");
    expect(c.seluruhnya).toBe(true);
  });

  it("head_operation DENGAN penugasan: hanya outletnya", () => {
    const c = cakupanOutlet(orang("head_operation", { outletIds: ["o1", "o2"] }), SEMUA);
    expect(c.ids).toEqual(["o1", "o2"]);
    expect(c.ids).not.toContain("o3");
    expect(c.alasan).toBe("ditugaskan");
  });

  it("area_coordinator: outlet yang ditugaskan, bukan yang lain", () => {
    const c = cakupanOutlet(orang("area_coordinator", { outletIds: ["o3"] }), SEMUA);
    expect(c.ids).toEqual(["o3"]);
    for (const luar of ["o1", "o2", "o4", "o5"]) expect(c.ids).not.toContain(luar);
    expect(c.alasan).toBe("ditugaskan");
  });

  it("area_coordinator TANPA penugasan tapi punya areaId: outlet areanya", () => {
    const c = cakupanOutlet(orang("area_coordinator", { areaId: "area-2" }), SEMUA);
    expect(c.ids).toEqual(["o3", "o4"]);
    expect(c.alasan).toBe("area");
  });

  it("supervisor: hanya outlet yang disupervisinya", () => {
    const c = cakupanOutlet(orang("supervisor", { id: "spv-1" }), SEMUA);
    expect(c.ids).toEqual(["o4"]);
    expect(c.alasan).toBe("supervisi");
  });

  it("supervisor yang tidak menyupervisi apa pun: kosong, bukan semuanya", () => {
    // Ini yang membedakan supervisor dari peran lain: aturan existing memberinya
    // daftar kosong, bukan melepasnya.
    const c = cakupanOutlet(orang("supervisor", { id: "spv-lain" }), SEMUA);
    expect(c.ids).toEqual([]);
    expect(c.seluruhnya).toBe(false);
  });

  it("member DENGAN penugasan: hanya outletnya", () => {
    const c = cakupanOutlet(orang("member", { department: "Finance", outletIds: ["o2", "o5"] }), SEMUA);
    expect(c.ids).toEqual(["o2", "o5"]);
    expect(c.ids).not.toContain("o1");
    expect(c.alasan).toBe("ditugaskan");
  });
});

describe("aturan existing yang mengejutkan, diikuti apa adanya", () => {
  /**
   * `scopeOutlets` (`src/lib/rbac.ts:95-107`) melepas siapa pun yang tidak
   * masuk salah satu cabang sebelumnya. Jadi `member` dan `head_operation`
   * tanpa penugasan TIDAK dibatasi.
   *
   * Yang menahan mereka pintu menu (`canReachMenu`), yang berjalan lebih dulu
   * di tiap halaman — bukan fungsi ini. Diuji supaya keadaannya tercatat, bukan
   * karena keadaannya baik. Menutupnya di sini berarti dua aturan cakupan yang
   * berbeda dalam satu aplikasi, dan yang kedua akan tampak seperti bug pada
   * halaman lama.
   */
  it("member tanpa penugasan TIDAK dibatasi — ini keadaan existing", () => {
    const c = cakupanOutlet(orang("member", { department: "Finance" }), SEMUA);
    expect(c.ids).toEqual(["o1", "o2", "o3", "o4", "o5"]);
    expect(c.alasan).toBe("tanpa-batas");
  });

  it("head_operation tanpa penugasan TIDAK dibatasi — ini keadaan existing", () => {
    const c = cakupanOutlet(orang("head_operation"), SEMUA);
    expect(c.seluruhnya).toBe(true);
    expect(c.alasan).toBe("tanpa-batas");
  });

  it("penugasan boleh memakai KODE POS, bukan hanya id", () => {
    // Penugasan lama menyimpan kode POS. Kalau ini tidak diikuti, coordinator
    // lama mendadak kehilangan seluruh outletnya.
    const c = cakupanOutlet(orang("area_coordinator", { outletIds: ["K-o1"] }), SEMUA);
    expect(c.ids).toEqual(["o1"]);
  });
});

describe("alasan selalu sepakat dengan cakupannya", () => {
  it("tidak ada peran yang alasannya berbeda dari hasilnya", () => {
    const kasus: UserProfile[] = [
      orang("super_admin"),
      orang("data_operation"),
      orang("admin_operation"),
      orang("head_operation", { outletIds: ["o1"] }),
      orang("head_operation"),
      orang("area_coordinator", { outletIds: ["o3"] }),
      orang("area_coordinator", { areaId: "area-2" }),
      orang("area_coordinator"),
      orang("supervisor", { id: "spv-1" }),
      orang("member", { outletIds: ["o2"] }),
      orang("member"),
    ];
    for (const u of kasus) {
      const c = cakupanOutlet(u, SEMUA);
      // "global" dan "tanpa-batas" wajib menghasilkan seluruhnya; sisanya tidak.
      const bebas = c.alasan === "global" || c.alasan === "tanpa-batas";
      expect(c.seluruhnya, `${u.role}/${c.alasan}`).toBe(bebas);
    }
  });
});

describe("cabang ESB dalam cakupan", () => {
  it("outlet tanpa cabang ESB tidak menyumbang cabang", () => {
    const c = cakupanOutlet(orang("super_admin"), SEMUA);
    expect(c.cabang).toEqual(["o1-fnb", "o2-fnb", "o3-fnb", "o4-fnb"]);
    expect(c.cabang).toHaveLength(4); // o5 tidak punya
    expect(c.ids).toHaveLength(5); // tapi tetap ikut sebagai outlet
  });
});

describe("permintaan dari peramban dipersempit, bukan dipercaya", () => {
  const ca = orang("area_coordinator", { outletIds: ["o3", "o4"] });

  it("yang diminta di dalam cakupan diberikan", () => {
    expect(persempit(ca, SEMUA, ["o3"]).ids).toEqual(["o3"]);
  });

  it("yang diminta di LUAR cakupan dibuang diam-diam", () => {
    // Dibuang tanpa galat: pesan galat yang menyebut outlet orang lain sudah
    // membocorkan keberadaannya.
    expect(persempit(ca, SEMUA, ["o1", "o2"]).ids).toEqual([]);
  });

  it("campuran: hanya yang sah yang lolos", () => {
    expect(persempit(ca, SEMUA, ["o1", "o3", "o5"]).ids).toEqual(["o3"]);
  });

  it("tanpa permintaan berarti seluruh cakupannya", () => {
    expect(persempit(ca, SEMUA).ids).toEqual(["o3", "o4"]);
  });

  it("id karangan tidak menghasilkan apa pun", () => {
    expect(persempit(ca, SEMUA, ["'; drop table outlets; --", "o999"]).ids).toEqual([]);
  });
});

describe("boleh baca satu outlet", () => {
  it("sepakat dengan cakupannya", () => {
    const ca = orang("area_coordinator", { outletIds: ["o3"] });
    expect(bolehBacaOutlet(ca, "o3", SEMUA)).toBe(true);
    expect(bolehBacaOutlet(ca, "o1", SEMUA)).toBe(false);
    expect(bolehBacaOutlet(orang("super_admin"), "o1", SEMUA)).toBe(true);
  });
});

describe("bidang Finance dan Marketing", () => {
  it("orang bidang dikenali, yang lain null", () => {
    expect(cakupanBidang(orang("member", { department: "Finance" }), SEMUA)).not.toBeNull();
    expect(cakupanBidang(orang("member", { department: "Marketing Communication" }), SEMUA)).not.toBeNull();
    expect(cakupanBidang(orang("member", { department: "Supply Chain" }), SEMUA)).toBeNull();
    expect(cakupanBidang(orang("supervisor"), SEMUA)).toBeNull();
  });

  it("wilayahnya tetap membatasi", () => {
    const fin = orang("member", { department: "Finance", outletIds: ["o2"] });
    expect(cakupanBidang(fin, SEMUA)?.ids).toEqual(["o2"]);
  });
});

describe("daftar outlet kosong", () => {
  it("tidak meledak, dan tidak memberi apa pun", () => {
    const c = cakupanOutlet(orang("super_admin"), []);
    expect(c.ids).toEqual([]);
    expect(c.cabang).toEqual([]);
  });
});
