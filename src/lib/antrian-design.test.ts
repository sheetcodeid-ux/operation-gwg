import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  antrianUntukPic,
  kelolaAntrianDesign,
  LABEL_SCOPE_MANPOWER,
  PENJELASAN_SCOPE_MANPOWER,
  SCOPE_MANPOWER,
  scopeBawaan,
  scopeManpowerValid,
} from "./hc-request";

/**
 * Aturan yang diuji di sini berasal dari keluhan nyata: Seka membuka Antrian
 * Design dan yang muncul adalah pekerjaan Via. Angkanya kecil, tapi akibatnya
 * tidak — dua orang mengerjakan permintaan yang sama, atau keduanya mengira
 * yang lain sudah mengambilnya.
 */

const orang = (jabatan: string | null, role = "member") => ({ role, jabatan });

describe("kelolaAntrianDesign", () => {
  it("designer bukan pengelola antrian", () => {
    expect(kelolaAntrianDesign(orang("Graphic Designer"))).toBe(false);
    expect(kelolaAntrianDesign(orang("Photo & Videography"))).toBe(false);
  });

  it("Head tim mengelola antrian", () => {
    expect(kelolaAntrianDesign(orang("Head"))).toBe(true);
    expect(kelolaAntrianDesign(orang("Head Creative"))).toBe(true);
    expect(kelolaAntrianDesign(orang("Creative Manager"))).toBe(true);
  });

  it("Super Admin selalu mengelola, apa pun jabatannya", () => {
    expect(kelolaAntrianDesign({ role: "super_admin", jabatan: null })).toBe(true);
    expect(kelolaAntrianDesign({ role: "super_admin", jabatan: "Graphic Designer" })).toBe(true);
  });

  it("tanpa pengguna, tidak ada yang mengelola", () => {
    expect(kelolaAntrianDesign(null)).toBe(false);
    expect(kelolaAntrianDesign(undefined)).toBe(false);
    expect(kelolaAntrianDesign(orang(null))).toBe(false);
  });

  it("dicocokkan per kata, bukan per potongan huruf", () => {
    // "Designer" mengandung "design", dan "Overhead" mengandung "head" — cara
    // pencocokan yang malas akan menjadikan setiap designer pengelola antrian,
    // yaitu persis bug yang sedang diperbaiki.
    expect(kelolaAntrianDesign(orang("Designer"))).toBe(false);
    expect(kelolaAntrianDesign(orang("Overhead Analyst"))).toBe(false);
  });
});

describe("antrianUntukPic", () => {
  const via = "usr_via";
  const seka = "usr_seka";
  const baris = (id, status, assigneeId, revisions = []) =>
    ({ id, kind: "design", status, assigneeId, revisions });

  const rows = [
    baris("baru-1", "menunggu_hc", null),
    baris("baru-2", "menunggu_hc", undefined),
    baris("dikerjakan-via", "disetujui_hc", via),
    baris("dikerjakan-seka", "disetujui_hc", seka),
    baris("revisi-via", "disetujui_hc", via, [{ at: "2026-08-01" }]),
    baris("selesai-via", "terlaksana", via),
    baris("selesai-seka", "terlaksana", seka),
    baris("ditolak-via", "ditolak_hc", via),
    // Baris ganjil: sudah lolos Menunggu tapi tidak ditugaskan ke siapa pun.
    baris("yatim-dikerjakan", "disetujui_hc", null),
    baris("yatim-selesai", "terlaksana", null),
    baris("yatim-ditolak", "ditolak_hc", null),
  ];

  const idsUntuk = (uid: string) => antrianUntukPic(rows, uid).map((r) => r.id);

  it("Menunggu dilihat seluruh tim", () => {
    for (const uid of [via, seka]) {
      expect(idsUntuk(uid)).toContain("baru-1");
      expect(idsUntuk(uid)).toContain("baru-2");
    }
  });

  it("selain Menunggu hanya berisi pekerjaan sendiri", () => {
    expect(idsUntuk(seka)).toEqual(["baru-1", "baru-2", "dikerjakan-seka", "selesai-seka"]);
    expect(idsUntuk(via)).toEqual([
      "baru-1",
      "baru-2",
      "dikerjakan-via",
      "revisi-via",
      "selesai-via",
      "ditolak-via",
    ]);
  });

  it("pekerjaan rekan tidak pernah ikut, di tahap mana pun", () => {
    for (const uid of [via, seka]) {
      const lain = antrianUntukPic(rows, uid).filter((r) => r.assigneeId && r.assigneeId !== uid);
      expect(lain).toEqual([]);
    }
  });

  it("baris tanpa PIC di luar Menunggu tidak muncul di layar designer", () => {
    // Kalau ikut muncul, ia nongol di "Sedang Dikerjakan" milik SEMUA orang
    // padahal tidak ada yang mengerjakannya — persis keluhan yang diperbaiki.
    for (const uid of [via, seka]) {
      const ids = idsUntuk(uid);
      expect(ids).not.toContain("yatim-dikerjakan");
      expect(ids).not.toContain("yatim-selesai");
      expect(ids).not.toContain("yatim-ditolak");
    }
  });

  it("tidak mengubah daftar aslinya", () => {
    const salinan = [...rows];
    antrianUntukPic(rows, seka);
    expect(rows).toEqual(salinan);
  });
});

