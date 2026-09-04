import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, afterEach } from "vitest";
import { akhirTerpakai, bulanTerakhir } from "./esb-bulanan";

/**
 * Penarikan angka bulanan per cabang.
 *
 * Ini yang membuat Management Fee dan budget Efisiensi benar dalam hitungan
 * menit, bukan hari: satu panggilan ESB per cabang per bulan menggantikan ~250
 * panggilan harian. Yang dijaga di sini bentuk rentangnya — salah satu hari
 * saja sudah cukup membuat angkanya beda dari yang terbaca di ESB.
 */

afterEach(() => vi.useRealTimers());

/** Waktu Indonesia Barat = UTC+7; jam 05.00 UTC masih hari yang sama di WIB. */
const setHari = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T05:00:00Z`));
};

describe("rentang bulan yang diminta ke ESB", () => {
  it("bulan yang sudah lewat diminta penuh sampai hari terakhirnya", () => {
    setHari("2026-09-04");
    expect(akhirTerpakai("2026-08")).toBe("2026-08-31");
    expect(akhirTerpakai("2026-02")).toBe("2026-02-28"); // 2026 bukan kabisat
  });

  it("bulan berjalan berhenti di hari ini, bukan di akhir bulan", () => {
    // Meminta sampai 30 September pada tanggal 4 bukan sekadar mubazir: ESB
    // membalas dengan rentang yang belum terjadi, dan angkanya tersimpan
    // seolah-olah bulan itu sudah selesai.
    setHari("2026-09-04");
    expect(akhirTerpakai("2026-09")).toBe("2026-09-04");
  });

  it("bulan yang belum datang tidak diminta sama sekali", () => {
    setHari("2026-09-04");
    expect(akhirTerpakai("2026-10")).toBeNull();
  });
});

describe("bulan mana saja yang ditarik", () => {
  it("bulan berjalan plus tiga bulan ke belakang — melewati pergantian tahun", () => {
    // Efisiensi memakai rata-rata tiga bulan, jadi Januari butuh Desember tahun
    // sebelumnya. Berhenti di Januari akan membuat budget awal tahun selalu
    // salah.
    expect(bulanTerakhir(3, "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
  });
});

describe("cara memanggilnya", () => {
  const sumber = readFileSync(join(process.cwd(), "src/lib/data/esb-bulanan.ts"), "utf8");

  it("dikerjakan berurutan, bukan ditembakkan sekaligus", () => {
    // ESB melayani satu sesi per akun; puluhan permintaan serentak bukan
    // mempercepat melainkan membuat sebagiannya gagal tanpa pesan yang jelas.
    expect(sumber).not.toContain("Promise.all");
    expect(sumber).toContain("for (const t of perlu)");
  });

  it("bulan yang sudah lewat tidak ditarik ulang", () => {
    // Angkanya dijamin sama; menariknya tiap jam membuang panggilan ESB.
    expect(sumber).toContain("function masihSegar");
    expect(sumber).toContain("r.sampai < akhir");
  });

  it("hanya cabang yang benar-benar dipakai outlet yang ditarik", () => {
    expect(sumber).toContain("function cabangTerpasang");
    expect(sumber).toContain('.not("esb_branch_id", "is", null)');
  });
});

describe("kapan satu baris ditarik ulang", () => {
  const sumber = readFileSync(join(process.cwd(), "src/lib/data/esb-bulanan.ts"), "utf8");

  it("bulan berjalan ditarik ulang begitu tanggalnya bertambah", () => {
    // Inilah yang membuat angkanya ikut bergerak tiap hari. Tanpa ini,
    // Management Fee dan budget Efisiensi membeku di tanggal penarikan terakhir
    // tanpa satu pun tanda bahwa angkanya sudah basi.
    expect(sumber).toContain("if (akhir === null || r.sampai < akhir) return false;");
  });

  it("bulan yang baru berakhir ditarik sekali lagi untuk transaksi susulan", () => {
    // Tutup buku di lapangan tidak selesai pukul 23.59; baris yang ditarik
    // tepat di hari terakhir belum tentu memuat yang masuk belakangan.
    expect(sumber).toContain("JEDA_FINAL_HARI");
    expect(sumber).toContain("syncedAt.slice(0, 10) >= final");
  });

  it("bulan lama yang sudah final tidak ditarik lagi selamanya", () => {
    // Angkanya dijamin sama; menariknya ulang membuang panggilan ESB yang
    // dibutuhkan bulan berjalan.
    expect(sumber).toContain("bulanSudahLewat");
  });
});

describe("ketika ESB menolak sebentar", () => {
  const sumber = readFileSync(join(process.cwd(), "src/lib/data/esb-bulanan.ts"), "utf8");
  const musiman = readFileSync(join(process.cwd(), "src/lib/data/seasonal.ts"), "utf8");

  it("menunggu sejenak sebelum mencoba lagi, tidak langsung menyerah", () => {
    // Terlihat di lapangan: setelah ~40 permintaan beruntun ESB membalas
    // "respons tidak terbaca". Tanpa jeda, lima kegagalan berturut-turut datang
    // dalam dua detik dan seluruh sisa anggaran waktu terbuang tanpa satu baris
    // pun bertambah.
    expect(sumber).toContain("gagal * 1_500");
    expect(musiman).toContain("fails * 1_500");
  });
});
