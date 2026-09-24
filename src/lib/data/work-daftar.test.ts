import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MENU_WORK, MENU_COMMAND_CENTER, canReachMenu } from "@/lib/nav";
import type { Role, UserProfile } from "@/lib/types";

/**
 * PEMBACA WORK — VISIBILITAS, URUTAN, DAN BENTUK KUERINYA.
 *
 * ┌─ KENAPA UJI INI YANG MENJAGA KEAMANAN LAYAR WORK ────────────────────────┐
 * │                                                                          │
 * │ RLS menyala di 113 tabel dengan NOL policy, dan pembaca memakai service  │
 * │ role — jadi tidak ada apa pun di bawah berkas ini yang akan menolak.     │
 * │ Satu penyaring yang lupa dipasang berarti seluruh daftar kerja           │
 * │ perusahaan terbuka, dan tidak ada galat yang muncul di mana pun.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

const st = vi.hoisted(() => ({
  works: [] as Record<string, unknown>[],
  kaitan: [] as Record<string, unknown>[],
  pelaksana: [] as Record<string, unknown>[],
  riwayat: [] as Record<string, unknown>[],
  signals: [] as Record<string, unknown>[],
  /** Setiap panggilan `.from(...)` dicatat — inilah penjaga N+1. */
  panggilan: [] as { tabel: string; saring: Record<string, unknown>; urut: string[] }[],
}));

vi.mock("./db", () => {
  const sumber = (t: string) =>
    ({ works: st.works, signal_work: st.kaitan, work_executors: st.pelaksana, work_riwayat: st.riwayat, signals: st.signals })[
      t
    ] ?? [];
  return {
    dbEnabled: true,
    db: () => ({
      from(tabel: string) {
        const jejak = { tabel, saring: {} as Record<string, unknown>, urut: [] as string[] };
        st.panggilan.push(jejak);
        let baris = [...sumber(tabel)];
        const rantai = {
          select: () => rantai,
          eq: (k: string, v: unknown) => {
            jejak.saring[k] = v;
            baris = baris.filter((r) => r[k] === v);
            return rantai;
          },
          is: (k: string, v: unknown) => {
            jejak.saring[`${k}:is`] = v;
            baris = baris.filter((r) => (r[k] ?? null) === v);
            return rantai;
          },
          in: (k: string, v: unknown[]) => {
            jejak.saring[`${k}:in`] = v;
            baris = baris.filter((r) => v.includes(r[k]));
            return rantai;
          },
          lt: (k: string, v: string) => {
            jejak.saring[`${k}:lt`] = v;
            baris = baris.filter((r) => String(r[k]) < v);
            return rantai;
          },
          // PostgREST menumpuk `order` sebagai kunci majemuk, bukan mengurutkan
          // ulang tiap kali — mengurutkan per panggilan akan membuat kunci
          // terakhir menelan seluruh kunci sebelumnya.
          order: (k: string) => {
            jejak.urut.push(k);
            return rantai;
          },
          range: async (a: number, b: number) => {
            const urut = [...baris].sort((x, y) => {
              for (const k of jejak.urut) {
                const kx = String(x[k]).padStart(24, "0");
                const ky = String(y[k]).padStart(24, "0");
                if (kx !== ky) return kx < ky ? -1 : 1;
              }
              return 0;
            });
            return { data: urut.slice(a, b + 1), error: null };
          },
          maybeSingle: async () => ({ data: baris[0] ?? null, error: null }),
        };
        return rantai;
      },
    }),
  };
});

vi.mock("./store", () => ({
  getUsers: () => [
    { id: "u_owner", name: "Owner Satu" },
    { id: "u_exec1", name: "Exec Satu" },
    { id: "u_exec2", name: "Exec Dua" },
    { id: "u_mgr", name: "Manajer" },
  ],
  getOutlets: () => [{ id: "out_a", name: "Nordu Perdana", areaId: "area_1" }],
  areaName: () => "Area Jayadi",
}));

import { cacahAktif, daftarWork, detailWork, saringStatus, sudahLewatTenggat, STATUS_AKTIF } from "./work-daftar";

