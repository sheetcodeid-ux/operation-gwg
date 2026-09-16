import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bidangOrang, bolehPunyaWilayah, wilayahOrang } from "./bidang";

/**
 * WILAYAH DI LUAR COORDINATOR AREA.
 *
 * Fetty memegang outletnya sendiri persis seperti Coordinator Area, tapi
 * perannya `member` — sama dengan seluruh staf kantor yang tidak memegang apa
 * pun. Yang membedakan departemennya, dan itulah yang diuji di sini.
 *
 * Salahnya tidak akan terlihat dari layar: yang terlalu longgar memperlihatkan
 * omzet outlet orang lain, yang terlalu ketat menyembunyikan outlet orangnya
 * sendiri — dan keduanya tampil sebagai tabel berisi angka yang masuk akal.
 */

describe("bidang seseorang", () => {
  it("orang Finance masuk Finance V.1", () => {
    expect(bidangOrang({ department: "Finance" })).toBe("Finance V.1");
    expect(bidangOrang({ department: "Finance Accounting Tax" })).toBe("Finance V.1");
  });

  it("orang Marketing masuk Marketing V.1", () => {
    expect(bidangOrang({ department: "Marketing Communication" })).toBe("Marketing V.1");
  });

  it("tim Sosial Media masuk Marketing lewat JABATAN, bukan departemen", () => {
    // Departemennya Creative. Membuka bidang ini untuk "Creative" berarti
    // membukanya untuk seluruh desainer juga — dan sejak wilayah ikut dipegang
    // di sini, yang terlalu lebar bukan cuma satu menu melainkan omzet outlet
    // orang lain.
    expect(bidangOrang({ department: "Creative", jabatan: "Sosial Media" })).toBe("Marketing V.1");
    expect(bidangOrang({ department: "Creative", jabatan: "Social Media Officer" })).toBe("Marketing V.1");
    expect(bidangOrang({ department: "Creative", jabatan: "Sosmed" })).toBe("Marketing V.1");
    // Desainer biasa TIDAK ikut.
    expect(bidangOrang({ department: "Creative", jabatan: "Graphic Designer" })).toBeNull();
    expect(bidangOrang({ department: "Creative" })).toBeNull();
  });

  it("departemen lain tidak masuk bidang mana pun", () => {
    for (const d of ["Operation", "Supply Chain", "Human Capital", "Finance Support", "", null, undefined]) {
      expect(bidangOrang({ department: d }), String(d)).toBeNull();
      expect(bolehPunyaWilayah({ department: d }), String(d)).toBe(false);
    }
  });

  it("tanpa pengguna sama sekali tidak meledak", () => {
    expect(bidangOrang(null)).toBeNull();
    expect(bidangOrang(undefined)).toBeNull();
    expect(wilayahOrang(null)).toEqual([]);
  });
});

describe("wilayah yang dipegang", () => {
  it("outlet orang bidang itu dikembalikan apa adanya", () => {
    expect(wilayahOrang({ department: "Finance", outletIds: ["a", "b"] })).toEqual(["a", "b"]);
  });

  it("KOSONG berarti melihat seluruh outlet, bukan tidak melihat apa-apa", () => {
    // Halaman yang kosong melompong tidak menjelaskan apa pun: yang membukanya
    // akan mengira datanya belum masuk, bukan mengira dirinya belum ditugaskan.
    // Aturan "hanya jabatan Finance yang punya wilayah" ditegakkan begini —
    // kosongkan outlet Accounting dan Tax, dan mereka melihat semuanya.
    expect(wilayahOrang({ department: "Finance", outletIds: [] })).toEqual([]);
    expect(wilayahOrang({ department: "Finance" })).toEqual([]);
  });

  it("outlet yang menempel pada orang di luar bidang TIDAK terbaca sebagai wilayah bidang", () => {
    // Coordinator Area juga punya `outletIds`. Kalau dibaca di sini, halaman
    // Finance akan terkunci pada wilayah coordinator yang kebetulan membukanya.
    expect(wilayahOrang({ department: "Operation", outletIds: ["a", "b"] })).toEqual([]);
  });
});

describe("yang memakainya", () => {
  it("halaman Performance mengunci pada wilayahnya, dan itu diputuskan di server", () => {
    const h = readFileSync(join(process.cwd(), "src/components/operation/halaman-performa.tsx"), "utf8");
    expect(h).toContain("const milik = bidang ? wilayahOrang(user) : []");
    expect(h).toContain('const terkunci = user.role === "area_coordinator" || milik.length > 0');
  });

  it("Operational V.1 TIDAK ikut berubah — wilayahnya tetap milik Coordinator Area", () => {
    const h = readFileSync(join(process.cwd(), "src/components/operation/halaman-performa.tsx"), "utf8");
    expect(h).toContain("const area = bidang ? daftarPemegangBidang(bidang) : daftarArea();");
    for (const f of ["weekly", "monthly", "quarterly", "yearly"]) {
      const p = readFileSync(join(process.cwd(), `src/app/(app)/operational/${f}/page.tsx`), "utf8");
      expect(p, f).not.toContain("bidang:");
    }
  });

  it("tiap halaman Finance dan Marketing menyebut bidangnya", () => {
    for (const [dir, bidang] of [["finance", "Finance V.1"], ["marketing", "Marketing V.1"]] as const) {
      for (const f of ["daily", "weekly", "monthly", "quarterly"]) {
        const p = readFileSync(join(process.cwd(), `src/app/(app)/${dir}/${f}/page.tsx`), "utf8");
        expect(p, `${dir}/${f}`).toContain(`bidang: "${bidang}"`);
      }
    }
  });

  it("Manajemen Outlet memindahkan tiap lingkup SENDIRI-SENDIRI", () => {
    // Satu outlet memang dipegang coordinator, finance, dan marketing
    // sekaligus. Kalau ketiganya dipindah dengan satu sapuan, mengisi yang
    // satu akan mencabut yang lain tanpa ada yang memintanya.
    const a = readFileSync(join(process.cwd(), "src/lib/actions/outlet-manajemen.ts"), "utf8");
    expect(a).toContain('pindahkan((u) => u.role === "area_coordinator" && !bidangOrang(u), coordinatorId);');
    expect(a).toContain('pindahkan((u) => u.role !== "area_coordinator" && bidangOrang(u) === BIDANG_FINANCE, financeId);');
    expect(a).toContain('pindahkan((u) => u.role !== "area_coordinator" && bidangOrang(u) === BIDANG_MARKETING, marketingId);');
  });
});
