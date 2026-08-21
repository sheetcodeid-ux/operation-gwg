import { describe, expect, it } from "vitest";

import { perluDitutup, tindakanPenutupan, type KasusOffboarding } from "./offboarding";

const k = (o: Partial<KasusOffboarding>): KasusOffboarding => ({
  id: "k1",
  jenis: "offboarding",
  nama: "Rina",
  status: "selesai",
  userId: "usr_1",
  kontrakId: null,
  tglSelesai: "2026-08-20",
  tanggal: "2026-08-01",
  ...o,
});

describe("tindakanPenutupan", () => {
  it("menonaktifkan akun ketika perkara offboarding ditutup", () => {
    expect(tindakanPenutupan(k({}))).toEqual({ nonaktifkanUser: "usr_1", tandaiResign: null });
  });

  it("mengisi tanggal resign kontrak dari tanggal selesai", () => {
    const t = tindakanPenutupan(k({ userId: null, kontrakId: "kon_1" }));
    expect(t.tandaiResign).toEqual({ kontrakId: "kon_1", tanggal: "2026-08-20" });
  });

  it("jatuh ke tanggal perkara bila tanggal selesai belum diisi", () => {
    const t = tindakanPenutupan(k({ userId: null, kontrakId: "kon_1", tglSelesai: null }));
    expect(t.tandaiResign).toEqual({ kontrakId: "kon_1", tanggal: "2026-08-01" });
  });

  it("perkara yang belum selesai tidak menyentuh apa pun", () => {
    expect(tindakanPenutupan(k({ status: "proses" }))).toEqual({ nonaktifkanUser: null, tandaiResign: null });
  });

  it("kasus biasa bukan offboarding tidak menonaktifkan siapa pun", () => {
    expect(tindakanPenutupan(k({ jenis: "kasus" }))).toEqual({ nonaktifkanUser: null, tandaiResign: null });
  });

  it("tanpa penunjuk orang, TIDAK menebak dari nama", () => {
    expect(tindakanPenutupan(k({ userId: null, kontrakId: null }))).toEqual({
      nonaktifkanUser: null,
      tandaiResign: null,
    });
  });

  it("kontrak tanpa tanggal sama sekali tidak ditandai resign", () => {
    const t = tindakanPenutupan(k({ userId: null, kontrakId: "kon_1", tglSelesai: null, tanggal: null }));
    expect(t.tandaiResign).toBeNull();
  });
});

describe("perluDitutup", () => {
  const aktif = new Set(["usr_1"]);
  const tanpaResign = new Set(["kon_1"]);

  it("menangkap perkara selesai yang akunnya masih aktif", () => {
    expect(perluDitutup([k({})], aktif, tanpaResign)).toEqual([
      { kasusId: "k1", nama: "Rina", alasan: "akun-masih-aktif" },
    ]);
  });

  it("menangkap kontrak yang belum diberi tanggal resign", () => {
    expect(perluDitutup([k({ userId: null, kontrakId: "kon_1" })], aktif, tanpaResign)).toEqual([
      { kasusId: "k1", nama: "Rina", alasan: "kontrak-tanpa-tanggal-resign" },
    ]);
  });

  it("perkara tanpa penunjuk orang tetap dilaporkan, bukan dilewatkan diam-diam", () => {
    expect(perluDitutup([k({ userId: null, kontrakId: null })], aktif, tanpaResign)).toEqual([
      { kasusId: "k1", nama: "Rina", alasan: "orang-belum-ditunjuk" },
    ]);
  });

  it("yang sudah benar-benar tertutup tidak dilaporkan", () => {
    const rows = [k({ userId: "usr_9" }), k({ id: "k2", userId: null, kontrakId: "kon_9" })];
    expect(perluDitutup(rows, aktif, tanpaResign)).toEqual([]);
  });

  it("satu perkara bisa tertinggal di dua sisi sekaligus", () => {
    const hasil = perluDitutup([k({ userId: "usr_1", kontrakId: "kon_1" })], aktif, tanpaResign);
    expect(hasil.map((h) => h.alasan)).toEqual(["akun-masih-aktif", "kontrak-tanpa-tanggal-resign"]);
  });

  it("perkara yang belum selesai bukan urusan jaring ini", () => {
    expect(perluDitutup([k({ status: "proses" })], aktif, tanpaResign)).toEqual([]);
  });
});