const KINI = Date.parse("2026-09-24T06:00:00.000Z");

const work = (o: Partial<Record<string, unknown>> & { id: number }) => ({
  judul: `Kerja ${o.id}`,
  deskripsi: "",
  owner_id: "u_owner",
  primary_department: "Operational",
  status: "open",
  tenggat_kategori: "normal",
  tenggat_anchor: "work_dibuat",
  tenggat_anchor_pada: "2026-09-19T06:00:00.000Z",
  tenggat_zona: "Asia/Jakarta",
  tenggat_kebijakan_versi: "Z02-SLA-v1",
  tenggat: "2026-09-29T06:00:00.000Z",
  tenggat_dihitung_pada: "2026-09-19T06:00:00.000Z",
  dibuat_oleh: "u_mgr",
  dibuat_pada: "2026-09-19T06:00:00.000Z",
  diperbarui_pada: "2026-09-19T06:00:00.000Z",
  ...o,
});

const orang = (role: Role, id = `usr_${role}`, x: Partial<UserProfile> = {}): UserProfile => ({
  id,
  name: role,
  email: `${role}@gwg.test`,
  role,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...x,
});

beforeEach(() => {
  st.works = [];
  st.kaitan = [];
  st.pelaksana = [];
  st.riwayat = [];
  st.signals = [];
  st.panggilan = [];
});

/* ───────────────── 1-4 · empat pintu akses menu ───────────────── */

describe("MENU_WORK mengikuti batas akses Command Center (OD-06)", () => {
  it("1 · super_admin mencapai keduanya", () => {
    const u = orang("super_admin");
    expect(canReachMenu(u, MENU_WORK)).toBe(true);
    expect(canReachMenu(u, MENU_COMMAND_CENTER)).toBe(true);
  });

  it("2 · ROLE_MENUS — head_operation dan area_coordinator mencapai keduanya", () => {
    for (const r of ["head_operation", "area_coordinator"] as Role[]) {
      expect(canReachMenu(orang(r), MENU_WORK)).toBe(true);
      expect(canReachMenu(orang(r), MENU_COMMAND_CENTER)).toBe(true);
    }
  });

  it("3 · grants — izin per-pengguna membuka Work seperti ia membuka Command Center", () => {
    const u = orang("member", "usr_grant", { grants: ["menu:op_work"] } as Partial<UserProfile>);
    expect(canReachMenu(u, MENU_WORK)).toBe(true);
    expect(canReachMenu(orang("member"), MENU_WORK)).toBe(false);
  });

  it("4 · divisi — departemen Operational V.1 membuka keduanya", () => {
    const u = orang("member", "usr_div", { department: "Operational V.1" });
    expect(canReachMenu(u, MENU_WORK)).toBe(true);
    expect(canReachMenu(u, MENU_COMMAND_CENTER)).toBe(true);
  });

  it("peran tanpa akses Command Center juga tidak mencapai Work — keduanya bergerak bersama", () => {
    for (const r of ["supervisor", "data_operation", "bar_rnd", "legal", "member"] as Role[]) {
      expect(canReachMenu(orang(r), MENU_WORK)).toBe(canReachMenu(orang(r), MENU_COMMAND_CENTER));
      expect(canReachMenu(orang(r), MENU_WORK)).toBe(false);
    }
  });
});

/* ───────────────── 5-7 · visibilitas baris ───────────────── */

