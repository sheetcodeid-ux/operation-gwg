import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  nextActions,
  requestStage,
  requestSteps,
  stageFilters,
  statusMeta,
  type HcRequest,
  type HcRequestStatus,
} from "./hc-request";

/**
 * Gerbang ACC atasan pada hasil design.
 *
 * Permintaannya satu kalimat — "aku submit, di-ACC dulu, baru terkirim ke
 * SPV" — tapi yang menentukan apakah ia benar-benar berlaku bukan tombolnya,
 * melainkan tiga hal yang diuji di berkas ini:
 *
 *  1. ada tahap tersendiri di antara "dikerjakan" dan "selesai", supaya
 *     keduanya tidak lagi jadi satu tombol;
 *  2. hasil yang menunggu TIDAK ikut terkirim ke pemohon — bukan sekadar tidak
 *     digambar di layarnya;
 *  3. tidak ada pintu belakang yang menutup pengajuan tanpa melewatinya.
 */

const dasar: HcRequest = {
  id: "hcr_1",
  kind: "design",
  department: "Operational",
  requesterId: "u_spv",
  requesterName: "Supervisor Ketapang",
  title: "Poster promo Nordu",
  description: "",
  subjectName: "Nordu Coffee",
  position: null,
  headcount: 0,
  scope: "manajemen",
  outletId: null,
  outletName: null,
  recruited: 0,
  trainingType: null,
  participants: 0,
  participantNames: [],
  budget: 0,
  budgetApproved: 0,
  designType: "Poster / Print Out",
  designSize: "A3",
  plannedDate: null,
  attachments: [],
  status: "disetujui_hc",
  hcNote: "",
  financeNote: "",
  hcByName: null,
  financeByName: null,
  assigneeId: "u_seka",
  assigneeName: "Seka",
  workTaskId: "tsk_1",
  revisions: [],
  hasil: null,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  completedAt: null,
};

const pada = (status: HcRequestStatus, patch: Partial<HcRequest> = {}): HcRequest => ({ ...dasar, status, ...patch });

describe("tahap menunggu ACC berdiri sendiri", () => {
  it("bukan 'selesai' — pekerjaannya jadi, tapi belum sampai", () => {
    expect(requestStage(pada("menunggu_atasan"))).toBe("acc");
  });

  it("juga bukan 'dikerjakan' — tidak ada lagi yang mengerjakannya", () => {
    expect(requestStage(pada("disetujui_hc"))).toBe("dikerjakan");
    expect(requestStage(pada("menunggu_atasan"))).not.toBe("dikerjakan");
  });

  it("riwayat revisi tidak menggeser tahapnya", () => {
    // Revisi mengembalikan design ke `disetujui_hc`; hasil kiriman kedua tetap
    // harus mendarat di ruang tunggu yang sama, bukan di tab "Revisi".
    const revisi = [{ at: "2026-08-02T00:00:00Z", byName: "SPV", note: "warnanya" }];
    expect(requestStage({ kind: "design", status: "menunggu_atasan", revisions: revisi })).toBe("acc");
  });

  it("punya saringan sendiri di antrian design, dan hanya di sana", () => {
    expect(stageFilters("design").map((o) => o.value)).toContain("acc");
    for (const k of ["rekrutmen", "pelatihan"] as const) {
      expect(stageFilters(k).map((o) => o.value)).not.toContain("acc");
    }
  });

  it("labelnya menyebut siapa yang ditunggu", () => {
    expect(statusMeta("design", "menunggu_atasan").label).toBe("Menunggu ACC Atasan");
  });
});

describe("tombol mengikuti tahap, bukan sebaliknya", () => {
  it("designer menyerahkan hasil saat tahap pengerjaan", () => {
    const s = nextActions(pada("disetujui_hc"));
    expect(s.complete).toBe(true);
    expect(s.accAtasan).toBe(false);
  });

  it("atasan memutuskan saat hasilnya menunggu", () => {
    const s = nextActions(pada("menunggu_atasan"));
    expect(s.complete).toBe(false);
    expect(s.accAtasan).toBe(true);
  });

  it("jenis lain tidak pernah punya langkah ACC atasan", () => {
    expect(nextActions({ ...dasar, kind: "rekrutmen", status: "disetujui_hc" }).accAtasan).toBe(false);
    expect(nextActions({ ...dasar, kind: "pelatihan", status: "disetujui_finance" }).accAtasan).toBe(false);
  });
});

