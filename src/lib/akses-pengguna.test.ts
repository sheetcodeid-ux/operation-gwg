import { describe, expect, it } from "vitest";

import { canReachMenu, landingUntuk, navAll, navOpenPredicate, accessibleMenuKeys, homeDivision, divisiDari } from "./nav";
import { isHelpdeskOwner, isSystemSupport } from "./system-shared";
import type { Role } from "./types";

/**
 * Aturan akses yang pernah menutup pintu bagi orang yang berhak.
 *
 * Tiap uji di sini menahan satu keluhan nyata dari lapangan, bukan kasus
 * karangan — dan itu disengaja: aturan akses jarang diuji tangan karena yang
 * mengujinya biasanya super admin, yang selalu lolos.
 */

const bisaBuka = (u: { role: Role; grants?: string[]; department?: string | null }, seksi: string, key: string) =>
  navOpenPredicate({
    homeDivision: homeDivision(u.role),
    allowedKeys: accessibleMenuKeys(u.role),
    department: divisiDari(u.department),
    grants: u.grants ?? [],
    isAdmin: u.role === "super_admin",
  })({ section: seksi, key: key as never });

describe("Pengajuan & Pesan terbuka untuk semua orang", () => {
  // Seorang desainer Creative yang grant-nya hanya satu.
  const desainer = { role: "member" as Role, department: "Creative", grants: ["Creative:work"] };

  it("desainer dengan satu grant tetap bisa mengajukan dokumen ke HC", () => {
    expect(bisaBuka(desainer, "Creative", "hc_request")).toBe(true);
    expect(canReachMenu(desainer, "hc_request" as never)).toBe(true);
  });

  it("juga bisa melaporkan kendala System dan IT Help Desk", () => {
    expect(canReachMenu(desainer, "sys_submit" as never)).toBe(true);
    expect(canReachMenu(desainer, "it_submit" as never)).toBe(true);
  });

  it("dan tetap bisa berkirim pesan", () => {
    expect(canReachMenu(desainer, "pesan" as never)).toBe(true);
  });

  it("staf tanpa grant sama sekali pun bisa mengajukan", () => {
    const polos = { role: "member" as Role, department: "Supply Chain", grants: [] };
    expect(canReachMenu(polos, "hc_request" as never)).toBe(true);
  });

  it("tapi tidak membuka menu kerja divisi lain", () => {
    expect(bisaBuka(desainer, "Operation", "hygiene")).toBe(false);
    expect(canReachMenu(desainer, "hygiene" as never)).toBe(false);
  });

  it("Administrator tetap dikecualikan — ia konfigurasi aplikasi, bukan tim", () => {
    expect(bisaBuka(desainer, "Administrator", "hc_request")).toBe(false);
  });
});

describe("System Support dikenali dari jabatan, bukan nama departemen", () => {
  it("dikenali meski departemennya bukan Operational", () => {
    // Kasus nyata: departemen dicatat "System Support", bukan "Operational".
    expect(isSystemSupport({ role: "member", department: "System Support", jabatan: "System Support" })).toBe(true);
  });

  it("tetap dikenali bila departemennya memang Operational", () => {
    expect(isSystemSupport({ role: "member", department: "Operational", jabatan: "System Support" })).toBe(true);
  });

  it("jabatan lain di departemen yang sama TIDAK ikut terbuka", () => {
    expect(isSystemSupport({ role: "member", department: "System Support", jabatan: "IT Help Desk" })).toBe(false);
  });

  it("pemegang IT Help Desk dikenali di departemen mana pun", () => {
    expect(isHelpdeskOwner({ role: "member", department: "System Support", jabatan: "IT Help Desk" })).toBe(true);
  });
});

describe("halaman pertama sesudah masuk", () => {
  it("staf Operation TIDAK mendarat di Assessment", () => {
    // Peran `member` berdivisi bawaan Human Capital dengan satu-satunya menu
    // "assessment" — itulah yang dulu menyambut setiap staf kantor dengan
    // "Akun belum terdaftar di assessment" tepat sesudah passwordnya benar.
    const staf = {
      role: "member" as Role,
      department: "Operational",
      grants: ["Operation:dashboard", "Operation:work"],
    };
    expect(landingUntuk(staf)).not.toContain("assessment");
  });

  it("mendarat di menu kerja divisinya sendiri", () => {
    // Keanggotaan departemen membuka seluruh menu divisinya, jadi yang dituntut
    // di sini bukan menu tertentu melainkan: menunya milik divisi ORANG ITU.
    const staf = { role: "member" as Role, department: "Operational", grants: ["Operation:work"] };
    const tujuan = landingUntuk(staf);
    expect(tujuan).not.toContain("assessment");
    expect(navAll().find((i) => i.href === tujuan)?.section).toBe("Operation");
  });

  it("yang grant-nya hanya di divisi lain tetap mendarat di divisi itu", () => {
    const seka = { role: "member" as Role, department: "Creative", grants: ["Creative:work"] };
    const tujuan = landingUntuk(seka);
    expect(navAll().find((i) => i.href === tujuan)?.section).toBe("Creative");
  });

  it("tidak pernah mendarat di Pengajuan meski itu terbuka untuk semua", () => {
    // Kalau menu perusahaan-luas ikut dihitung, ia selalu menang dan SEMUA
    // orang mendarat di Pengajuan.
    const desainer = { role: "member" as Role, department: "Creative", grants: ["Creative:work"] };
    expect(landingUntuk(desainer)).not.toContain("pengajuan");
  });

  it("super admin mendarat di dashboard", () => {
    expect(landingUntuk({ role: "super_admin" as Role, department: null, grants: [] })).toBe("/dashboard");
  });

  it("tanpa akses apa pun tetap memberi tujuan, bukan string kosong", () => {
    expect(landingUntuk({ role: "member" as Role, department: null, grants: [] })).toBeTruthy();
  });
});