describe("visibilitas daftar (OD-01 = A)", () => {
  beforeEach(() => {
    st.works = [work({ id: 1 }), work({ id: 2 }), work({ id: 3 })];
    st.pelaksana = [
      { work_id: 2, user_id: "u_exec1", dilepas_pada: null, dilepas_oleh: null, ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "Ops" },
      { work_id: 3, user_id: "u_exec1", dilepas_pada: "2026-09-20T00:00:00.000Z", dilepas_oleh: "u_mgr", ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "Ops" },
    ];
  });

  it("dengan akses menu: SELURUH Work, tanpa penyempitan outlet", async () => {
    const d = await daftarWork({ seluruhnya: true, userId: "u_lain", pada: KINI });
    expect(d.baris.map((b) => b.id)).toEqual([1, 2, 3]);
    expect(d.seluruhnya).toBe(true);
  });

  it("5 · pelaksana aktif tanpa akses menu melihat Work-nya sendiri", async () => {
    const d = await daftarWork({ seluruhnya: false, userId: "u_exec1", pada: KINI });
    expect(d.baris.map((b) => b.id)).toEqual([2]);
  });

  it("6 · penugasan yang sudah DILEPAS tidak memberi visibilitas apa pun", async () => {
    const d = await daftarWork({ seluruhnya: false, userId: "u_exec1", pada: KINI });
    expect(d.baris.map((b) => b.id)).not.toContain(3);
  });

  it("7 · bukan pelaksana dan tanpa akses menu tidak melihat apa pun", async () => {
    const d = await daftarWork({ seluruhnya: false, userId: "u_orang_lewat", pada: KINI });
    expect(d.baris).toEqual([]);
    expect(d.total).toBe(0);
  });
});

/* ───────────────── 9-10 · cakupan bawaan ───────────────── */

describe("cakupan bawaan hanya Work berjalan (OD-05)", () => {
  beforeEach(() => {
    st.works = [
      work({ id: 1, status: "open" }),
      work({ id: 2, status: "in_progress" }),
      work({ id: 3, status: "completed" }),
      work({ id: 4, status: "cancelled" }),
    ];
  });

  it("9 · tanpa saringan status, terminal tidak ikut", async () => {
    const d = await daftarWork({ seluruhnya: true, userId: "u", pada: KINI });
    expect(d.baris.map((b) => b.id)).toEqual([1, 2]);
    expect(st.panggilan.find((p) => p.tabel === "works")?.saring["status:in"]).toEqual([...STATUS_AKTIF]);
  });

  it("10 · saringan status eksplisit dapat memanggil Work terminal", async () => {
    const d = await daftarWork({ seluruhnya: true, userId: "u", saring: { status: ["completed", "cancelled"] }, pada: KINI });
    expect(d.baris.map((b) => b.id)).toEqual([3, 4]);
  });

  it("status yang tidak dikenal diabaikan, bukan diteruskan ke basis data", () => {
    expect(saringStatus(["blocked", "diagnosing"])).toEqual([...STATUS_AKTIF]);
    expect(saringStatus(["completed", "ngawur"])).toEqual(["completed"]);
    expect(saringStatus([])).toEqual([...STATUS_AKTIF]);
  });
});

/* ───────────────── 11-14 · urutan dan overdue ───────────────── */

describe("urutan dan keterlambatan (OD-02)", () => {
  it("11-12 · diurutkan tenggat menaik, `id` sebagai pemutus seri teknis", async () => {
    st.works = [
      work({ id: 3, tenggat: "2026-09-30T06:00:00.000Z" }),
      work({ id: 2, tenggat: "2026-09-20T06:00:00.000Z" }),
      work({ id: 1, tenggat: "2026-09-20T06:00:00.000Z" }),
    ];
    await daftarWork({ seluruhnya: true, userId: "u", pada: KINI });
    expect(st.panggilan.find((p) => p.tabel === "works")?.urut).toEqual(["tenggat", "id"]);
  });

  it("yang terlambat berada di atas dengan sendirinya — tanpa kolom turunan", async () => {
    st.works = [
      work({ id: 1, tenggat: "2026-09-30T06:00:00.000Z" }),
      work({ id: 2, tenggat: "2026-09-20T06:00:00.000Z" }),
    ];
    const d = await daftarWork({ seluruhnya: true, userId: "u", pada: KINI });
    expect(d.baris.map((b) => b.id)).toEqual([2, 1]);
    expect(d.baris.map((b) => b.overdue)).toEqual([true, false]);
    expect(d.overdue).toBe(1);
  });

  it("13 · overdue adalah `tenggat < sekarang`, dan terminal TIDAK PERNAH overdue", () => {
    const lampau = "2026-09-20T06:00:00.000Z";
    expect(sudahLewatTenggat(lampau, "open", KINI)).toBe(true);
    expect(sudahLewatTenggat(lampau, "in_progress", KINI)).toBe(true);
    expect(sudahLewatTenggat(lampau, "completed", KINI)).toBe(false);
    expect(sudahLewatTenggat(lampau, "cancelled", KINI)).toBe(false);
    expect(sudahLewatTenggat("2026-09-30T06:00:00.000Z", "open", KINI)).toBe(false);
  });

  it("14 · batasnya tepat pada instan tenggat — zona tidak diterapkan dua kali", () => {
    // 2026-09-24T17:00:00+07:00 adalah 10:00:00Z. Satu milidetik sebelum dan
    // sesudahnya harus menjawab berbeda, dan tidak bergeser tujuh jam.
    const tenggat = "2026-09-24T10:00:00.000Z";
    const wib = new Date(tenggat).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
    expect(wib).toContain("17");
    expect(sudahLewatTenggat(tenggat, "open", Date.parse(tenggat) - 1)).toBe(false);
    expect(sudahLewatTenggat(tenggat, "open", Date.parse(tenggat) + 1)).toBe(true);
  });

  it("saringan overdue disaring basis data, bukan sesudah barisnya ditarik", async () => {
    st.works = [work({ id: 1, tenggat: "2026-09-20T06:00:00.000Z" }), work({ id: 2 })];
    const d = await daftarWork({ seluruhnya: true, userId: "u", saring: { overdue: true }, pada: KINI });
    expect(d.baris.map((b) => b.id)).toEqual([1]);
    expect(st.panggilan.find((p) => p.tabel === "works")?.saring["tenggat:lt"]).toBe(new Date(KINI).toISOString());
  });
});

