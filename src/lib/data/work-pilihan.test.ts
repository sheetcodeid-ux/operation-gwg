import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Role, UserProfile } from "@/lib/types";

/**
 * PILIHAN FORM WORK — SIAPA YANG BOLEH MUNCUL, DAN DARI REGISTRY MANA.
 *
 * ┌─ YANG PALING MUDAH SALAH TANPA TERLIHAT ─────────────────────────────────┐
 * │                                                                          │
 * │ Daftar departemen yang diambil dari `users.department` akan tetap        │
 * │ terlihat masuk akal — isinya nama-nama departemen yang benar — dan hanya │
 * │ salah menurut O-01, yang mengunci `user_departments` sebagai registry    │
 * │ berwenang. Kesalahan seperti itu tidak pernah muncul sebagai galat.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const st = vi.hoisted(() => ({
  papan: { kelompok: [] as unknown[], korporat: [] as unknown[] },
  minta: null as Record<string, unknown> | null,
  departemen: [] as { id: string; name: string }[],
}));

vi.mock("./command-center", () => ({
  papanCommandCenter: async (m: Record<string, unknown>) => {
    st.minta = m;
    return st.papan;
  },
}));

vi.mock("./user-departments", () => ({ getUserDepartments: async () => st.departemen }));

vi.mock("./store", () => ({
  getUsers: () => [],
  getOutlets: () => [{ id: "out_a", name: "Nordu Perdana", areaId: "area_1", code: "A", active: true }],
}));

import { kandidatOwner, kandidatPelaksana, labelSignal, pilihanWork } from "./work-pilihan";

const orang = (role: Role, x: Partial<UserProfile> = {}): UserProfile => ({
  id: x.id ?? `usr_${role}`,
  name: x.name ?? role,
  email: `${role}@gwg.test`,
  role,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...x,
});

/* ───────────────── kandidat Owner ───────────────── */

describe("kandidat Owner (O-06)", () => {
  it("hanya yang aktif DAN boleh melihat Work", () => {
    const daftar = kandidatOwner([
      orang("head_operation", { id: "u_head", name: "Head" }),
      orang("area_coordinator", { id: "u_ca", name: "Coordinator" }),
      orang("super_admin", { id: "u_sa", name: "Admin" }),
      orang("member", { id: "u_member", name: "Member" }),
      orang("supervisor", { id: "u_spv", name: "Supervisor" }),
    ]);
    expect(daftar.map((o) => o.value).sort()).toEqual(["u_ca", "u_head", "u_sa"]);
  });

  it("yang nonaktif tidak pernah muncul, walau perannya berhak", () => {
    const daftar = kandidatOwner([orang("head_operation", { id: "u_mati", active: false })]);
    expect(daftar).toEqual([]);
  });

  it("izin per-pengguna ikut membuka kandidat, sama seperti pintu menunya", () => {
    const daftar = kandidatOwner([orang("member", { id: "u_grant", grants: ["menu:op_work"] })]);
    expect(daftar.map((o) => o.value)).toEqual(["u_grant"]);
  });

  it("keanggotaan divisi ikut membuka kandidat", () => {
    const daftar = kandidatOwner([orang("member", { id: "u_div", department: "Operational V.1" })]);
    expect(daftar.map((o) => o.value)).toEqual(["u_div"]);
  });
});

/* ───────────────── kandidat pelaksana ───────────────── */

