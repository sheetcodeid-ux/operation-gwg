import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canApproveComplaint,
  canForwardComplaint,
  canInputComplaint,
  canResolveComplaint,
  complaintStage,
} from "./complaints-access";
import type { UserProfile } from "./types";

/**
 * Alur komplain: MarComm/Admin memasukkan → Coordinator Area meneruskan ke
 * supervisor → supervisor memperbaiki → Coordinator Area menilai → selesai.
 *
 * Yang diuji di sini bukan "fungsinya jalan", tapi batas antar peran. Satu
 * kelonggaran kecil di sini berarti orang yang diperiksa bisa menilai hasilnya
 * sendiri, atau komplain cabang lain bisa ditugaskan ke orang yang tidak
 * berkepentingan.
 */

const u = (over: Partial<UserProfile>): UserProfile =>
  ({ id: "u1", name: "Tes", email: "t@t.id", role: "member", department: "", active: true, ...over }) as UserProfile;

const marcomm = u({ id: "mc", role: "member", department: "Marketing Communication" });
const ca = u({ id: "ca", role: "area_coordinator", department: "Operational" });
const spv = u({ id: "spv", role: "supervisor", department: "Supervisor" });
const admin = u({ id: "adm", role: "admin_operation", department: "Operational" });
const kreatif = u({ id: "cr", role: "member", department: "Creative" });

describe("siapa boleh memasukkan komplain", () => {
  it("Marketing Communication boleh — merekalah pintu masuk keluhan publik", () => {
    expect(canInputComplaint(marcomm)).toBe(true);
  });

  it("Admin Operation dan Head Operation tetap boleh seperti sebelumnya", () => {
    expect(canInputComplaint(admin)).toBe(true);
    expect(canInputComplaint(u({ role: "head_operation" }))).toBe(true);
  });

  it("anggota divisi lain TIDAK ikut kebagian", () => {
    // Perannya sama-sama `member`. Kalau izinnya diberikan lewat peran dan
    // bukan departemen, seluruh anggota Creative dan Finance ikut bisa.
    expect(canInputComplaint(kreatif)).toBe(false);
  });

  it("supervisor tidak memasukkan komplain — ia yang memperbaiki", () => {
    expect(canInputComplaint(spv)).toBe(false);
  });

  it("aman terhadap sesi kosong", () => {
    expect(canInputComplaint(null)).toBe(false);
    expect(canForwardComplaint(null)).toBe(false);
    expect(canResolveComplaint(null)).toBe(false);
    expect(canApproveComplaint(null)).toBe(false);
  });
});

describe("batas antar peran", () => {
  it("hanya Coordinator Area yang meneruskan", () => {
    expect(canForwardComplaint(ca)).toBe(true);
    expect(canForwardComplaint(spv)).toBe(false);
    expect(canForwardComplaint(marcomm)).toBe(false);
    expect(canForwardComplaint(admin)).toBe(false);
  });

  it("hanya supervisor yang mengerjakan perbaikan", () => {
    expect(canResolveComplaint(spv)).toBe(true);
    expect(canResolveComplaint(ca)).toBe(false);
    expect(canResolveComplaint(marcomm)).toBe(false);
  });

  it("yang diperiksa TIDAK boleh menilai hasilnya sendiri", () => {
    // Inti pemisahan tugasnya: supervisor mengirim, Coordinator Area menilai.
    expect(canApproveComplaint(spv)).toBe(false);
    expect(canApproveComplaint(ca)).toBe(true);
  });

  it("Super Admin boleh semua langkah sebagai jalan darurat", () => {
    const sa = u({ role: "super_admin" });
    expect(canInputComplaint(sa)).toBe(true);
    expect(canForwardComplaint(sa)).toBe(true);
    expect(canResolveComplaint(sa)).toBe(true);
    expect(canApproveComplaint(sa)).toBe(true);
  });

  it("MarComm memantau saja — tidak bisa menyentuh alur perbaikannya", () => {
    expect(canForwardComplaint(marcomm)).toBe(false);
    expect(canResolveComplaint(marcomm)).toBe(false);
    expect(canApproveComplaint(marcomm)).toBe(false);
  });
});