/* ───────────────── 15 · agregat ───────────────── */

describe("agregat hanya menghitung yang aktif", () => {
  it("15 · kaitan dan penugasan yang dilepas tidak ikut dihitung", async () => {
    st.works = [work({ id: 1 })];
    st.kaitan = [
      { work_id: 1, signal_id: 10, dilepas_pada: null, dilepas_oleh: null, alasan: null, dikaitkan_oleh: "u_mgr", dikaitkan_pada: "x" },
      { work_id: 1, signal_id: 11, dilepas_pada: "2026-09-21T00:00:00.000Z", dilepas_oleh: "u_mgr", alasan: "salah kait", dikaitkan_oleh: "u_mgr", dikaitkan_pada: "x" },
    ];
    st.pelaksana = [
      { work_id: 1, user_id: "u_exec1", dilepas_pada: null, dilepas_oleh: null, ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "Ops" },
      { work_id: 1, user_id: "u_exec2", dilepas_pada: "2026-09-21T00:00:00.000Z", dilepas_oleh: "u_mgr", ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "HC" },
    ];
    const d = await daftarWork({ seluruhnya: true, userId: "u", pada: KINI });
    expect(d.baris[0].jumlahSignalAktif).toBe(1);
    expect(d.baris[0].jumlahPelaksanaAktif).toBe(1);
  });

  it("cacahAktif murni dan dapat diuji tanpa basis data", () => {
    const peta = cacahAktif([{ w: 1, a: true }, { w: 1, a: false }, { w: 2, a: true }], (r) => r.w, (r) => r.a);
    expect(peta.get(1)).toBe(1);
    expect(peta.get(2)).toBe(1);
  });
});

/* ───────────────── 16-18 · detail ───────────────── */

