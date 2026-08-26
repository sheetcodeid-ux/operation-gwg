import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HC_CONTRACT_LIKE,
  HC_DOC_LABEL,
  HC_DOC_TYPES,
  HC_NEEDS_CHRONOLOGY,
  HC_PROMOSI_LIKE,
  HC_STATUS_META,
  type HcDocType,
  type HcStatus,
} from "./hc-shared";

/**
 * Dua permintaan Human Capital atas Pengajuan Dokumen Karyawan.
 *
 * Keduanya kecil di layar tapi menutup lubang yang nyata: satu jenis surat yang
 * memang diterbitkan HC tapi tidak ada di daftar, dan pengajuan batal yang
 * tidak punya cara ditutup sehingga menggantung di antrian selamanya.
 */

describe("Surat Promosi ada di daftar dan punya isiannya sendiri", () => {
  it("muncul sebagai pilihan, bukan hanya sebagai tipe", () => {
    // Pernah terjadi sebaliknya: tipe ditambahkan di union tapi lupa di daftar
    // dropdown, jadi jenisnya "ada" tapi tidak bisa dipilih siapa pun.
    expect(HC_DOC_TYPES.map((d) => d.value)).toContain("promosi");
    expect(HC_DOC_LABEL.promosi).toBe("Surat Promosi");
  });

  it("setiap jenis di dropdown punya labelnya, tidak ada yang tertinggal", () => {
    for (const d of HC_DOC_TYPES) {
      expect(HC_DOC_LABEL[d.value], `${d.value} tidak punya label`).toBeTruthy();
    }
  });

  it("bukan jenis kontrak — promosi tidak punya durasi", () => {
    // Menumpangkannya ke formulir kontrak akan menanyakan "Durasi Kontrak"
    // untuk surat yang tidak mengenal durasi.
    expect(HC_CONTRACT_LIKE).not.toContain("promosi" as HcDocType);
    expect(HC_PROMOSI_LIKE).toContain("promosi" as HcDocType);
  });

  it("tidak menuntut kronologi — promosi bukan pelanggaran", () => {
    expect(HC_NEEDS_CHRONOLOGY).not.toContain("promosi" as HcDocType);
  });

  it("formulirnya menanyakan jabatan lama, karena suratnya menyebut keduanya", () => {
    const FORM = readFileSync(join(process.cwd(), "src/components/hc/hc-submit.tsx"), "utf8");
    expect(FORM).toContain("HC_PROMOSI_LIKE.includes(docType)");
    expect(FORM).toContain("previousPosition");
    expect(FORM).toContain("Jabatan Sebelumnya");
  });
});

describe("pengajuan batal bisa ditutup, tidak menggantung", () => {
  it("punya statusnya sendiri, bukan ditumpangkan ke Selesai", () => {
    // Menandainya "selesai" berarti mencatat dokumen terbit padahal tidak
    // pernah ada — dan angka di dasbor ikut berbohong.
    expect(HC_STATUS_META.rejected).toBeTruthy();
    expect(HC_STATUS_META.rejected.label).toBe("Dibatalkan");
  });

  it("setiap status punya labelnya", () => {
    for (const s of ["waiting", "processing", "pending", "done", "rejected"] as HcStatus[]) {
      expect(HC_STATUS_META[s]?.label, `${s} tidak punya label`).toBeTruthy();
    }
  });

  const AKSI = readFileSync(join(process.cwd(), "src/lib/actions/hc.ts"), "utf8");
  const DATA = readFileSync(join(process.cwd(), "src/lib/data/hc.ts"), "utf8");
  const REVIEW = readFileSync(join(process.cwd(), "src/components/hc/hc-review.tsx"), "utf8");

  it("alasannya WAJIB — pengajuan tidak boleh hilang tanpa keterangan", () => {
    const fn = AKSI.slice(AKSI.indexOf("export async function rejectHcRequestAction"));
    expect(fn.slice(0, 1200)).toContain("Tulis dulu alasan pembatalannya.");
  });

  it("yang sudah selesai tidak bisa dibatalkan — dokumennya sudah terbit", () => {
    const fn = AKSI.slice(AKSI.indexOf("export async function rejectHcRequestAction"));
    expect(fn.slice(0, 1200)).toContain('rec.status === "done"');
  });

  it("pemohonnya diberi tahu, bukan dibiarkan menebak", () => {
    const fn = AKSI.slice(AKSI.indexOf("export async function rejectHcRequestAction"));
    expect(fn.slice(0, 2200)).toContain("saveNotification");
    expect(fn.slice(0, 2200)).toContain("targetUser: rec.supervisor_id");
  });

  it("pembatalan menyimpan jejaknya, bukan menghapus barisnya", () => {
    const fn = DATA.slice(DATA.indexOf("export async function rejectHcSubmission"));
    expect(fn.slice(0, 800)).toContain('status: "rejected"');
    expect(fn.slice(0, 800)).toContain("processed_by: userId");
    expect(fn.slice(0, 800)).not.toContain(".delete()");
  });

  it("hanya menutup yang belum selesai", () => {
    const fn = DATA.slice(DATA.indexOf("export async function rejectHcSubmission"));
    expect(fn.slice(0, 800)).toContain('.in("status", ["waiting", "processing", "pending"])');
  });

  it("tombolnya ada di semua tahap yang belum selesai, bukan hanya Menunggu", () => {
    // Pembatalan paling sering datang justru setelah HC mulai mengerjakan:
    // cabang menarik permintaannya, atau orangnya keluar lebih dulu.
    expect(REVIEW).toContain("{!locked && !dibatalkan && (");
    expect(REVIEW).toContain("rejectHcRequestAction");
  });

  it("Dibatalkan bisa disaring di kedua sisi", () => {
    const FORM = readFileSync(join(process.cwd(), "src/components/hc/hc-submit.tsx"), "utf8");
    expect(REVIEW).toContain('{ value: "rejected", label: "Dibatalkan" }');
    expect(FORM).toContain('"done", "rejected"');
  });
});
