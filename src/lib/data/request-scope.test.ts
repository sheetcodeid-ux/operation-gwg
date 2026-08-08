import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { canSeeRequest, requestScopeFor } from "./request-scope";
import type { UserProfile } from "@/lib/types";

/**
 * Penjaga terhadap kebocoran antar cabang di Pengajuan.
 *
 * Halaman Pengajuan dulu menyaring dengan `department`. Kelihatannya benar,
 * padahal KELIMA PULUH supervisor memakai department yang sama ("Supervisor"),
 * jadi supervisor Singkawang ikut melihat pengajuan Ketapang, Mempawah,
 * Banjarmasin, dan seterusnya.
 *
 * Department memang memisahkan tim kantor (Creative, HC, Finance) tapi sama
 * sekali tidak memisahkan cabang — jadi ia tidak boleh dipakai sebagai satu-
 * satunya penyaring di halaman Pengajuan.
 */

const user = (over: Partial<UserProfile>): UserProfile =>
  ({
    id: "u1",
    name: "Tes",
    email: "t@t.id",
    role: "supervisor",
    department: "Supervisor",
    outletIds: [],
    active: true,
    ...over,
  }) as UserProfile;

describe("cakupan pengajuan", () => {
  it("supervisor hanya melihat pengajuannya sendiri", () => {
    const spv = user({ id: "spv-singkawang", role: "supervisor", department: "Supervisor" });
    expect(requestScopeFor(spv)).toEqual({ requesterIds: ["spv-singkawang"] });
  });

  it("supervisor TIDAK disaring pakai department — semua supervisor sama departemennya", () => {
    const spv = user({ id: "spv-singkawang", role: "supervisor" });
    expect(requestScopeFor(spv).department).toBeUndefined();
  });

  it("supervisor tidak bisa membuka pengajuan supervisor lain", () => {
    const spv = user({ id: "spv-singkawang", role: "supervisor" });
    const punyaKetapang = { requesterId: "spv-ketapang", department: "Supervisor" };
    expect(canSeeRequest(spv, punyaKetapang)).toBe(false);
    expect(canSeeRequest(spv, { requesterId: "spv-singkawang", department: "Supervisor" })).toBe(true);
  });

  it("super admin melihat semuanya", () => {
    const admin = user({ id: "adm", role: "super_admin", department: "" });
    expect(requestScopeFor(admin)).toEqual({});
    expect(canSeeRequest(admin, { requesterId: "siapa pun", department: "apa pun" })).toBe(true);
  });

  it("peran kantor tetap melihat antrean satu departemen", () => {
    const creative = user({ id: "c1", role: "member", department: "Creative" });
    expect(requestScopeFor(creative)).toEqual({ department: "Creative" });
  });
});

/**
 * PIC yang mengerjakan sebuah pengajuan harus bisa membahasnya.
 *
 * `department` pada pengajuan adalah departemen PENGAJU. Untuk pengajuan design
 * dari supervisor, nilainya "Supervisor" — sehingga penyaringan per departemen
 * menolak PIC Creative yang justru sedang mengerjakannya. Akibatnya ia bisa
 * melihat pengajuan itu di Antrian Design tetapi ditolak saat menekan
 * "Diskusikan Pengajuan" di Pesan.
 */
describe("PIC dan tim peninjau", () => {
  const via = user({ id: "via", role: "member", department: "Creative" });
  const designDariSupervisor = {
    requesterId: "spv-basir",
    department: "Supervisor",
    kind: "design",
  };

  it("PIC yang ditugaskan boleh membuka pengajuan yang ia kerjakan", () => {
    expect(canSeeRequest(via, { ...designDariSupervisor, assigneeId: "via" })).toBe(true);
  });

  it("tim Creative boleh membuka pengajuan design walau belum ditugaskan", () => {
    // Mereka memang sudah melihatnya di Antrian Design; menolak di Pesan hanya
    // membuat dua jalur berbeda aturannya untuk pengajuan yang sama.
    expect(canSeeRequest(via, designDariSupervisor)).toBe(true);
  });

  it("orang lain TETAP ditolak — kelonggaran ini tidak melebar", () => {
    const finance = user({ id: "f1", role: "member", department: "Finance Accounting Tax" });
    expect(canSeeRequest(finance, designDariSupervisor)).toBe(false);

    const spvLain = user({ id: "spv-ketapang", role: "supervisor" });
    expect(canSeeRequest(spvLain, designDariSupervisor)).toBe(false);
  });

  it("PIC pengajuan LAIN tetap ditolak", () => {
    expect(canSeeRequest(via, { ...designDariSupervisor, assigneeId: "orang-lain", kind: "rekrutmen" })).toBe(false);
  });

  it("pengaju selalu boleh, tanpa perlu pemeriksaan tambahan di pemanggil", () => {
    const spv = user({ id: "spv-basir", role: "supervisor" });
    expect(canSeeRequest(spv, designDariSupervisor)).toBe(true);
  });
});

describe("halaman Pengajuan tidak menyaring pakai department mentah", () => {
  const dir = join(process.cwd(), "src/app/(app)/pengajuan");
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((e) => {
      const full = join(d, e);
      return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(e) ? [full] : [];
    });

  it("setiap listHcRequests di halaman Pengajuan lewat requestScopeFor", () => {
    const offenders: string[] = [];
    for (const f of walk(dir)) {
      const src = readFileSync(f, "utf8");
      if (!src.includes("listHcRequests(")) continue;
      if (!src.includes("requestScopeFor(")) offenders.push(f.replace(process.cwd() + "/", ""));
      // `department:` yang ditulis langsung ke penyaring = kebocoran yang dulu.
      if (/listHcRequests\(\{[^}]*department:/.test(src)) offenders.push(f.replace(process.cwd() + "/", ""));
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});

describe("hanya Super Admin yang boleh menghapus pengajuan", () => {
  it("aksi hapus memeriksa peran super_admin", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/actions/hc-requests.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function deleteRequestAction"));
    expect(fn).toContain('user.role !== "super_admin"');
  });
});