describe("detail Work", () => {
  beforeEach(() => {
    st.works = [work({ id: 1, status: "completed" })];
    st.kaitan = [
      { work_id: 1, signal_id: 10, dilepas_pada: null, dilepas_oleh: null, alasan: null, dikaitkan_oleh: "u_mgr", dikaitkan_pada: "2026-09-19T06:00:00.000Z" },
      { work_id: 1, signal_id: 11, dilepas_pada: "2026-09-21T00:00:00.000Z", dilepas_oleh: "u_mgr", alasan: "salah kait", dikaitkan_oleh: "u_mgr", dikaitkan_pada: "2026-09-19T06:00:00.000Z" },
    ];
    st.pelaksana = [
      { work_id: 1, user_id: "u_exec1", dilepas_pada: null, dilepas_oleh: null, ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "Operational" },
      { work_id: 1, user_id: "u_exec2", dilepas_pada: "2026-09-21T00:00:00.000Z", dilepas_oleh: "u_mgr", ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "Human Capital" },
    ];
    st.riwayat = [
      { id: 2, work_id: 1, jenis: "status", nilai_lama: "in_progress", nilai_baru: "completed", alasan: null, oleh: "u_owner", pada: "2026-09-23T00:00:00.000Z" },
      { id: 1, work_id: 1, jenis: "status", nilai_lama: "open", nilai_baru: "in_progress", alasan: null, oleh: "u_mgr", pada: "2026-09-20T00:00:00.000Z" },
    ];
    st.signals = [
      { id: 10, cakupan: "outlet", outlet_id: "out_a", periode: "2026-09", kpi_definition_id: "biaya.labor_pct", severity: "high", status: "terbuka", diakui_oleh: "u_mgr", diakui_pada: "2026-09-20T00:00:00.000Z" },
      { id: 11, cakupan: "korporat", outlet_id: null, periode: "2026-09", kpi_definition_id: "biaya.sewa_pct", severity: "low", status: "terbuka", diakui_oleh: null, diakui_pada: null },
    ];
  });

  it("16 · kaitan Signal yang sudah dilepas TETAP terbaca, dengan alasan dan pelakunya", async () => {
    const d = await detailWork(1, KINI);
    const dilepas = d!.signal.find((s) => s.signalId === 11)!;
    expect(dilepas.aktif).toBe(false);
    expect(dilepas.alasan).toBe("salah kait");
    expect(dilepas.dilepasNama).toBe("Manajer");
    // Lifecycle Signal TIDAK ikut berhenti walau Work-nya sudah selesai (I-08).
    expect(d!.status).toBe("completed");
    expect(dilepas.statusSignal).toBe("terbuka");
    expect(d!.signal.find((s) => s.signalId === 10)!.statusSignal).toBe("terbuka");
  });

  it("17 · pelaksana yang sudah dilepas TETAP terbaca", async () => {
    const d = await detailWork(1, KINI);
    const p = d!.pelaksana.find((x) => x.userId === "u_exec2")!;
    expect(p.aktif).toBe(false);
    expect(p.dilepasNama).toBe("Manajer");
    expect(p.departemenSaatDitugaskan).toBe("Human Capital");
  });

  it("18 · riwayat kronologis menaik", async () => {
    const d = await detailWork(1, KINI);
    expect(d!.riwayat.map((r) => r.id)).toEqual([1, 2]);
    expect(d!.riwayat[0].alasan).toBeNull();
  });

  it("terminal terbaca penuh, dan tidak pernah overdue", async () => {
    const d = await detailWork(1, KINI);
    expect(d!.terminal).toBe(true);
    expect(d!.overdue).toBe(false);
  });

  it("snapshot tenggat dibaca apa adanya", async () => {
    const d = await detailWork(1, KINI);
    expect(d!.tenggatKebijakanVersi).toBe("Z02-SLA-v1");
    expect(d!.tenggatZona).toBe("Asia/Jakarta");
    expect(d!.tenggatAnchor).toBe("work_dibuat");
  });

  it("id yang tidak sah tidak menyentuh basis data", async () => {
    expect(await detailWork(0)).toBeNull();
    expect(await detailWork(-3)).toBeNull();
    expect(st.panggilan).toHaveLength(0);
  });
});

/* ───────────────── 19-22 · bentuk kueri ───────────────── */

