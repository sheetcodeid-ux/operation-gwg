import { describe, expect, it } from "vitest";
import { canReachMenu, divisiDari, divisionHasMenu, DIVISION_ICON, type MenuKey } from "./nav";

/**
 * Penjaga akses per-departemen.
 *
 * Aturannya sederhana: di dalam departemen sendiri seseorang boleh membuka
 * SEMUA menunya, di luar itu tidak sama sekali. Aturan ini sudah lama ada di
 * kode, tapi selama ini diam-diam tidak pernah berlaku untuk sebagian besar
 * orang — karena nama departemen di data pegawai tidak sama persis dengan nama
 * divisi di sidebar.
 *
 * "Operational" vs "Operation". Selisih satu huruf, dibandingkan dengan `===`,
 * dan hasilnya selalu salah. Gejalanya bukan galat melainkan "menunya terkunci
 * terus", dan penambalnya selama ini memberi izin satu per satu ke tiap orang —
 * yang terlihat wajar padahal hanya menutupi sebabnya.
 *
 * Daftar departemen di bawah diambil dari data produksi yang sebenarnya.
 */
const DEPARTEMEN_NYATA = [
  "Supervisor",
  "Operational",
  "Operation",
  "Finance Accounting Tax",
  "Product Development & Quality",
  "Supply Chain",
  "Marketing Communication",
  "Business Development",
  "Human Capital",
  "Creative",
  "Executive Assistant",
  "Auditor",
  "Production",
];

describe("divisiDari", () => {
  it("menyelaraskan nama yang berbeda tipis", () => {
    expect(divisiDari("Operational")).toBe("Operation");
    expect(divisiDari("Finance Accounting Tax")).toBe("Finance");
  });

  it("tidak peduli huruf besar-kecil dan spasi berlebih", () => {
    expect(divisiDari("  OPERATIONAL  ")).toBe("Operation");
  });

  it("membiarkan nama yang sudah cocok apa adanya", () => {
    expect(divisiDari("Human Capital")).toBe("Human Capital");
    expect(divisiDari("Creative")).toBe("Creative");
  });

  it("mengembalikan nama tak dikenal apa adanya", () => {
    // Divisi buatan admin lewat User Management bernama persis seperti
    // departemennya — memaksakan alias justru akan mematikannya.
    expect(divisiDari("Divisi Baru Buatan Admin")).toBe("Divisi Baru Buatan Admin");
  });

  it("aman untuk nilai kosong", () => {
    expect(divisiDari(null)).toBe("");
    expect(divisiDari(undefined)).toBe("");
    expect(divisiDari("   ")).toBe("");
  });
});

describe("setiap departemen nyata punya rumah", () => {
  it("nama departemen selalu menunjuk divisi yang benar-benar ada", () => {
    const yatim = DEPARTEMEN_NYATA.filter((d) => !(divisiDari(d) in DIVISION_ICON));
    // Departemen tanpa divisi = sidebar kosong sama sekali bagi orang-orangnya.
    expect(yatim).toEqual([]);
  });

  it("setiap departemen bisa membuka setidaknya satu menu khas divisinya", () => {
    const kosong = DEPARTEMEN_NYATA.filter((d) => !divisionHasMenu(divisiDari(d), "work" as MenuKey));
    // "work" (Work Tracker) adalah dasar yang dimiliki setiap divisi selaras
    // departemen. Supervisor & Operation punya menu lapangannya sendiri.
    const dikecualikan = new Set(["Supervisor"]);
    expect(kosong.filter((d) => !dikecualikan.has(d))).toEqual([]);
  });
});

describe("canReachMenu — di dalam departemen penuh, di luar tertutup", () => {
  const orang = (department: string) => ({ role: "member" as const, grants: [], department });

  it("anggota Operation boleh membuka seluruh menu Operation", () => {
    // Inti permintaannya: coordinator area, head operation, dan system support
    // sama-sama melihat halaman departemen Operation.
    for (const menu of ["hygiene", "complaints", "op_fraud", "op_pnl", "outlets", "reports"] as MenuKey[]) {
      expect(canReachMenu(orang("Operational"), menu), menu).toBe(true);
    }
  });

  it("anggota Operation TIDAK bisa masuk departemen lain", () => {
    for (const menu of ["hpp_bahan", "hc_review", "creative_design", "users"] as MenuKey[]) {
      expect(canReachMenu(orang("Operational"), menu), menu).toBe(false);
    }
  });

  it("anggota Human Capital boleh membuka seluruh menu Human Capital", () => {
    for (const menu of ["hcmos", "hc_review", "hc_reqreview", "hc_training", "assessment"] as MenuKey[]) {
      expect(canReachMenu(orang("Human Capital"), menu), menu).toBe(true);
    }
  });

  it("anggota PDQ boleh membuka seluruh menu PDQ, tapi bukan milik Operation", () => {
    for (const menu of ["hpp", "hpp_db", "hpp_bahan", "hpp_price"] as MenuKey[]) {
      expect(canReachMenu(orang("Product Development & Quality"), menu), menu).toBe(true);
    }
    expect(canReachMenu(orang("Product Development & Quality"), "op_fraud" as MenuKey)).toBe(false);
  });

  it("menu perusahaan-luas tetap terbuka untuk semua departemen", () => {
    for (const d of DEPARTEMEN_NYATA) {
      expect(canReachMenu(orang(d), "hc_request" as MenuKey), d).toBe(true);
      expect(canReachMenu(orang(d), "it_submit" as MenuKey), d).toBe(true);
    }
  });

  it("menu Administrator tidak bocor ke departemen mana pun", () => {
    for (const d of DEPARTEMEN_NYATA) {
      expect(canReachMenu(orang(d), "users" as MenuKey), d).toBe(false);
      expect(canReachMenu(orang(d), "audit" as MenuKey), d).toBe(false);
    }
  });
});

describe("kotak masuk kerja tetap milik pemegangnya", () => {
  const orang = (department: string) => ({ role: "member" as const, grants: [], department });

  it("anggota Operation biasa TIDAK bisa membuka Antrian POS maupun Antrian IT", () => {
    // Keduanya kotak masuk pekerjaan, bukan halaman informasi. Kalau ikut
    // terbuka untuk seluruh departemen, tiket bisa ditutup oleh orang yang
    // tidak mengerjakannya dan pemiliknya tidak akan pernah tahu.
    expect(canReachMenu(orang("Operational"), "sys_review" as MenuKey)).toBe(false);
    expect(canReachMenu(orang("Operational"), "it_review" as MenuKey)).toBe(false);
  });

  it("terbuka hanya lewat izin yang disuntikkan berdasarkan jabatan", () => {
    const systemSupport = { role: "member" as const, grants: ["Operation:sys_review"], department: "Operational" };
    const helpdesk = { role: "member" as const, grants: ["Operation:it_review"], department: "Operational" };
    expect(canReachMenu(systemSupport, "sys_review" as MenuKey)).toBe(true);
    expect(canReachMenu(systemSupport, "it_review" as MenuKey)).toBe(false);
    expect(canReachMenu(helpdesk, "it_review" as MenuKey)).toBe(true);
    expect(canReachMenu(helpdesk, "sys_review" as MenuKey)).toBe(false);
  });

  it("sisa menu Operation tetap terbuka penuh untuk keduanya", () => {
    // Pengecualiannya HANYA dua kotak masuk itu — bukan alasan mengunci sisanya.
    expect(canReachMenu(orang("Operational"), "op_fraud" as MenuKey)).toBe(true);
    expect(canReachMenu(orang("Operational"), "hygiene" as MenuKey)).toBe(true);
  });
});
