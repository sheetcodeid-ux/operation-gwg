import { describe, expect, it } from "vitest";
import {
  hariBulan,
  hitungBarisMinggu,
  korporatMinggu,
  mingguBulan,
  mingguTanggal,
  tanggalMinggu,
  targetMinggu,
  type SumberMinggu,
} from "./minggu";

describe("mingguBulan", () => {
  it("membagi bulan 30 hari jadi lima minggu, yang terakhir dua hari", () => {
    const m = mingguBulan("2026-09");
    expect(m.map((x) => `${x.dari}-${x.sampai}`)).toEqual(["1-7", "8-14", "15-21", "22-28", "29-30"]);
    expect(m.at(-1)!.hari).toBe(2);
  });

  it("bulan 31 hari menyisakan tiga hari di minggu terakhir", () => {
    expect(mingguBulan("2026-08").at(-1)).toEqual({ minggu: 5, dari: 29, sampai: 31, hari: 3 });
  });

  it("Februari 28 hari pas empat minggu", () => {
    const m = mingguBulan("2026-02");
    expect(m).toHaveLength(4);
    expect(m.at(-1)!.sampai).toBe(28);
  });

  it("Februari kabisat menyisakan satu hari", () => {
    expect(hariBulan("2024-02")).toBe(29);
    expect(mingguBulan("2024-02").at(-1)).toEqual({ minggu: 5, dari: 29, sampai: 29, hari: 1 });
  });

  it("pembagiannya sama tiap bulan, tidak ikut hari apa bulannya dimulai", () => {
    const a = mingguBulan("2026-08").slice(0, 4).map((m) => `${m.dari}-${m.sampai}`);
    const b = mingguBulan("2026-09").slice(0, 4).map((m) => `${m.dari}-${m.sampai}`);
    expect(a).toEqual(b);
  });
});

describe("tanggalMinggu & mingguTanggal", () => {
  it("memberi rentang tanggal lengkap", () => {
    expect(tanggalMinggu("2026-09", mingguBulan("2026-09")[2])).toEqual({ dari: "2026-09-15", sampai: "2026-09-21" });
  });

  it("tanggal 1 dan 7 sama-sama minggu ke-1, tanggal 8 sudah ke-2", () => {
    expect([1, 7, 8, 30].map(mingguTanggal)).toEqual([1, 1, 2, 5]);
  });
});

describe("targetMinggu", () => {
  it("dibagi porsi hari, bukan dibagi jumlah minggu", () => {
    const m = mingguBulan("2026-09");
    const t = targetMinggu(3_000_000_000, m, 30);
    // Empat minggu penuh @7 hari + satu minggu 2 hari.
    expect(t[0]).toBeCloseTo(700_000_000, 0);
    expect(t[4]).toBeCloseTo(200_000_000, 0);
    expect(t.reduce((a, b) => a + b, 0)).toBeCloseTo(3_000_000_000, 0);
  });
});

const sumber = (actual: (number | null)[], hariAda: number[], targetBulan = 3_000_000_000): SumberMinggu => ({
  id: "o1",
  nama: "Nordu Coffee Canggu",
  kode: "NCG",
  targetBulan,
  actual,
  hariAda,
});