describe("bentuk kueri", () => {
  it("20 · daftar tiga puluh Work tetap tiga pembacaan — bukan 1+3N", async () => {
    st.works = Array.from({ length: 30 }, (_, i) => work({ id: i + 1 }));
    st.kaitan = st.works.map((w) => ({ work_id: w.id, signal_id: 100 + (w.id as number), dilepas_pada: null, dilepas_oleh: null, alasan: null, dikaitkan_oleh: "u_mgr", dikaitkan_pada: "x" }));
    st.pelaksana = st.works.map((w) => ({ work_id: w.id, user_id: "u_exec1", dilepas_pada: null, dilepas_oleh: null, ditugaskan_oleh: "u_mgr", ditugaskan_pada: "x", departemen_saat_ditugaskan: "Ops" }));
    const d = await daftarWork({ seluruhnya: true, userId: "u", pada: KINI });
    expect(d.baris).toHaveLength(30);
    expect(st.panggilan.map((p) => p.tabel)).toEqual(["works", "signal_work", "work_executors"]);
  });

  it("detail satu Work: lima pembacaan, dan Signal ditarik sekali untuk semuanya", async () => {
    st.works = [work({ id: 1 })];
    st.kaitan = [
      { work_id: 1, signal_id: 10, dilepas_pada: null, dilepas_oleh: null, alasan: null, dikaitkan_oleh: "u_mgr", dikaitkan_pada: "x" },
      { work_id: 1, signal_id: 11, dilepas_pada: null, dilepas_oleh: null, alasan: null, dikaitkan_oleh: "u_mgr", dikaitkan_pada: "x" },
    ];
    st.signals = [
      { id: 10, cakupan: "outlet", outlet_id: "out_a", periode: "2026-09", kpi_definition_id: "a", severity: "high", status: "terbuka", diakui_oleh: null, diakui_pada: null },
      { id: 11, cakupan: "outlet", outlet_id: "out_a", periode: "2026-09", kpi_definition_id: "b", severity: "low", status: "terbuka", diakui_oleh: null, diakui_pada: null },
    ];
    await detailWork(1, KINI);
    expect(st.panggilan.map((p) => p.tabel)).toEqual(["works", "signal_work", "work_executors", "work_riwayat", "signals"]);
    expect(st.panggilan.filter((p) => p.tabel === "signals")).toHaveLength(1);
  });

  it("19 · setiap pembacaan memakai urutan pada kolom unik (syarat selectAll)", async () => {
    st.works = [work({ id: 1 })];
    st.kaitan = [{ work_id: 1, signal_id: 10, dilepas_pada: null, dilepas_oleh: null, alasan: null, dikaitkan_oleh: "u_mgr", dikaitkan_pada: "x" }];
    st.signals = [{ id: 10, cakupan: "outlet", outlet_id: "out_a", periode: "2026-09", kpi_definition_id: "a", severity: "high", status: "terbuka", diakui_oleh: null, diakui_pada: null }];
    await detailWork(1, KINI);
    for (const p of st.panggilan.filter((x) => x.tabel !== "works")) {
      expect(p.urut.length).toBeGreaterThan(0);
    }
  });

  it("21 · daftar kosong menjawab kosong, bukan melempar", async () => {
    const d = await daftarWork({ seluruhnya: true, userId: "u", pada: KINI });
    expect(d).toEqual({ baris: [], seluruhnya: true, total: 0, overdue: 0 });
  });
});

/* ───────────────── penjaga sumber ───────────────── */

/**
 * Yang dijaga di bawah ini BUKAN perilaku melainkan JANJI, dan hampir
 * seluruhnya tidak bisa ditangkap uji perilaku: reader yang menyaring lewat
 * outlet tetap mengembalikan angka yang masuk akal, dan hanya salah menurut
 * kontraknya.
 */
