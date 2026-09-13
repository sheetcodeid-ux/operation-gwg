import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bacaHasil, statusBaris } from "./sinkron-sehat";

/**
 * Penjaga terhadap kegagalan yang tidak kelihatan.
 *
 * Katalog menu ESB pernah berhenti terisi DUA BELAS HARI sementara cron-nya
 * melapor "berhasil" tiap hari. Yang diuji di sini justru pembedaan yang
 * gagal dilakukan waktu itu: "dicoba" bukan "tuntas", dan "sedang menunggu"
 * bukan "sudah selesai".
 */

const dasar = {
  job: "menu",
  terakhirCoba: new Date().toISOString(),
  terakhirSukses: null as string | null,
  terakhirTuntas: null as string | null,
  gagalBeruntun: 0,
  pesan: null as string | null,
  jedaWajarJam: 24,
};
const jamLalu = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

describe("membaca hasil satu penarikan", () => {
  it("ada error berarti gagal, dan gagal bukan tuntas", () => {
    expect(bacaHasil({ error: "ESB: waktu habis sebelum ekspor siap" })).toEqual({
      gagal: true,
      tuntas: false,
      pesan: "ESB: waktu habis sebelum ekspor siap",
    });
  });

  it("MENUNGGU bukan gagal, tapi juga bukan tuntas", () => {
    // Inilah pembedaan yang menyelamatkan: ekspor yang masih dibangun ESB
    // memang wajar, tapi yang menunggu selamanya harus tetap ketahuan.
    expect(bacaHasil({ menus: 0, complete: false, menunggu: true })).toEqual({ gagal: false, tuntas: false, pesan: null });
  });

  it("complete menentukan tuntas, bukan ketiadaan error", () => {
    expect(bacaHasil({ complete: true, menus: 1004 }).tuntas).toBe(true);
    expect(bacaHasil({ complete: false, nextPage: 153 }).tuntas).toBe(false);
  });

  it("sisa nol berarti tuntas — bentuk hasil penarikan yang lain", () => {
    expect(bacaHasil({ ditarik: 0, sisa: 0 }).tuntas).toBe(true);
    expect(bacaHasil({ ditarik: 51, sisa: 2 }).tuntas).toBe(false);
    expect(bacaHasil({ synced: 1, remaining: 0 }).tuntas).toBe(true);
  });

  it("error kosong tidak dihitung gagal", () => {
    // Beberapa penarikan mengisi error dengan string kosong saat tidak ada apa-apa.
    expect(bacaHasil({ sisa: 0, error: "   " }).gagal).toBe(false);
  });
});

describe("status satu penarikan", () => {
  it("belum pernah dicoba dibedakan dari sehat", () => {
    expect(statusBaris({ ...dasar, terakhirCoba: null })).toBe("belum pernah");
  });

  it("baru saja tuntas berarti sehat", () => {
    expect(statusBaris({ ...dasar, terakhirTuntas: jamLalu(1) })).toBe("sehat");
  });

  it("lewat jeda wajar jadi tertunda, tiga kali lipatnya jadi bermasalah", () => {
    expect(statusBaris({ ...dasar, terakhirTuntas: jamLalu(30) })).toBe("tertunda");
    expect(statusBaris({ ...dasar, terakhirTuntas: jamLalu(80) })).toBe("bermasalah");
  });

  it("DICOBA TERUS TAPI TIDAK PERNAH TUNTAS tetap ketahuan", () => {
    // Persis keadaan katalog menu selama dua belas hari: dicoba dua kali
    // sehari, tercatat "berhasil" oleh pg_cron, dan tidak pernah selesai.
    const mogok = { ...dasar, terakhirCoba: jamLalu(0.1), terakhirTuntas: jamLalu(12 * 24), gagalBeruntun: 24 };
    expect(statusBaris(mogok)).toBe("bermasalah");
  });

  it("gagal beruntun tiga kali sudah bermasalah walau baru saja tuntas", () => {
    expect(statusBaris({ ...dasar, terakhirTuntas: jamLalu(1), gagalBeruntun: 3 })).toBe("bermasalah");
    expect(statusBaris({ ...dasar, terakhirTuntas: jamLalu(1), gagalBeruntun: 2 })).toBe("sehat");
  });
});

describe("satu pintu keluar cron BENAR-BENAR mengembalikan jawaban", () => {
  const rute = readFileSync(join(process.cwd(), "src/app/api/cron/fraud-sync/route.ts"), "utf8");
  // Baris komentar dibuang dulu: catatan sejarah di dalamnya menyebut bentuk
  // lama yang salah, dan uji yang ikut membacanya akan gagal karena penjelasan
  // — bukan karena kodenya.
  const badan = rute
    .slice(rute.indexOf("const selesai = async"), rute.indexOf("const job = new URL"))
    .split("\n")
    .filter((b) => !b.trim().startsWith("//"))
    .join("\n");

  it("`selesai` tidak memanggil dirinya sendiri", () => {
    // Pernah terjadi: penggantian massal `return NextResponse.json(...)` menjadi
    // `return selesai()` ikut mengubah baris di DALAM definisi `selesai` sendiri.
    // Akibatnya tiap cron berputar tanpa henti sampai Vercel mematikannya di
    // detik ke-60 — pg_net mencatat balasan kosong tanpa status, dan penghitung
    // gagal beruntun menggelembung karena kesehatan ditulis berkali-kali dalam
    // satu permintaan.
    expect(badan).not.toMatch(/return\s+selesai\(\)/);
  });

  it("`selesai` mencatat kesehatan lalu mengembalikan NextResponse", () => {
    expect(badan).toContain("await catatHasilSinkron(results)");
    expect(badan).toContain("return NextResponse.json(");
  });
});

describe("companyID ESB tidak boleh terkunci kosong", () => {
  const klien = readFileSync(join(process.cwd(), "src/lib/integrations/esb-client.ts"), "utf8");

  it("daftar kosong tidak ikut disimpan, jadi dicoba lagi", () => {
    // Senarai kosong bernilai "ada" di JavaScript. Sekali pembacaannya gagal,
    // seluruh panggilan berikutnya pada instance yang sama berangkat tanpa
    // companyID — dan ESB membalasnya dengan halaman HTML, bukan data.
    expect(klien).toContain("if (companyIds?.length) return companyIds;");
    expect(klien).not.toMatch(/catch\s*\{\s*companyIds = \[\];/);
  });

  it("balasan HTML disebut apa adanya, bukan sekadar tidak terbaca", () => {
    expect(klien).toContain("dibalas halaman HTML, bukan data");
  });
});
