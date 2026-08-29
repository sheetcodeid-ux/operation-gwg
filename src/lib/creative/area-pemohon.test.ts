import { describe, expect, it } from "vitest";
import { areaMilik, asalArea, type OutletRingkas } from "./area-pemohon";
import { HEAD_OFFICE, HEAD_OFFICE_LABEL } from "./penilaian-request";

/**
 * Dari mana wilayah sebuah permintaan ditentukan.
 *
 * Ini bukan detail tampilan. Wilayah menentukan Coordinator Area MANA yang
 * tercatat bertanggung jawab atas permintaan mendadak — salah di sini berarti
 * orang yang salah yang dievaluasi.
 */

const OUTLET: OutletRingkas[] = [
  { id: "out_1", code: "NBTJ", name: "Nordu Bakes Tanjung Duren", areaId: "area_poetri" },
  { id: "out_2", code: "CTBS", name: "Cattu BSD", areaId: "area_wisnu" },
  { id: "out_3", code: "XX", name: "Cabang Baru", areaId: "" },
];
const cariOutlet = (x: string) => OUTLET.find((o) => o.id === x || o.code === x);
const namaArea = (id: string) => ({ area_poetri: "Area Poetri", area_wisnu: "Area Wisnu" })[id];

describe("wilayah sebuah permintaan", () => {
  it("cabang yang DITULIS di permintaannya paling dipercaya", () => {
    // Supervisor bisa meminta desain untuk cabang lain; yang ia tulis lebih
    // benar daripada tebakan apa pun.
    const a = asalArea({ outletId: "out_2", pemohonOutletIds: ["out_1"], cariOutlet, namaArea });
    expect(a.areaNama).toBe("Area Wisnu");
    expect(a.outletNama).toBe("Cattu BSD");
  });

  it("tanpa cabang di permintaannya, dipakai cabang pemohonnya", () => {
    // Inti keluhannya: form design tidak menanyakan cabang, dan akibatnya
    // permintaan seorang supervisor jatuh ke "tanpa outlet" padahal wilayahnya
    // jelas tertulis di penugasannya.
    const a = asalArea({ outletId: null, pemohonOutletIds: ["out_1"], cariOutlet, namaArea });
    expect(a.areaId).toBe("area_poetri");
    expect(a.areaNama).toBe("Area Poetri");
  });

  it("cabang bisa disebut dengan kode POS-nya", () => {
    // Penugasan cabang menyimpan id ATAU kode, tergantung kapan barisnya
    // dibuat. Mencari dengan id saja membuat separuh supervisor tampak tidak
    // memegang cabang mana pun.
    expect(asalArea({ outletId: null, pemohonOutletIds: ["NBTJ"], cariOutlet, namaArea }).areaNama).toBe("Area Poetri");
  });

  it("permintaan kantor jadi Head Office, bukan 'tanpa outlet'", () => {
    const a = asalArea({ outletId: null, pemohonOutletIds: [], cariOutlet, namaArea });
    expect(a.areaId).toBe(HEAD_OFFICE);
    expect(a.areaNama).toBe(HEAD_OFFICE_LABEL);
    expect(a.outletNama).toBeNull();
  });

  it("cabang yang belum punya area tidak dilempar ke area kosong", () => {
    // Area kosong akan mengelompokkan seluruh cabang yang belum diatur jadi
    // satu wilayah tak bernama yang tidak punya Coordinator Area.
    const a = asalArea({ outletId: "out_3", pemohonOutletIds: [], cariOutlet, namaArea });
    expect(a.areaId).toBe(HEAD_OFFICE);
    expect(a.outletNama).toBe("Cabang Baru");
  });

  it("cabang yang tidak dikenali tidak membuat wilayahnya mengarang", () => {
    expect(asalArea({ outletId: "out_hilang", pemohonOutletIds: [], cariOutlet, namaArea }).areaId).toBe(HEAD_OFFICE);
  });

  it("area tanpa nama tetap punya keterangan, bukan string kosong", () => {
    const a = asalArea({ outletId: "out_1", pemohonOutletIds: [], cariOutlet, namaArea: () => undefined });
    expect(a.areaNama).toBe("Area tanpa nama");
  });
});

describe("wilayah yang dipegang seseorang", () => {
  it("digabung dari seluruh cabang yang ditugaskan, bukan dari satu kolom area", () => {
    // Sebagian Coordinator Area memegang cabang di lebih dari satu wilayah;
    // `areaId` hanya menyimpan satu, dan memakainya sendirian membuat sebagian
    // cabang yang ia pegang hilang dari layarnya.
    expect(areaMilik({ outletIds: ["out_1", "CTBS"], areaId: null, cariOutlet }).sort()).toEqual([
      "area_poetri",
      "area_wisnu",
    ]);
  });

  it("kolom area ikut, supaya CA tanpa cabang tidak kehilangan wilayahnya", () => {
    expect(areaMilik({ outletIds: [], areaId: "area_poetri", cariOutlet })).toEqual(["area_poetri"]);
  });

  it("tidak ada duplikat walau dua cabang di wilayah yang sama", () => {
    expect(areaMilik({ outletIds: ["out_1", "NBTJ"], areaId: "area_poetri", cariOutlet })).toEqual(["area_poetri"]);
  });
});
