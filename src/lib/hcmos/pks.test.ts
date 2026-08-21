import { describe, expect, it } from "vitest";

import { pengingatPks, rekapPks, type PerjanjianRingkas } from "./pks";

const p = (o: Partial<PerjanjianRingkas>): PerjanjianRingkas => ({
  judul: "Sewa Outlet",
  pihak: "Pemilik Ruko",
  berlakuMulai: "2024-01-01",
  berlakuSampai: "2026-12-31",
  status: "aktif",
  masaBerlaku: "berlaku",
  ...o,
});

describe("rekapPks", () => {
  it("yang segera habis TETAP terhitung aktif", () => {
    const r = rekapPks([p({}), p({ masaBerlaku: "segera_habis" })]);
    expect(r.aktif).toBe(2);
    expect(r.segeraHabis).toBe(1);
  });

  it("yang tanggalnya lewat keluar dari hitungan aktif", () => {
    const r = rekapPks([p({ masaBerlaku: "habis" })]);
    expect(r).toEqual({ aktif: 0, segeraHabis: 0, draf: 0, lewat: 1 });
  });

  it("draf tidak dianggap aktif maupun lewat", () => {
    const r = rekapPks([p({ status: "draf", masaBerlaku: "habis" })]);
    expect(r).toEqual({ aktif: 0, segeraHabis: 0, draf: 1, lewat: 0 });
  });

  it("arsip tidak terhitung di mana pun", () => {
    expect(rekapPks([p({ status: "arsip" })])).toEqual({ aktif: 0, segeraHabis: 0, draf: 0, lewat: 0 });
  });

  it("tanpa masa berlaku tetap aktif", () => {
    expect(rekapPks([p({ berlakuSampai: null, masaBerlaku: "tanpa_masa" })]).aktif).toBe(1);
  });

  it("tanpa baris semuanya nol", () => {
    expect(rekapPks([])).toEqual({ aktif: 0, segeraHabis: 0, draf: 0, lewat: 0 });
  });
});

describe("pengingatPks", () => {
  const kini = new Date("2026-08-21T00:00:00Z");

  it("yang sudah lewat ditaruh di atas yang akan jatuh tempo", () => {
    const rows = [
      p({ judul: "Segera", masaBerlaku: "segera_habis", berlakuSampai: "2026-09-30" }),
      p({ judul: "Telat", masaBerlaku: "habis", berlakuSampai: "2026-07-01" }),
    ];
    expect(pengingatPks(rows, kini).map((r) => r.judul)).toEqual(["Telat", "Segera"]);
  });

  it("yang masih lama dan yang masih draf tidak ikut", () => {
    const rows = [
      p({ judul: "Lama" }),
      p({ judul: "Draf", status: "draf", masaBerlaku: "segera_habis" }),
      p({ judul: "Segera", masaBerlaku: "segera_habis" }),
    ];
    expect(pengingatPks(rows, kini).map((r) => r.judul)).toEqual(["Segera"]);
  });

  it("yang lebih dekat jatuh temponya lebih dulu", () => {
    const rows = [
      p({ judul: "November", masaBerlaku: "segera_habis", berlakuSampai: "2026-11-30" }),
      p({ judul: "September", masaBerlaku: "segera_habis", berlakuSampai: "2026-09-30" }),
    ];
    expect(pengingatPks(rows, kini).map((r) => r.judul)).toEqual(["September", "November"]);
  });
});