describe("alur yang dibaca pemohon", () => {
  const label = (r: HcRequest) => requestSteps(r).map((s) => s.label);

  it("memisahkan 'sedang dikerjakan' dari 'sudah jadi, sedang diperiksa'", () => {
    // Dulu keduanya memakai satu langkah yang sama, jadi pemohon tidak punya
    // cara membedakan pekerjaan yang belum disentuh dari yang tinggal menunggu
    // satu tanda tangan.
    expect(label(pada("disetujui_hc"))).toEqual([
      "Diajukan",
      "Persetujuan Creative",
      "Design Dikerjakan",
      "ACC Atasan",
      "Diterima Pemohon",
    ]);
  });

  it("langkah yang sedang berjalan bergeser mengikuti statusnya", () => {
    const aktif = (r: HcRequest) => requestSteps(r).find((s) => s.state === "current")?.label;
    expect(aktif(pada("disetujui_hc"))).toBe("Design Dikerjakan");
    expect(aktif(pada("menunggu_atasan"))).toBe("ACC Atasan");
    expect(aktif(pada("terlaksana"))).toBeUndefined();
  });

  it("semua langkah tuntas begitu pemohon menerimanya", () => {
    expect(requestSteps(pada("terlaksana")).every((s) => s.state === "done")).toBe(true);
  });

  it("permintaan yang ditolak Creative tidak menampilkan langkah yang tak akan terjadi", () => {
    const langkah = requestSteps(pada("ditolak_hc"));
    expect(langkah.find((s) => s.label === "Persetujuan Creative")?.state).toBe("rejected");
    expect(langkah.filter((s) => s.label !== "Diajukan" && s.label !== "Persetujuan Creative").every((s) => s.state === "todo")).toBe(true);
  });

  it("jenis lain tidak ikut kena langkah design", () => {
    expect(label({ ...dasar, kind: "rekrutmen", status: "disetujui_hc" })).toEqual([
      "Diajukan",
      "Persetujuan Human Capital",
      "Pegawai Diterima",
    ]);
  });
});

/**
 * Yang di atas menjaga bentuk alurnya. Yang di bawah menjaga hal yang jauh
 * lebih mudah bocor tanpa terasa: berkas hasil yang belum di-ACC tidak boleh
 * meninggalkan server, dan tidak boleh ada jalan lain untuk menutup pengajuan.
 */
describe("hasil yang menunggu tidak sampai ke pemohon", () => {
  const aksi = readFileSync(join(process.cwd(), "src/lib/actions/hc-requests.ts"), "utf8");
  const kerja = readFileSync(join(process.cwd(), "src/lib/actions/work.ts"), "utf8");
  const rute = readFileSync(join(process.cwd(), "src/app/api/berkas/pengajuan/[id]/route.ts"), "utf8");

  it("baris untuk pemohon dibersihkan sebelum dikirim", () => {
    // Menyembunyikannya di layar saja tidak cukup: nama berkasnya tetap ikut
    // di muatan halaman dan terbaca siapa pun yang membuka alat pengembang.
    expect(aksi).toContain("function tanpaHasilTertahan");
    const my = aksi.slice(aksi.indexOf("export async function myHcRequestsAction"));
    expect(my.slice(0, my.indexOf("\n}"))).toContain("tanpaHasilTertahan");
  });

  it("berkas hasil hanya bisa dibuka yang mengerjakan dan yang meng-ACC", () => {
    expect(rute).toContain("kelolaAntrianDesign");
    expect(rute).toContain("assigneeId === user.id");
  });

  it("menutup tugas di Work Tracker tidak melewati gerbangnya", () => {
    // Pintu belakang yang paling mudah terlewat: pengajuan design ikut tertutup
    // saat tugasnya ditandai selesai di Work Tracker.
    const blok = kerja.slice(kerja.indexOf("async function syncDesignRequestFromTask"));
    const badan = blok.slice(0, blok.indexOf("\n}"));
    expect(badan).toContain("menunggu_atasan");
    expect(badan).not.toContain('status: "terlaksana"');
  });

  it("berkasnya dipindah ke pemohon hanya lewat satu pintu", () => {
    // Dua jalur menutup pengajuan (pengelola yang mengirim hasilnya sendiri,
    // dan ACC atasan). Keduanya memakai fungsi yang sama supaya tidak ada yang
    // menutup statusnya tapi lupa memindahkan berkasnya.
    expect(aksi.match(/status: "terlaksana"/g)?.length).toBe(2);
    expect(aksi).toContain("async function kirimHasilKePemohon");
  });
});