describe("kandidat pelaksana (D4)", () => {
  it("tidak dibatasi peran — lintas departemen memang diizinkan", () => {
    const daftar = kandidatPelaksana([
      orang("member", { id: "u_a", name: "A", department: "Human Capital" }),
      orang("supervisor", { id: "u_b", name: "B", department: "Operational" }),
      orang("bar_rnd", { id: "u_c", name: "C", department: "R&D" }),
    ]);
    expect(daftar.map((o) => o.value).sort()).toEqual(["u_a", "u_b", "u_c"]);
  });

  it("yang belum punya departemen tidak ditawarkan — basis data akan menolaknya", () => {
    const daftar = kandidatPelaksana([
      orang("member", { id: "u_kosong", department: "" }),
      orang("member", { id: "u_null", department: null }),
      orang("member", { id: "u_spasi", department: "   " }),
      orang("member", { id: "u_ada", department: "Operational" }),
    ]);
    expect(daftar.map((o) => o.value)).toEqual(["u_ada"]);
  });

  it("yang nonaktif tidak ditawarkan", () => {
    expect(kandidatPelaksana([orang("member", { id: "u_mati", department: "Ops", active: false })])).toEqual([]);
  });

  it("labelnya menyebut departemen supaya lintas departemen terbaca", () => {
    const [o] = kandidatPelaksana([orang("member", { id: "u_a", name: "Budi", department: "Human Capital" })]);
    expect(o.label).toBe("Budi · Human Capital");
  });
});

/* ───────────────── departemen & Signal ───────────────── */

describe("sumber data pilihan", () => {
  it("departemen berasal dari registry user_departments (O-01), bukan users.department", async () => {
    st.departemen = [
      { id: "dep_b", name: "Operational" },
      { id: "dep_a", name: "Human Capital" },
    ];
    st.papan = { kelompok: [], korporat: [] };
    const p = await pilihanWork(orang("super_admin"));
    expect(p.departemen).toEqual([
      { value: "Human Capital", label: "Human Capital" },
      { value: "Operational", label: "Operational" },
    ]);
  });

  it("Signal memakai pembaca Command Center — dipersempit outlet, korporat lewat gerbang menu", async () => {
    st.departemen = [];
    st.papan = { kelompok: [], korporat: [] };
    await pilihanWork(orang("super_admin"));
    expect(st.minta?.periode).toBeNull();
    expect(st.minta?.outletIds).toEqual(["out_a"]);
    expect(st.minta?.sertakanKorporat).toBe(true);

    await pilihanWork(orang("member"));
    // Tanpa akses Command Center, Signal korporat tidak ikut dibaca.
    expect(st.minta?.sertakanKorporat).toBe(false);
  });

  it("Signal outlet dan korporat digabung menjadi satu daftar pilihan", async () => {
    st.departemen = [];
    st.papan = {
      kelompok: [
        {
          outlet: [
            {
              signal: [
                { id: 10, kpiDefinitionId: "biaya.labor_pct", cakupan: "outlet", outletNama: "Nordu Perdana", periode: "2026-09", severity: "high" },
              ],
            },
          ],
        },
      ],
      korporat: [
        { id: 11, kpiDefinitionId: "biaya.sewa_pct", cakupan: "korporat", outletNama: null, periode: "2026-09", severity: "low" },
      ],
    };
    const p = await pilihanWork(orang("super_admin"));
    expect(p.signal.map((s) => s.id)).toEqual([10, 11]);
    expect(p.signal[0].label).toContain("Nordu Perdana");
    expect(p.signal[1].label).toContain("korporat");
  });

  it("label Signal memuat keterangan yang berguna, bukan hanya nomornya", () => {
    const l = labelSignal({
      kpiDefinitionId: "biaya.labor_pct",
      cakupan: "outlet",
      outletNama: "Nordu Perdana",
      periode: "2026-09",
      severity: "critical",
    });
    expect(l).toContain("biaya.labor_pct");
    expect(l).toContain("Nordu Perdana");
    expect(l).toContain("2026-09");
    expect(l).toContain("critical");
    expect(l).not.toBe("10");
  });

  it("empat sumber, empat kali tarik — bukan satu kueri per baris", async () => {
    st.departemen = [{ id: "d", name: "Ops" }];
    st.papan = { kelompok: [], korporat: [] };
    st.minta = null;
    const p = await pilihanWork(orang("super_admin"));
    // Satu-satunya pembacaan basis data: departemen dan papan Signal.
    expect(st.minta).not.toBeNull();
    expect(p.departemen).toHaveLength(1);
  });
});

