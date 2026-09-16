import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bidangOrang,
  bolehPunyaWilayah,
  JABATAN_WILAYAH,
  jabatanPemegangWilayah,
  jabatanWilayahUntuk,
  wilayahOrang,
} from "./bidang";

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

describe("jabatan pemegang wilayah", () => {
  it("bentuknya mengikuti Coordinator Area East/West milik Operational", () => {
    expect(JABATAN_WILAYAH["Finance V.1"]).toEqual(["Finance East", "Finance West"]);
    expect(JABATAN_WILAYAH["Marketing V.1"]).toEqual(["Marketing East", "Marketing West"]);
  });

  it("TANPA kata \"Area\" — kalau ada, akunnya berubah jadi Coordinator Area operasional", () => {
    // `isCoordinator` di User Management mengenali Coordinator Area dari pola
    // ini, lalu memaksa peran akunnya jadi `area_coordinator` beserta seluruh
    // menu operasionalnya. Jabatan Finance yang memuat kata itu akan diam-diam
    // memindahkan orangnya ke divisi lain.
    const polaCoordinatorArea = /coordinator\s*area/i;
    for (const daftar of Object.values(JABATAN_WILAYAH)) {
      for (const j of daftar) expect(polaCoordinatorArea.test(j), j).toBe(false);
    }
  });

  it("ditawarkan untuk departemen bidangnya, dan hanya itu", () => {
    expect(jabatanWilayahUntuk("Finance")).toEqual(["Finance East", "Finance West"]);
    expect(jabatanWilayahUntuk("Finance Accounting Tax")).toEqual(["Finance East", "Finance West"]);
    expect(jabatanWilayahUntuk("Marketing Communication")).toEqual(["Marketing East", "Marketing West"]);
    expect(jabatanWilayahUntuk("Supply Chain")).toEqual([]);
    expect(jabatanWilayahUntuk(null)).toEqual([]);
  });

  it("dikenali tanpa peduli besar-kecil huruf dan spasi di ujung", () => {
    expect(jabatanPemegangWilayah({ department: "Finance", jabatan: "Finance East" })).toBe(true);
    expect(jabatanPemegangWilayah({ department: "Finance", jabatan: "  finance west " })).toBe(true);
    expect(jabatanPemegangWilayah({ department: "Marketing Communication", jabatan: "Marketing East" })).toBe(true);
  });

  it("jabatan satu bidang tidak berlaku di bidang sebelahnya", () => {
    expect(jabatanPemegangWilayah({ department: "Finance", jabatan: "Marketing East" })).toBe(false);
    expect(jabatanPemegangWilayah({ department: "Marketing Communication", jabatan: "Finance West" })).toBe(false);
  });
});

describe("hanya jabatan East/West yang punya wilayah", () => {
  it("Accounting dan Tax TIDAK bisa dipegangi outlet", () => {
    // Keputusan pemiliknya: di Finance hanya divisi Finance yang punya wilayah.
    for (const j of ["Accounting & Verification", "Tax", "Treasury", "Head", "", null]) {
      expect(bolehPunyaWilayah({ department: "Finance Accounting Tax", jabatan: j }), String(j)).toBe(false);
    }
  });

  it("yang berjabatan East/West bisa", () => {
    expect(bolehPunyaWilayah({ department: "Finance", jabatan: "Finance East" })).toBe(true);
    expect(bolehPunyaWilayah({ department: "Marketing Communication", jabatan: "Marketing West" })).toBe(true);
  });

  it("yang TERLANJUR dipegangi outlet tetap terbaca, apa pun jabatannya sekarang", () => {
    // Jaring pengaman. Tanpa ini, satu jabatan yang diganti membuat penugasan
    // yang sudah tersimpan diabaikan diam-diam: outletnya masih tercatat atas
    // namanya di basis data, tapi tidak muncul di layar mana pun — dan tidak
    // ada satu pun pesan yang menjelaskannya.
    const pindahJabatan = { department: "Finance", jabatan: "Tax", outletIds: ["a"] };
    expect(bolehPunyaWilayah(pindahJabatan)).toBe(true);
    expect(wilayahOrang(pindahJabatan)).toEqual(["a"]);
  });

  it("di luar Finance dan Marketing tetap tidak, walau jabatannya ditulis East", () => {
    expect(bolehPunyaWilayah({ department: "Supply Chain", jabatan: "Finance East" })).toBe(false);
  });
});
