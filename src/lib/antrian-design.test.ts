import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { antrianUntukPic, kelolaAntrianDesign } from "./hc-request";

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
  const rows = [
    { id: "belum-1", assigneeId: null },
    { id: "belum-2", assigneeId: undefined },
    { id: "punya-via", assigneeId: via },
    { id: "punya-seka", assigneeId: seka },
  ];

  it("yang belum ditugaskan terlihat semua orang", () => {
    for (const uid of [via, seka]) {
      const ids = antrianUntukPic(rows, uid).map((r) => r.id);
      expect(ids).toContain("belum-1");
      expect(ids).toContain("belum-2");
    }
  });

  it("pekerjaan rekan tidak ikut terbawa", () => {
    expect(antrianUntukPic(rows, seka).map((r) => r.id)).toEqual(["belum-1", "belum-2", "punya-seka"]);
    expect(antrianUntukPic(rows, via).map((r) => r.id)).toEqual(["belum-1", "belum-2", "punya-via"]);
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
    for (const nama of ["hcDecideRequestAction", "completeHcRequestAction", "assignDesignRequestAction"]) {
      expect(badanFungsi(nama), `${nama} tidak memeriksa kepemilikan design`).toContain("bolehSentuhDesign");
    }
  });
});