describe("hitungBarisMinggu", () => {
  const m = mingguBulan("2026-09");

  it("minggu ke-2 harus menutup kekurangan minggu ke-1", () => {
    // Target seminggu 700 jt; minggu ke-1 hanya 500 jt ⇒ kurang 200 jt.
    const b = hitungBarisMinggu(sumber([500_000_000, null, null, null, null], [7, 0, 0, 0, 0]), m, 30);
    expect(b.kurang).toBeCloseTo(200_000_000, 0);
    expect(b.mingguKejar).toBe(2);
    expect(b.kejar).toBeCloseTo(900_000_000, 0); // 700 jt target + 200 jt kekurangan
  });

  it("minggu yang sedang berjalan yang mengejar, bukan minggu sesudahnya", () => {
    // Minggu ke-2 baru terisi 3 dari 7 hari.
    const b = hitungBarisMinggu(sumber([700_000_000, 200_000_000, null, null, null], [7, 3, 0, 0, 0]), m, 30);
    expect(b.mingguKejar).toBe(2);
    // Sisa target minggu ke-2 (4 hari = 400 jt) + kekurangan sampai kini.
    // Target sampai kini = 10 hari = 1 M; terkumpul 900 jt ⇒ kurang 100 jt.
    expect(b.kurang).toBeCloseTo(100_000_000, 0);
    expect(b.kejar).toBeCloseTo(500_000_000, 0);
  });

  it("hari yang sudah berjalan di minggu kejar tidak dihitung dua kali", () => {
    // Tepat sesuai target sepanjang 10 hari ⇒ yang harus dikejar hanya sisa
    // 4 hari minggu itu, bukan target seminggu penuh.
    const b = hitungBarisMinggu(sumber([700_000_000, 300_000_000, null, null, null], [7, 3, 0, 0, 0]), m, 30);
    expect(b.kurang).toBe(0);
    expect(b.kejar).toBeCloseTo(400_000_000, 0);
  });

  it("di atas target tidak menghasilkan kekurangan negatif", () => {
    const b = hitungBarisMinggu(sumber([900_000_000, null, null, null, null], [7, 0, 0, 0, 0]), m, 30);
    expect(b.kurang).toBe(0);
    expect(b.persen).toBeCloseTo((900 / 700) * 100, 2);
  });

  it("bulan yang sudah habis tidak punya minggu untuk mengejar", () => {
    const b = hitungBarisMinggu(
      sumber([600_000_000, 600_000_000, 600_000_000, 600_000_000, 150_000_000], [7, 7, 7, 7, 2]),
      m,
      30,
    );
    expect(b.mingguKejar).toBeNull();
    expect(b.kejar).toBeNull();
    expect(b.terkumpul).toBe(2_550_000_000);
  });

  it("capaian minggu berjalan diukur terhadap hari yang sudah lewat", () => {
    // Minggu ke-2 baru tiga hari; target tiga hari = 300 jt, masuk 285 jt.
    const b = hitungBarisMinggu(sumber([700_000_000, 285_000_000, null, null, null], [7, 3, 0, 0, 0]), m, 30);
    expect(b.targetHariAda[1]).toBeCloseTo(300_000_000, 0);
    expect(b.capaian[1]).toBeCloseTo(95, 6);
    // Target minggu PENUH tetap tersimpan untuk ditampilkan.
    expect(b.target[1]).toBeCloseTo(700_000_000, 0);
  });

  it("minggu tanpa data tidak dihitung nol — capaiannya kosong", () => {
    const b = hitungBarisMinggu(sumber([500_000_000, null, null, null, null], [7, 0, 0, 0, 0]), m, 30);
    expect(b.capaian[1]).toBeNull();
    // Targetnya hanya sebanding tujuh hari yang sudah ada, bukan sebulan.
    expect(b.targetSampai).toBeCloseTo(700_000_000, 0);
  });

  it("target nol tidak menghasilkan pembagian nol", () => {
    const b = hitungBarisMinggu(sumber([0, null, null, null, null], [7, 0, 0, 0, 0], 0), m, 30);
    expect(b.persen).toBeNull();
    expect(b.capaian[0]).toBeNull();
  });
});

describe("korporatMinggu", () => {
  const m = mingguBulan("2026-09");

  it("menjumlahkan outlet yang terukur mingguan saja", () => {
    const baris = [
      hitungBarisMinggu(sumber([500_000_000, null, null, null, null], [7, 0, 0, 0, 0]), m, 30),
      hitungBarisMinggu(
        { ...sumber([300_000_000, null, null, null, null], [7, 0, 0, 0, 0], 1_000_000_000), id: "o2" },
        m,
        30,
      ),
    ];
    const k = korporatMinggu(baris, m, 30)!;
    expect(k.actual[0]).toBe(800_000_000);
    expect(k.targetBulan).toBe(4_000_000_000);
  });

  it("outlet tanpa rincian mingguan tidak menyeret totalnya jadi gagal", () => {
    const manual = hitungBarisMinggu(
      { ...sumber([null, null, null, null, null], [0, 0, 0, 0, 0], 2_000_000_000), id: "manual", tanpaRincian: true },
      m,
      30,
    );
    const esb = hitungBarisMinggu(sumber([700_000_000, null, null, null, null], [7, 0, 0, 0, 0]), m, 30);
    const k = korporatMinggu([esb, manual], m, 30)!;
    // Targetnya hanya milik outlet yang terukur; capaiannya persis 100%.
    expect(k.targetBulan).toBe(3_000_000_000);
    expect(k.persen).toBeCloseTo(100, 6);
  });

  it("kosong bila tidak ada satu pun outlet terukur", () => {
    const manual = hitungBarisMinggu(
      { ...sumber([null, null, null, null, null], [0, 0, 0, 0, 0]), tanpaRincian: true },
      m,
      30,
    );
    expect(korporatMinggu([manual], m, 30)).toBeNull();
  });
});
