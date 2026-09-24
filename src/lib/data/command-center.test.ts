import { describe, expect, it } from "vitest";
import { kelompokkanSignal, ringkasSignal, type SignalTriase } from "./command-center";

/**
 * COMMAND CENTER — pengelompokan, urutan, dan penanda kematangan periode.
 *
 * Yang diuji di sini bukan tampilannya melainkan URUTAN dan PENANDANYA.
 * Keduanya tidak pernah terlihat salah dari layar: daftar yang mengubur satu
 * outlet critical di baris kesepuluh tetap tampak rapi, dan bulan berjalan yang
 * lupa ditandai MTD tetap tampak seperti angka yang sudah selesai.
 */

const s = (o: Partial<SignalTriase> & { id: number }): SignalTriase => ({
  cakupan: "outlet",
  periode: "2026-09",
  outletId: "out_a",
  outletNama: "Outlet A",
  areaNama: "Area Satu",
  kpiDefinitionId: "biaya.labor_pct",
  severity: "medium",
  operator: "gt",
  nilaiActual: 20,
  nilaiAmbang: 13,
  nilaiAmbang2: null,
  statusKpi: "sementara",
  terdeteksiPada: "2026-09-17T13:18:44.000Z",
  nilaiTerakhir: 20,
  kondisiTerakhir: "lewat_ambang",
  statusKpiTerakhir: "sementara",
  diamatiPada: "2026-09-17T14:43:01.000Z",
  diakuiOleh: null,
  diakuiNama: null,
  diakuiPada: null,
  ...o,
});

describe("pengelompokan PERIODE → OUTLET → Signal", () => {
  it("grain datanya tidak berubah — tiap Signal tetap satu baris", () => {
    const daftar = [
      s({ id: 1, kpiDefinitionId: "biaya.labor_pct" }),
      s({ id: 2, kpiDefinitionId: "biaya.net_profit_pct", severity: "critical" }),
      s({ id: 3, kpiDefinitionId: "biaya.other_pct" }),
    ];
    const k = kelompokkanSignal(daftar, "2026-09");
    expect(k).toHaveLength(1);
    expect(k[0].outlet).toHaveLength(1);
    // TIGA Signal, bukan satu Signal gabungan.
    expect(k[0].outlet[0].signal).toHaveLength(3);
    expect(k[0].outlet[0].signal.map((x) => x.id).sort()).toEqual([1, 2, 3]);
  });

  it("periode terbaru lebih dulu", () => {
    const k = kelompokkanSignal([s({ id: 1, periode: "2026-08" }), s({ id: 2, periode: "2026-09" })], "2026-09");
    expect(k.map((x) => x.periode)).toEqual(["2026-09", "2026-08"]);
  });

  it("bulan berjalan ditandai, bulan yang sudah habis tidak", () => {
    const k = kelompokkanSignal([s({ id: 1, periode: "2026-08" }), s({ id: 2, periode: "2026-09" })], "2026-09");
    expect(k.find((x) => x.periode === "2026-09")!.berjalan).toBe(true);
    expect(k.find((x) => x.periode === "2026-08")!.berjalan).toBe(false);
  });

  it("Signal di dalam satu outlet urut severity terberat lebih dulu", () => {
    const k = kelompokkanSignal(
      [
        s({ id: 1, severity: "medium", kpiDefinitionId: "biaya.other_pct" }),
        s({ id: 2, severity: "critical", kpiDefinitionId: "biaya.net_profit_pct" }),
        s({ id: 3, severity: "high", kpiDefinitionId: "biaya.labor_pct" }),
      ],
      "2026-09",
    );
    expect(k[0].outlet[0].signal.map((x) => x.severity)).toEqual(["critical", "high", "medium"]);
  });

  it("outlet ber-Signal terberat naik ke atas, bukan urut abjad", () => {
    const k = kelompokkanSignal(
      [
        s({ id: 1, outletId: "out_a", outletNama: "Aaa", severity: "medium" }),
        s({ id: 2, outletId: "out_z", outletNama: "Zzz", severity: "critical" }),
      ],
      "2026-09",
    );
    expect(k[0].outlet.map((o) => o.outletNama)).toEqual(["Zzz", "Aaa"]);
  });

  it("severity setara diurut jumlah Signal, lalu abjad — supaya stabil", () => {
    const k = kelompokkanSignal(
      [
        s({ id: 1, outletId: "out_b", outletNama: "Bbb", severity: "high" }),
        s({ id: 2, outletId: "out_a", outletNama: "Aaa", severity: "high" }),
        s({ id: 3, outletId: "out_a", outletNama: "Aaa", severity: "high", kpiDefinitionId: "biaya.other_pct" }),
      ],
      "2026-09",
    );
    expect(k[0].outlet.map((o) => o.outletNama)).toEqual(["Aaa", "Bbb"]);
  });
});

describe("ringkasan kepala layar", () => {
  it("mencacah severity apa adanya", () => {
    const semua = [
      s({ id: 1, severity: "critical" }),
      s({ id: 2, severity: "high" }),
      s({ id: 3, severity: "medium" }),
      s({ id: 4, severity: "medium" }),
    ];
    const r = ringkasSignal(semua, semua);
    expect(r).toMatchObject({ total: 4, critical: 1, high: 1, medium: 2, low: 0 });
  });

  it("outlet terdampak dihitung UNIK, bukan jumlah Signal", () => {
    const semua = [
      s({ id: 1, outletId: "out_a" }),
      s({ id: 2, outletId: "out_a" }),
      s({ id: 3, outletId: "out_b" }),
    ];
    expect(ringkasSignal(semua, semua).outletTerdampak).toBe(2);
  });

  it("korporat ikut dicacah severity tapi TIDAK menambah outlet terdampak", () => {
    const outlet = [s({ id: 1, severity: "high" })];
    const korporat = [s({ id: 2, cakupan: "korporat", outletId: null, severity: "critical" })];
    const r = ringkasSignal([...outlet, ...korporat], outlet);
    expect(r.total).toBe(2);
    expect(r.critical).toBe(1);
    expect(r.outletTerdampak).toBe(1);
  });

  it("yang sudah dilihat dicacah terpisah dan TIDAK hilang dari daftar kerja", () => {
    const semua = [
      s({ id: 1, diakuiOleh: "usr_1", diakuiNama: "Fikri", diakuiPada: "2026-09-20T02:00:00.000Z" }),
      s({ id: 2 }),
    ];
    expect(ringkasSignal(semua, semua).diakui).toBe(1);
    // Inilah kontrak D1 = B: mengakui tidak mengubah `status`, jadi Signal-nya
    // tetap ikut dikelompokkan dan tetap terlihat.
    expect(kelompokkanSignal(semua, "2026-09")[0].outlet[0].signal).toHaveLength(2);
  });
});
