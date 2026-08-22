import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSystemSupport, timSystemSupport } from "./system-shared";

/**
 * Satu tim boleh saja tidak tertulis di struktur org yang di-hardcode. Yang
 * TIDAK boleh adalah timnya lenyap dari aplikasi karena itu.
 *
 * Ini yang terjadi pada System Support: empat orang aktif, terdaftar rapi di
 * User Management, tapi tidak ada di daftar departemen bawaan. Akibatnya
 * beruntun dan semuanya kelihatan seperti bug terpisah — daftar PIC kosong,
 * anggotanya dilempar ke papan tugas Finance, dan timnya tidak bisa dipilih
 * Super Admin. Satu akar, tiga gejala.
 */

describe("tim System Support dikenali dari keanggotaan tim", () => {
  const pricil = { role: "member", department: "System Support", jabatan: "System Support" };
  const fikri = { role: "member", department: "System Support", jabatan: "IT Help Desk" };
  const spv = { role: "supervisor", department: "Supervisor", jabatan: "Supervisor" };

  it("yang berjabatan System Support ikut, di departemen mana pun ia dicatat", () => {
    expect(timSystemSupport(pricil)).toBe(true);
    expect(timSystemSupport({ department: "Operational", jabatan: "System Support" })).toBe(true);
  });

  it("rekan satu tim yang berjabatan lain juga ikut", () => {
    // Meja ini dikerjakan bersama. Mengeluarkan pemegang IT Help Desk dari
    // daftar hanya memaksa orang menugaskan tiket ke nama yang salah.
    expect(timSystemSupport(fikri)).toBe(true);
  });

  it("di luar tim tetap di luar", () => {
    expect(timSystemSupport(spv)).toBe(false);
    expect(timSystemSupport({ department: "Finance Accounting Tax", jabatan: "Tax" })).toBe(false);
    expect(timSystemSupport(null)).toBe(false);
  });

  it("membuka antrian ditentukan jabatan, mengerjakan tiket ditentukan tim", () => {
    // Dua pertanyaan berbeda, dan bedanya nyata: Fikri boleh dibebani tiket,
    // tapi antrian POS bukan mejanya.
    expect(isSystemSupport(fikri)).toBe(false);
    expect(timSystemSupport(fikri)).toBe(true);
  });

  it("daftar PIC Antrian System memakai keanggotaan tim, bukan dua syarat sekaligus", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(app)/system/antrian/page.tsx"), "utf8");
    expect(src).toContain("timSystemSupport");
    // Syarat lama: departemen "Operational" DAN jabatan "System Support".
    // Tidak satu pun akun memenuhi keduanya, jadi daftarnya selalu kosong.
    expect(src).not.toContain("u.department === SYSTEM_SUPPORT_DEPT &&");
  });
});

describe("daftar departemen mengikuti tempat orang benar-benar terdaftar", () => {
  const src = readFileSync(join(process.cwd(), "src/components/work/work-data.ts"), "utf8");

  it("departemen akun aktif ikut jadi sumber daftar", () => {
    const blok = src.slice(src.indexOf("export async function departmentList"));
    const badan = blok.slice(0, blok.indexOf("\n}"));
    expect(badan).toContain("getUsers()");
    expect(badan).toContain("u.active");
  });

  it("departemen yang tak dikenal TIDAK diganti departemen tim lain", () => {
    // Inti bugnya: `divisions[0]` bukan "tidak ada departemen", melainkan
    // Finance Accounting Tax — tim orang lain, lengkap dengan papan tugasnya.
    expect(src).not.toContain("divisions.includes(user.department) ? user.department : divisions[0]");
    const dash = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8");
    expect(dash).not.toContain("divisions.includes(user.department) ? user.department : divisions[0]");
  });
});