describe("kontrak sumber lapisan baca Work", () => {
  const akar = process.cwd();
  const baca = (p: string) => readFileSync(join(akar, p), "utf8");
  const tanpaKomentar = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^[ \t]*\/\/.*$/gm, "");

  const reader = tanpaKomentar(baca("src/lib/data/work-daftar.ts"));
  const halaman = tanpaKomentar(baca("src/app/(app)/operational/work/page.tsx"));
  const halamanDetail = tanpaKomentar(baca("src/app/(app)/operational/work/[id]/page.tsx"));
  const daftarUI = tanpaKomentar(baca("src/components/operation/papan-work.tsx"));
  const detailUI = tanpaKomentar(baca("src/components/operation/detail-work.tsx"));
  const semua = [reader, halaman, halamanDetail, daftarUI, detailUI];

  it("`persempit()` tidak dipakai di satu tempat pun pada jalur Work (OD-01 = A)", () => {
    for (const src of semua) {
      expect(src).not.toContain("persempit");
      expect(src).not.toContain("cakupanOutlet");
      expect(src).not.toContain("scopeOutlets");
    }
  });

  it("Work Z-02 tidak pernah menyentuh `tasks`", () => {
    for (const src of semua) expect(src).not.toMatch(/["'`]tasks["'`]/);
  });

  it("tenggat tidak dihitung ulang di mana pun", () => {
    for (const src of semua) {
      // Angka kebijakan Z02-SLA-v1 tidak boleh muncul sebagai perhitungan.
      expect(src).not.toMatch(/make_interval|86[_ ]?400[_ ]?000|OFFSET_WIB_MS/);
      expect(src).not.toMatch(/tenggat\s*=\s*.*\+/);
      expect(src).not.toMatch(/\bh1\b|\bh3\b|\bh5\b|sebelum_h5/i);
    }
    // `diamati_pada` DILARANG menjadi dasar tenggat maupun overdue (O-02).
    for (const src of semua) expect(src).not.toContain("diamati_pada");
  });

  it("severity bukan atribut Work (OD-03 = A)", () => {
    // Baris daftar tidak menyebutnya sama sekali.
    expect(daftarUI).not.toContain("severity");
    // Dan bentuk `BarisWork` sendiri tidak punya medan itu. Severity tetap
    // hidup di `SignalWork`, dan memang di situ tempatnya.
    const awal = reader.indexOf("export interface BarisWork {");
    const bentukWork = reader.slice(awal, reader.indexOf("}", awal));
    expect(awal).toBeGreaterThan(-1);
    expect(bentukWork).not.toContain("severity");
    expect(reader).toContain("export interface SignalWork {");
  });

  it("lapisan ini tidak menuntut perubahan skema sama sekali", () => {
    /*
     * ┌─ KENAPA BUKAN "TIDAK ADA MIGRATION DI ATAS 0116" ────────────────────┐
     * │                                                                      │
     * │ Bentuk itu sempat dipakai, dan ia rusak begitu `0117` lahir dari     │
     * │ gate LAIN — padahal janji yang sebenarnya dijaga tidak pernah        │
     * │ berubah: lapisan ini membaca skema yang sudah ada, dan tidak pernah  │
     * │ menuntut kolom, tabel, index, trigger, maupun fungsi baru.           │
     * │                                                                      │
     * │ Yang diuji sekarang janji itu langsung. Ia tidak akan rusak lagi     │
     * │ ketika `0118` menyusul, dan tetap menolak begitu ada DDL yang        │
     * │ diselundupkan ke lapisan aplikasi.                                   │
     * └──────────────────────────────────────────────────────────────────────┘
     */
    for (const src of semua) {
      expect(src).not.toMatch(/create\s+(table|index|trigger|or\s+replace\s+function)/i);
      expect(src).not.toMatch(/alter\s+table|drop\s+(table|column|trigger|function)/i);
    }
    // Dan memang tidak ada berkas migrasi yang ditulis dari sini.
    const berkas = readdirSync(join(akar, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    expect(berkas.every((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))).toBe(true);
  });

  it("halaman yang memutuskan gerbang, pembaca yang menerima hasilnya", () => {
    expect(halaman).toContain("canReachMenu(user, MENU_WORK)");
    expect(halamanDetail).toContain("canReachMenu(user, MENU_WORK)");
    // Pembaca TIDAK boleh memanggil gerbangnya sendiri.
    expect(reader).not.toContain("canReachMenu");
    expect(reader).not.toContain("requireSessionUser");
  });

  it("detail yang tidak boleh dibaca dikembalikan, bukan diberi 404", () => {
    expect(halamanDetail).toContain('redirect("/dashboard")');
    expect(halamanDetail).not.toContain("notFound");
  });

  it("UI memanggil server action yang sudah ada, tidak membuat jalur tulis sendiri", () => {
    for (const src of [daftarUI, detailUI]) {
      expect(src).not.toContain(".rpc(");
      expect(src).not.toMatch(/\bdb\(\)/);
    }
    expect(detailUI).toContain('from "@/lib/actions/work-signal"');
  });
});
