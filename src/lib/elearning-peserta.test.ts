import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bolehIkut, pesertaEfektif, subjectTerbuka } from "./elearning-peserta";

const baca = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const orang = (id: string, department = "Operational") => ({ id, name: id, department });

/**
 * Peserta per subject E-Learning.
 *
 * Yang dikunci di sini satu aturan dan seluruh akibatnya, karena aturan inilah
 * yang paling mudah salah dibaca setahun lagi:
 *
 *   Subject TANPA daftar peserta berarti TERBUKA untuk semua.
 *
 * Bukan "belum diisi". Kalau suatu saat ada yang membalik artinya jadi
 * "tertutup", seluruh course yang sudah berjalan mendadak kehilangan seluruh
 * pesertanya sekaligus — tanpa galat, tanpa pesan, dan yang menyadarinya adalah
 * karyawan yang materinya hilang.
 */

describe("aturan kosong = terbuka", () => {
  it("subject tanpa peserta terbuka untuk semua", () => {
    expect(subjectTerbuka([])).toBe(true);
    expect(bolehIkut([], "usr_sembarang")).toBe(true);
  });

  it("begitu satu nama ditambahkan, subject berhenti terbuka", () => {
    expect(subjectTerbuka(["usr_a"])).toBe(false);
    expect(bolehIkut(["usr_a"], "usr_a")).toBe(true);
    expect(bolehIkut(["usr_a"], "usr_b")).toBe(false);
  });

  it("peserta efektif: kosong berarti seluruh peserta sistem", () => {
    const semua = [orang("usr_a"), orang("usr_b"), orang("usr_c")];
    expect(pesertaEfektif([], semua)).toHaveLength(3);
    expect(pesertaEfektif(["usr_b"], semua).map((u) => u.id)).toEqual(["usr_b"]);
  });

  it("nama yang tidak ada di sistem tidak menciptakan peserta hantu", () => {
    // Orang yang sudah nonaktif tetap tersimpan di tabel penugasan; ia tidak
    // boleh ikut terhitung sebagai penyebut persentase mana pun.
    const semua = [orang("usr_a")];
    expect(pesertaEfektif(["usr_a", "usr_sudah_keluar"], semua).map((u) => u.id)).toEqual(["usr_a"]);
  });
});

describe("penegakannya bukan cuma di tampilan", () => {
  it("halaman peserta benar-benar tidak memuat subject yang bukan untuknya", () => {
    // Menyembunyikannya di daftar saja tidak cukup: materinya tetap terkirim ke
    // peramban dan bisa dibaca siapa pun yang membuka alat pengembang.
    const H = baca("src/app/(app)/elearning/page.tsx");
    expect(H).toContain("bolehIkut(await pesertaCourse(aktif.id), user.id)");
    expect(H).toContain("canManage");
  });

  it("yang belum ditugaskan diberi kalimat yang jujur, bukan 'belum terbit'", () => {
    // Materinya ADA, cuma bukan untuknya. Kalimat yang salah membuatnya
    // menunggu sesuatu yang tidak akan pernah datang.
    const H = baca("src/app/(app)/elearning/page.tsx");
    expect(H).toContain("Belum ada subject untuk Anda");
    expect(H).toContain("Hubungi Human Capital");
  });

  it("aksi penyimpanannya mengganti daftar, bukan menambah", () => {
    // Menambah-saja membuat nama yang dihapus di layar tetap tertinggal di
    // basis data, dan orangnya tetap bisa membuka subject itu.
    const D = baca("src/lib/data/elearning-peserta.ts");
    const fn = D.slice(D.indexOf("export async function simpanPesertaCourse"));
    expect(fn).toContain('.delete().eq("course_id", courseId)');
  });

  it("hanya pengelola yang boleh menetapkan peserta", () => {
    const A = baca("src/lib/actions/elearning.ts");
    const fn = A.slice(A.indexOf("export async function simpanPesertaSubjectAction"));
    expect(fn.slice(0, 400)).toContain("if (!manage(user)) return");
  });
});

describe("layarnya menerangkan aturan itu, bukan menyembunyikannya", () => {
  const UI = baca("src/components/elearning/daftar-subject.tsx");

  it("kolom peserta menulis 'Semua', bukan angka nol", () => {
    // Nol akan terbaca "tidak ada yang mengerjakannya".
    expect(UI).toContain("Semua ({r.totalPeserta})");
  });

  it("yang mengosongkan daftar diberi tahu akibatnya di layar", () => {
    expect(UI).toContain("TERBUKA untuk semua peserta — bukan tertutup");
  });

  it("subject yang sedang berjalan ditandai", () => {
    expect(UI).toContain("Sedang berjalan");
  });
});
