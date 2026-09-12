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
