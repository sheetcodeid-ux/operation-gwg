import { describe, expect, it } from "vitest";
import { bolehKirimLaporanPenilaian, bolehLihatSemuaArea } from "./akses";
import type { UserProfile } from "@/lib/types";

const orang = (p: Partial<UserProfile>): UserProfile =>
  ({ id: "u", name: "U", email: "u@x.id", role: "member", active: true, createdAt: "", ...p }) as UserProfile;

/**
 * Siapa melihat apa, dan siapa boleh mengirim.
 *
 * Dashboard ini menilai orang. Batasnya karena itu bukan soal kerapian menu:
 * rapor wilayah yang bocor ke samping berhenti dipakai sebagai alat evaluasi
 * dan berubah jadi bahan gosip.
 */

describe("siapa melihat seluruh wilayah", () => {
  it("tim Creative membandingkan antar-wilayah — itu memang pekerjaannya", () => {
    expect(bolehLihatSemuaArea(orang({ role: "member", department: "Creative" }))).toBe(true);
  });

  it("super admin melihat semuanya", () => {
    expect(bolehLihatSemuaArea(orang({ role: "super_admin" }))).toBe(true);
  });

  it("Coordinator Area hanya wilayahnya sendiri", () => {
    // Termasuk kalau suatu saat ia diberi izin menu Creative: perannya yang
    // menentukan, bukan menunya.
    expect(bolehLihatSemuaArea(orang({ role: "area_coordinator", department: "Operational" }))).toBe(false);
    expect(bolehLihatSemuaArea(orang({ role: "area_coordinator", grants: ["Creative:creative_design"] }))).toBe(false);
  });

  it("yang tidak masuk sama sekali tidak melihat apa pun", () => {
    expect(bolehLihatSemuaArea(null)).toBe(false);
  });
});

describe("siapa boleh mengirim laporannya", () => {
  it("lebih sempit daripada yang boleh membaca", () => {
    // Laporan ini datang atas nama tim yang mengerjakan desainnya. Kalau siapa
    // pun yang bisa membuka halamannya juga bisa mengirim, yang sampai ke CA
    // bukan lagi penilaian tim Creative.
    expect(bolehKirimLaporanPenilaian(orang({ role: "member", department: "Creative" }))).toBe(true);
    expect(bolehKirimLaporanPenilaian(orang({ role: "area_coordinator" }))).toBe(false);
    expect(bolehKirimLaporanPenilaian(orang({ role: "supervisor" }))).toBe(false);
    expect(bolehKirimLaporanPenilaian(null)).toBe(false);
  });
});
