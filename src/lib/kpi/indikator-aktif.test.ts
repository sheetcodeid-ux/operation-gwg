import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bolehAturKpi } from "./akses";
import type { UserProfile } from "@/lib/types";

/**
 * Menyalakan dan mematikan indikator.
 *
 * Mematikan satu indikator mengubah skor SELURUH orang di posisi itu —
 * kewenangan yang sama besarnya dengan mengubah bobotnya, dan dijaga oleh
 * pintu yang sama.
 */

const peran = (role: string) => ({ role, id: "x", name: "x" }) as unknown as UserProfile;

describe("hanya master admin yang boleh mengubahnya", () => {
  it("super admin boleh, peran lain tidak", () => {
    expect(bolehAturKpi(peran("super_admin"))).toBe(true);
    for (const r of ["admin_operation", "area_coordinator", "supervisor", "staff", "data_operation"]) {
      expect(bolehAturKpi(peran(r)), r).toBe(false);
    }
    expect(bolehAturKpi(null)).toBe(false);
  });

  it("dijaga DI SERVER, bukan hanya dengan menyembunyikan tombolnya", () => {
    // Tombol yang disembunyikan tetap bisa dilewati; yang menentukan adalah
    // pemeriksaan di aksi servernya.
    const aksi = readFileSync(join(process.cwd(), "src/lib/actions/kpi.ts"), "utf8");
    const blok = aksi.slice(aksi.indexOf("export async function simpanPengaturanAction"));
    expect(blok).toContain("if (!bolehAturKpi(user))");
    expect(blok).toContain("aktif: u.aktif");
  });
});

describe("yang dimatikan benar-benar keluar dari penilaian", () => {
  const mesin = readFileSync(join(process.cwd(), "src/lib/data/kpi.ts"), "utf8");

  it("disaring di mesin hitung, bukan disembunyikan di layar", () => {
    // Kalau hanya barisnya yang hilang di layar, bobot dan skornya tetap ikut
    // terhitung diam-diam — dan dua orang yang membaca halaman yang sama akan
    // menyebut angka yang berbeda.
    expect(mesin).toContain('const daftar = semuaIndikator.filter((i) => pengaturan.get(i.key)?.aktif !== false);');
  });

  it("tanpa baris pengaturan, indikator dianggap AKTIF", () => {
    // Bawaannya menyala. Kalau sebaliknya, seluruh posisi yang belum pernah
    // disetel akan tampil kosong tanpa satu pun indikator.
    expect(mesin).toContain("aktif: r.aktif !== false,");
  });
});

describe("dialognya tetap bisa menyalakan yang sudah dimatikan", () => {
  const dialog = readFileSync(join(process.cwd(), "src/components/kpi/dialog-pengaturan.tsx"), "utf8");

  it("bobot yang dimatikan tidak ikut dijumlah 100%", () => {
    expect(dialog).toContain("r.aktif ? Number(r.bobot) || 0 : 0");
  });

  it("statusnya dibaca dari ada-tidaknya baris hasil hitung", () => {
    // Indikator yang dimatikan tidak punya baris hasil hitung — itulah
    // tandanya, dan itu pula yang membuat daftar di dialog tetap lengkap.
    expect(dialog).toContain("aktif: !!b,");
  });
});
