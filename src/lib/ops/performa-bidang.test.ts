import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bolehPerforma,
  canReachMenu,
  DEPARTEMEN_PERFORMA,
  DIVISION_MENUS,
  NAV_MENUS,
  type MenuKey,
} from "@/lib/nav";

/**
 * FINANCE V.1 DAN MARKETING V.1 — dua bidang yang isinya halaman yang sama
 * dengan Operational V.1, tapi pintunya sendiri.
 *
 * Yang dijaga di sini bukan tampilannya melainkan AKSESNYA, karena di situlah
 * kesalahannya tidak akan terlihat: menu yang salah terbuka memperlihatkan
 * omzet seluruh perusahaan kepada yang tidak berhak, dan menu yang salah
 * terkunci hanya ketahuan kalau orangnya mengeluh.
 */

const menusBidang = (bidang: string): MenuKey[] =>
  DIVISION_MENUS.find((d) => d.division === bidang)?.menus ?? [];

const orang = (department: string) => ({ role: "member" as const, department, grants: [], jabatan: null });

describe("isi kedua bidang", () => {
  it("empat skala, dan TANPA Yearly", () => {
    // Diminta pemiliknya: keduanya memantau pergerakan dalam setahun, bukan
    // perbandingan lima tahun.
    for (const b of ["Finance V.1", "Marketing V.1"]) {
      expect(menusBidang(b), b).toHaveLength(4);
      expect(menusBidang(b).some((k) => k.endsWith("_yearly")), b).toBe(false);
    }
  });

  it("Operational V.1 tidak ikut berkurang", () => {
    // Bidang baru tidak boleh mengambil apa pun dari yang sudah dipakai.
    expect(menusBidang("Operational V.1")).toEqual(["op_daily", "op_weekly", "op_monthly", "op_quarterly", "op_yearly"]);
  });

  it("alamatnya milik bidangnya sendiri", () => {
    const href = (k: MenuKey) => NAV_MENUS.find((m) => m.key === k)!.href;
    for (const k of menusBidang("Finance V.1")) expect(href(k)).toMatch(/^\/finance\//);
    for (const k of menusBidang("Marketing V.1")) expect(href(k)).toMatch(/^\/marketing\//);
  });

  it("tiap alamatnya benar-benar punya halaman", () => {
    // Menu yang alamatnya tidak ada tampil biasa saja di sidebar, lalu
    // menjatuhkan yang menekannya ke halaman 404.
    for (const b of ["Finance V.1", "Marketing V.1"]) {
      for (const k of menusBidang(b)) {
        const href = NAV_MENUS.find((m) => m.key === k)!.href;
        const berkas = join(process.cwd(), "src/app/(app)", href, "page.tsx");
        expect(existsSync(berkas), href).toBe(true);
        expect(readFileSync(berkas, "utf8")).toContain("HalamanPerforma");
      }
    }
  });
});

describe("siapa yang boleh membukanya", () => {
  it("departemennya yang menentukan, bukan perannya", () => {
    expect(bolehPerforma("Finance", "Finance V.1")).toBe(true);
    expect(bolehPerforma("Finance Accounting Tax", "Finance V.1")).toBe(true);
    expect(bolehPerforma("Marketing Communication", "Marketing V.1")).toBe(true);
    expect(bolehPerforma("Sosial Media", "Marketing V.1")).toBe(true);
  });

  it("satu bidang TIDAK membuka bidang sebelahnya", () => {
    expect(bolehPerforma("Finance", "Marketing V.1")).toBe(false);
    expect(bolehPerforma("Marketing Communication", "Finance V.1")).toBe(false);
  });

  it("departemen di luar daftar tidak membuka apa pun", () => {
    // Sengaja daftar nama, bukan kemiripan kata: "Finance Support" yang suatu
    // hari dibuat tidak boleh diam-diam ikut membaca omzet perusahaan.
    for (const b of Object.keys(DEPARTEMEN_PERFORMA)) {
      expect(bolehPerforma("Supply Chain", b), b).toBe(false);
      expect(bolehPerforma("Finance Support", b), b).toBe(false);
      expect(bolehPerforma("", b), b).toBe(false);
      expect(bolehPerforma(null, b), b).toBe(false);
    }
  });

  it("penjaga rutenya sepakat dengan sidebarnya", () => {
    // Menu yang tampil terbuka lalu melempar balik ke dashboard adalah cara
    // paling cepat membuat orang berhenti percaya pada sidebarnya.
    expect(canReachMenu(orang("Finance"), "fin_daily")).toBe(true);
    expect(canReachMenu(orang("Finance"), "fin_quarterly")).toBe(true);
    expect(canReachMenu(orang("Finance"), "mkt_daily")).toBe(false);
    expect(canReachMenu(orang("Marketing Communication"), "mkt_monthly")).toBe(true);
    expect(canReachMenu(orang("Marketing Communication"), "fin_monthly")).toBe(false);
    // Operational V.1 tetap milik perannya, bukan departemennya.
    expect(canReachMenu(orang("Finance"), "op_daily")).toBe(false);
  });
});

describe("Daily milik Finance dan Marketing sama dengan Daily Operational", () => {
  const halaman = readFileSync(join(process.cwd(), "src/components/operation/halaman-performa.tsx"), "utf8");

  it("kalimat pembandingnya kalimat Daily, bukan kalimat umum", () => {
    // `vs hari sama periode lalu` benar secara tata bahasa tapi bukan yang
    // tertulis di Daily. Dua halaman yang isinya sama persis tapi kalimatnya
    // berbeda membuat yang membaca keduanya mengira angkanya juga berbeda.
    expect(halaman).toContain('props.skala === "harian"\n            ? "vs tanggal sama bulan lalu"');
  });

  it("angkanya ditulis penuh, tidak diringkas", () => {
    // Sebulan masih muat penuh; yang diringkas hanya setahun ke atas.
    expect(halaman).toContain('props.skala !== "harian" && props.skala !== "mingguan"');
  });

  it("penavigasinya melangkah per bulan", () => {
    expect(halaman).toContain('props.skala === "harian" || props.skala === "mingguan" ? "bulan" : "tahun"');
  });

  it("TIDAK dipakai Daily milik Operational", () => {
    // Daily yang sudah dipakai tiap hari tetap berjalan di atas jalurnya
    // sendiri — dijaga terpisah di `daily-utuh.test.ts`, diulang di sini
    // supaya yang membaca berkas ini tahu batasnya.
    const daily = readFileSync(join(process.cwd(), "src/app/(app)/operational/daily/page.tsx"), "utf8");
    expect(daily).not.toContain("HalamanPerforma");
  });
});