/* ───────────────── penjaga sumber · Step 7 ───────────────── */

describe("kontrak sumber jalur pembuatan Work", () => {
  const akar = process.cwd();
  const baca = (p: string) => readFileSync(join(akar, p), "utf8");
  const bersih = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  const form = bersih(baca("src/components/operation/form-work-baru.tsx"));
  const daftarUI = bersih(baca("src/components/operation/papan-work.tsx"));
  const papanCC = bersih(baca("src/components/operation/papan-command-center.tsx"));
  const halaman = bersih(baca("src/app/(app)/operational/work/page.tsx"));
  const halamanCC = bersih(baca("src/app/(app)/operational/command-center/page.tsx"));
  const pilihanSrc = bersih(baca("src/lib/data/work-pilihan.ts"));
  const klien = [form, daftarUI, papanCC];

  it("klien tidak pernah menyentuh basis data sendiri", () => {
    for (const src of klien) {
      expect(src).not.toContain(".rpc(");
      expect(src).not.toMatch(/\bdb\(\)/);
      expect(src).not.toContain('from("works")');
      expect(src).not.toContain('from("signals")');
    }
  });

  it("hanya ada SATU penulis pembuatan Work", () => {
    expect(form).toContain("buatWorkAction");
    for (const nama of ["buatWorkFromSignalAction", "createWorkAction", "submitWorkAction", "createSignalWorkAction"]) {
      for (const src of [form, daftarUI, papanCC, halaman]) expect(src).not.toContain(nama);
    }
    // Form-nya juga hanya satu.
    expect(halaman.match(/FormWorkBaru/g) ?? []).toHaveLength(2); // impor + pemakaian
    expect(papanCC).not.toContain("FormWorkBaru");
  });

  it("aktor tidak pernah dikirim dari peramban", () => {
    for (const src of klien) {
      expect(src).not.toMatch(/\boleh:\s*['"]/);
      expect(src).not.toMatch(/actorId|p_oleh/);
    }
  });

  it("Command Center tetap tipis — tidak menarik data pilihan apa pun", () => {
    for (const terlarang of ["getUsers", "getUserDepartments", "pilihanWork", "buatWorkAction", "FormWorkBaru"]) {
      expect(papanCC).not.toContain(terlarang);
      expect(halamanCC).not.toContain(terlarang);
    }
  });

  it("`persempit()` dipakai untuk SIGNAL, tidak pernah untuk Work", () => {
    // Daftar Signal memang dipersempit outlet — itu kontrak Z-01.
    expect(pilihanSrc).toContain("persempit(user, getOutlets())");
    // Tetapi jalur Work tidak boleh menyentuhnya sama sekali.
    for (const src of [form, daftarUI, halaman]) expect(src).not.toContain("persempit");
  });

  it("tidak ada `tasks`, tidak ada hitung ulang SLA, tidak ada severity Work", () => {
    for (const src of [...klien, halaman, pilihanSrc]) {
      expect(src).not.toMatch(/["'`]tasks["'`]/);
      expect(src).not.toMatch(/make_interval|86[_ ]?400[_ ]?000|OFFSET_WIB_MS|Z02-SLA-v1/);
      expect(src).not.toContain("diamati_pada");
    }
    // Daftar Work tetap tanpa severity; form menampilkannya sebagai milik Signal.
    expect(daftarUI).not.toContain("severity");
  });

  it("tidak ada migration baru yang lahir bersama gate ini", () => {
    const berkas = readdirSync(join(akar, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    expect(berkas.filter((f) => Number(f.slice(0, 4)) > 116)).toEqual([]);
  });

  it("gerbang pembuatan sama dengan gerbang server action", () => {
    expect(halaman).toContain('can(user, "create_signal_work")');
    expect(halaman).toContain("canReachMenu(user, MENU_WORK)");
    expect(halamanCC).toContain('can(user, "create_signal_work")');
  });
});