describe("penyaringan dilakukan di server", () => {
  /**
   * Menyaring HANYA di layar tidak menutup apa pun: aksi servernya tetap bisa
   * dipanggil langsung dan mengembalikan seluruh antrian. Yang diperiksa di
   * sini bukan tampilannya, melainkan bahwa pemotongannya memang terjadi
   * sebelum datanya dikirim.
   */
  const src = readFileSync(join(process.cwd(), "src/lib/actions/hc-requests.ts"), "utf8");

  /**
   * Badan satu fungsi, dipotong pada kurung tutup yang berdiri SENDIRI di awal
   * baris. Mencari "\n}" saja salah: tanda tangan berparameter banyak diakhiri
   * `}: Promise<…> {`, yang juga diawali kurung tutup di awal baris, sehingga
   * badannya terpotong sebelum satu baris pun terbaca.
   */
  function badanFungsi(nama: string): string {
    const mulai = src.indexOf(`export async function ${nama}`);
    expect(mulai, `${nama} tidak ditemukan`).toBeGreaterThan(-1);
    const sisa = src.slice(mulai);
    const akhir = /^\}\s*$/m.exec(sisa);
    return akhir ? sisa.slice(0, akhir.index) : sisa;
  }

  it("allHcRequestsAction memotong antrian design per PIC", () => {
    const isi = badanFungsi("allHcRequestsAction");
    expect(isi).toContain("kelolaAntrianDesign");
    expect(isi).toContain("antrianUntukPic");
  });

  it("aksi yang mengubah satu pengajuan design ikut dijaga", () => {
    for (const nama of ["hcDecideRequestAction", "assignDesignRequestAction", "submitDesignResultAction"]) {
      expect(badanFungsi(nama), `${nama} tidak memeriksa kepemilikan design`).toContain("bolehSentuhDesign");
    }
  });

  it("completeHcRequestAction menolak design sepenuhnya", () => {
    // Penjagaan yang lebih keras daripada memeriksa kepemilikan: menutup design
    // dari sini akan MENGIRIM berkasnya ke pemohon tanpa melewati ACC atasan,
    // jadi jalannya ditutup, bukan dipersempit.
    const isi = badanFungsi("completeHcRequestAction");
    expect(isi).toContain('req.kind === "design"');
    expect(isi).not.toContain("bolehSentuhDesign");
  });

  it("hanya pengelola antrian yang bisa meng-ACC hasil", () => {
    expect(badanFungsi("accDesignResultAction")).toContain("bolehAccHasil");
  });
});