describe("tahap komplain diturunkan dari datanya", () => {
  it("belum diteruskan = baru", () => {
    expect(complaintStage({ status: "open" })).toBe("baru");
    expect(complaintStage({ status: "open", assignment: null, approval: null })).toBe("baru");
  });

  it("sudah diteruskan = dikerjakan", () => {
    expect(complaintStage({ status: "in_progress", assignment: { assignedTo: "spv" } })).toBe("dikerjakan");
  });

  it("bukti sudah dikirim = menunggu verifikasi", () => {
    expect(
      complaintStage({ status: "in_progress", assignment: { assignedTo: "spv" }, approval: { stage: "pending" } }),
    ).toBe("verifikasi");
  });

  it("ditutup = selesai, apa pun isi kolom lainnya", () => {
    expect(complaintStage({ status: "close", assignment: null, approval: null })).toBe("selesai");
    expect(complaintStage({ status: "close", approval: { stage: "pending" } })).toBe("selesai");
  });

  it("verifikasi menang atas dikerjakan — urutannya tidak boleh terbalik", () => {
    // Kalau terbalik, komplain yang buktinya sudah masuk akan terlihat seperti
    // masih dikerjakan, dan Coordinator Area tidak pernah tahu harus menilai.
    const s = complaintStage({
      status: "in_progress",
      assignment: { assignedTo: "spv" },
      approval: { stage: "pending" },
    });
    expect(s).not.toBe("dikerjakan");
  });
});

describe("penegakan di server, bukan di tombol", () => {
  const actions = readFileSync(join(process.cwd(), "src/lib/actions/complaints.ts"), "utf8");
  const bodyOf = (name: string) => {
    const start = actions.indexOf(`export async function ${name}`);
    expect(start, `${name} tidak ditemukan`).toBeGreaterThan(-1);
    const next = actions.indexOf("\nexport ", start + 1);
    return actions.slice(start, next === -1 ? undefined : next);
  };

  it("penerusan memeriksa peran, cakupan outlet, dan arahan wajib", () => {
    const fn = bodyOf("forwardComplaintAction");
    expect(fn).toContain("canForwardComplaint(user)");
    expect(fn).toContain("canAccessOutlet(");
    expect(fn).toContain("Tulis dulu arahan perbaikannya.");
  });

  it("penerima harus benar-benar supervisor outlet itu", () => {
    // Tanpa ini, id supervisor tebakan bisa dipakai menugaskan komplain satu
    // cabang kepada supervisor cabang lain.
    const fn = bodyOf("forwardComplaintAction");
    expect(fn).toContain("complaintSupervisorsAction(complaint.outletId)");
    expect(fn).toContain("Supervisor itu tidak memegang outlet tersebut.");
  });

  it("komplain yang sudah ditutup tidak bisa diteruskan lagi", () => {
    expect(bodyOf("forwardComplaintAction")).toContain('complaint.status === "close"');
  });

  it("kandidat supervisor dicari lewat users.outletIds, bukan outlets.supervisorId", () => {
    // `outlets.supervisorId` di basis data ini menunjuk akun Admin untuk SETIAP
    // outlet; memakainya membuat seluruh komplain terkirim ke Admin.
    const fn = bodyOf("complaintSupervisorsAction");
    expect(fn).toContain("outletIds");
    expect(fn).not.toContain("supervisorId");
    expect(fn).toContain('u.role === "supervisor"');
    expect(fn).toContain("u.active");
  });

  it("setiap aksi mengambil sesinya sendiri, tidak menerima id dari argumen", () => {
    for (const fn of [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1])) {
      expect(bodyOf(fn), `${fn} tidak mengambil sesi`).toContain("await getSessionUser()");
    }
  });
});
