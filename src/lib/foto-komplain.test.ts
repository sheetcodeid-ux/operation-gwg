import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tautanFotoKomplain } from "./complaints-access";

/**
 * Bukti verifikasi komplain tidak boleh disimpan di bucket publik.
 *
 * Dari empat bucket Supabase, hanya `avatars` yang publik — dan memang harus,
 * karena foto profil ditampilkan di topbar setiap halaman tanpa penandatanganan.
 * Foto verifikasi Coordinator Area ikut menumpang ke sana, sehingga bukti
 * kondisi sebuah cabang bisa diambil siapa pun yang tahu jalurnya, tanpa masuk.
 *
 * Belum ada satu pun foto yang tersimpan saat ini, jadi tidak ada yang bocor.
 * Yang dikunci di sini adalah supaya jalurnya tidak kembali lagi ke sana.
 */

describe("fotonya tidak lagi diunggah ke bucket publik", () => {
  const AKSI = readFileSync(join(process.cwd(), "src/lib/actions/complaints.ts"), "utf8");
  const fn = AKSI.slice(AKSI.indexOf("export async function approveComplaintAction"));

  it("tidak menyentuh bucket avatars sama sekali", () => {
    expect(fn).not.toContain('from("avatars")');
    expect(fn).not.toContain("getPublicUrl");
  });

  it("disimpan di R2, atau di bucket privat kalau R2 belum aktif", () => {
    expect(fn).toContain("r2Put(path");
    expect(fn).toContain('from("system-attachments")');
  });

  it("bucket avatars hanya untuk foto profil", () => {
    const AVATAR = readFileSync(join(process.cwd(), "src/lib/actions/avatar.ts"), "utf8");
    expect(AVATAR).toContain('from("avatars")');
    // Kalau ada modul lain yang menulis ke sana, publiknya bucket ini berhenti
    // jadi keputusan tentang foto profil saja.
    expect(AKSI).not.toContain('storage.from("avatars")');
  });
});

describe("yang ditanam di halaman adalah alamat aplikasi, bukan tanda tangan", () => {
  it("jalur simpanan diubah jadi alamat rute berkas", () => {
    expect(tautanFotoKomplain("cmp_1", "r2:complaint-approvals/cmp_1/1.jpg")).toBe(
      "/api/berkas/complaint/cmp_1?p=r2%3Acomplaint-approvals%2Fcmp_1%2F1.jpg",
    );
  });

  it("tautan lama dilewatkan apa adanya — baris lama tidak boleh jadi gambar rusak", () => {
    const lama = "https://xyz.supabase.co/storage/v1/object/public/avatars/a.jpg";
    expect(tautanFotoKomplain("cmp_1", lama)).toBe(lama);
  });

  it("dipakai di layar, bukan cuma tersedia", () => {
    const TABEL = readFileSync(join(process.cwd(), "src/components/complaints/complaint-table.tsx"), "utf8");
    expect(TABEL).toContain("tautanFotoKomplain(complaint.id, a.photoUrl)");
    expect(TABEL).not.toContain("src={a.photoUrl}");
  });
});

describe("rutenya memeriksa hak, bukan sekadar sesi", () => {
  const RUTE = readFileSync(join(process.cwd(), "src/app/api/berkas/complaint/[id]/route.ts"), "utf8");

  it("cakupan cabang diperiksa ulang saat gambarnya diminta", () => {
    expect(RUTE).toContain("canAccessOutlet(user, komplain.outletId");
  });

  it("hanya berkas milik komplain itu — `p` tidak bisa ditukar sembarang kunci", () => {
    expect(RUTE).toContain("komplain.approval?.photoUrl !== jalur");
  });
});