describe("penugasan hanya punya satu pintu masuk", () => {
  /**
   * Tombol penugasan sempat muncul dua kali untuk satu keputusan yang sama:
   * di tahap Menunggu (tempat pekerjaan diambil) dan lagi di "Sedang
   * Dikerjakan". Yang kedua bukan langkah baru, hanya pengulangan — dan
   * pengulangan itulah yang membuat alurnya terbaca seperti ada dua cara
   * berbeda untuk hal yang sama.
   */
  const UI = readFileSync(join(process.cwd(), "src/components/hc/request-review.tsx"), "utf8");

  it("di luar tahap Menunggu, tombolnya hanya untuk pengelola antrian", () => {
    const blok = /\{isDesign && !step\.hc && [^}]*\}/.exec(UI)?.[0] ?? "";
    expect(blok, "blok tombol penugasan tidak ditemukan").not.toBe("");
    expect(blok).toContain("kelola");
    // "Ambil Pekerjaan" adalah tindakan tahap Menunggu; kalau ia muncul lagi di
    // sini, tombolnya kembali dobel untuk yang mengerjakan.
    expect(blok).not.toContain("Ambil Pekerjaan");
  });

  it("design tidak bisa disetujui tanpa menunjuk PIC", () => {
    // Menyetujui tanpa PIC menghasilkan baris "Sedang Dikerjakan" yang tidak
    // ada di daftar siapa pun — lolos dari Menunggu, tapi tak bertuan.
    const dialog = UI.slice(UI.indexOf("function HcDecideDialog"));
    const tombolSetujui = /\{!isDesign && \(\s*<Button onClick=\{\(\) => decide\(true\)\}/.test(dialog);
    expect(tombolSetujui, "tombol Setujui harus disembunyikan untuk design").toBe(true);
  });
});

describe("scope permintaan karyawan", () => {
  /**
   * Hasil Meeting Fitur HRD: permintaan karyawan dipisah Manajemen dan Outlet.
   * Yang mudah tertukar adalah bawaannya — Supervisor memegang satu cabang dan
   * tidak membawahi divisi mana pun, jadi permintaannya selalu permintaan
   * outlet. Bawaan yang salah pada formulir yang diisi berulang kali akan
   * menghasilkan puluhan baris salah scope sebelum ada yang menyadarinya.
   */
  it("Supervisor mengajukan atas nama outlet", () => {
    expect(scopeBawaan("supervisor")).toBe("outlet");
  });

  it("peran kantor mengajukan atas nama manajemen", () => {
    for (const r of ["legal", "head_operation", "member", "area_coordinator", null, undefined]) {
      expect(scopeBawaan(r), String(r)).toBe("manajemen");
    }
  });

  it("hanya dua scope yang sah", () => {
    expect(scopeManpowerValid("manajemen")).toBe(true);
    expect(scopeManpowerValid("outlet")).toBe(true);
    expect(scopeManpowerValid("cabang")).toBe(false);
    expect(scopeManpowerValid("")).toBe(false);
  });

  it("tiap scope punya label dan penjelasan", () => {
    for (const v of SCOPE_MANPOWER) {
      expect(LABEL_SCOPE_MANPOWER[v], v).toBeTruthy();
      expect(PENJELASAN_SCOPE_MANPOWER[v], v).toBeTruthy();
    }
  });

  it("permintaan outlet wajib menyebut cabangnya, dan cabang itu diperiksa", () => {
    // Tanpa pemeriksaan ini, satu supervisor bisa mengajukan penambahan orang
    // atas nama cabang lain — dan yang menanggung anggarannya adalah cabang
    // yang tidak pernah memintanya.
    const src = readFileSync(join(process.cwd(), "src/lib/actions/hc-requests.ts"), "utf8");
    const mulai = src.indexOf("export async function submitHcRequestAction");
    const isi = src.slice(mulai, src.indexOf("\n}", mulai));
    expect(isi).toContain("Pilih outlet yang mengajukan.");
    expect(isi).toContain("canAccessOutlet");
  });
});
