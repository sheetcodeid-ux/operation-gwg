import { describe, expect, it } from "vitest";
import {
  BOBOT,
  batas1,
  hitungA,
  hitungB,
  hitungC,
  hitungD,
  hitungManajemen,
  peringkat,
  rasio,
} from "./manajemen";

/**
 * Rumus KPI Manajemen, dijaga angka per angka.
 *
 * Seluruhnya menghasilkan angka yang tetap masuk akal di layar kalau salah —
 * pembagian dengan nol yang jadi skor penuh, outlet baru yang ikut terhitung,
 * pembulatan yang membuat jumlah kartu tidak sama dengan gauge. Tidak ada yang
 * akan mencurigainya, dan itu sebabnya diuji di sini.
 */

const nol3: [number, number, number] = [0, 0, 0];

describe("pembatas dan pembagi", () => {
  it("pencapaian di atas 100% tidak menambah skor", () => {
    expect(batas1(1.5)).toBe(1);
    expect(batas1(1)).toBe(1);
    expect(batas1(0.4)).toBe(0.4);
  });

  it("pencapaian minus dianggap nol, bukan pengurang", () => {
    // Skor komponen yang minus akan MENARIK TURUN komponen lain lewat
    // penjumlahan — hukuman satu komponen tidak boleh merembet.
    expect(batas1(-0.3)).toBe(0);
  });

  it("pembagi nol tidak pernah jadi tak terhingga", () => {
    // Tak terhingga yang lolos ke layar tampil sebagai skor penuh.
    expect(rasio(500, 0)).toBe(0);
    expect(batas1(rasio(500, 0))).toBe(0);
  });
});

describe("A — Gross Sales Corporate", () => {
  it("target = rata-rata tiga bulan, skor sesuai contoh PRD", () => {
    // 4M, 5M, 6M → target 5M; actual 5,5M → 110% → dibatasi 100% → 40.
    const a = hitungA({ bulanLalu: [4e9, 5e9, 6e9], actual: 5.5e9 });
    expect(a.target).toBe(5e9);
    expect(a.capaian).toBeCloseTo(1.1, 5);
    expect(a.skor).toBe(BOBOT.a);
  });

  it("kurang dari target menghasilkan skor proporsional", () => {
    const a = hitungA({ bulanLalu: [4e9, 5e9, 6e9], actual: 2.5e9 });
    expect(a.capaian).toBeCloseTo(0.5, 5);
    expect(a.skor).toBeCloseTo(20, 5);
  });

  it("tiga bulan kosong berarti skor nol, bukan penuh", () => {
    expect(hitungA({ bulanLalu: nol3, actual: 5e9 }).skor).toBe(0);
  });
});

describe("B — Same Store Sales", () => {
  const outlet = [
    { id: "1", nama: "Outlet A", umur: 24, bulanLalu: [100, 100, 100] as [number, number, number], actual: 120 },
    { id: "2", nama: "Outlet B", umur: 8, bulanLalu: [200, 200, 200] as [number, number, number], actual: 100 },
    { id: "3", nama: "Outlet C", umur: 4, bulanLalu: [50, 50, 50] as [number, number, number], actual: 50 },
    { id: "4", nama: "Outlet D", umur: 1, bulanLalu: [10, 10, 10] as [number, number, number], actual: 9999 },
  ];

  it("outlet berumur 3 bulan ke bawah DIKECUALIKAN, bukan dinilai nol", () => {
    const b = hitungB(outlet);
    expect(b.jumlahIkut).toBe(3);
    expect(b.jumlahBaru).toBe(1);
    // Outlet D punya actual 9999 — kalau ikut, capaiannya melompat jauh.
    expect(b.actual).toBe(120 + 100 + 50);
    expect(b.target).toBe(100 + 200 + 50);
  });

  it("tepat 3 bulan masih terhitung baru; 4 bulan sudah ikut", () => {
    // Batasnya "lebih dari 3", bukan "3 atau lebih" — beda satu bulan di sini
    // menentukan satu outlet ikut dinilai atau tidak.
    const tiga = hitungB([{ id: "x", nama: "X", umur: 3, bulanLalu: [10, 10, 10], actual: 10 }]);
    expect(tiga.jumlahIkut).toBe(0);
    const empat = hitungB([{ id: "x", nama: "X", umur: 4, bulanLalu: [10, 10, 10], actual: 10 }]);
    expect(empat.jumlahIkut).toBe(1);
  });

  it("umur yang belum diketahui tidak ikut dinilai", () => {
    // Menebaknya sebagai "sudah lama" memasukkan outlet baru ke same-store;
    // menebaknya "baru" mengeluarkan outlet lama. Keduanya salah tanpa terlihat.
    expect(hitungB([{ id: "x", nama: "X", umur: null, bulanLalu: [10, 10, 10], actual: 10 }]).jumlahIkut).toBe(0);
  });

  it("tanpa satu pun outlet layak, skornya nol", () => {
    const b = hitungB([{ id: "x", nama: "X", umur: 1, bulanLalu: [10, 10, 10], actual: 10 }]);
    expect(b.target).toBe(0);
    expect(b.skor).toBe(0);
  });
});

describe("C — EBITDA same store", () => {
  it("margin 30% atau lebih bernilai penuh", () => {
    expect(hitungC(300, 1000).margin).toBeCloseTo(30, 5);
    expect(hitungC(300, 1000).skor).toBe(BOBOT.c);
    expect(hitungC(500, 1000).skor).toBe(BOBOT.c);
  });

  it("di bawah target bernilai proporsional, bukan nol", () => {
    const c = hitungC(150, 1000);
    expect(c.margin).toBeCloseTo(15, 5);
    expect(c.skor).toBeCloseTo(10, 5);
  });

  it("sales nol tidak menghasilkan margin tak terhingga", () => {
    expect(hitungC(900, 0).margin).toBe(0);
    expect(hitungC(900, 0).skor).toBe(0);
  });

  it("rugi bernilai nol, bukan skor minus", () => {
    expect(hitungC(-500, 1000).skor).toBe(0);
  });
});

describe("D — KPI All Division", () => {
  it("rata-rata sederhana, seluruh divisi berbobot sama", () => {
    const d = hitungD([
      { nama: "HR", nilai: 92 },
      { nama: "Finance", nilai: 95 },
      { nama: "Marketing", nilai: 80 },
      { nama: "Operation", nilai: 90 },
      { nama: "Warehouse", nilai: 88 },
    ]);
    expect(d.rata).toBe(89);
    expect(d.skor).toBeCloseTo(8.9, 5);
  });

  it("tanpa divisi sama sekali, tidak ada kontribusi skor", () => {
    expect(hitungD([]).rata).toBe(0);
    expect(hitungD([]).skor).toBe(0);
  });
});

describe("skor akhir", () => {
  it("empat komponen dijumlah dan dibulatkan dua desimal", () => {
    const s = hitungManajemen({
      a: { bulanLalu: [4e9, 5e9, 6e9], actual: 5.5e9 },
      outlet: [{ id: "1", nama: "A", umur: 24, bulanLalu: [1000, 1000, 1000], actual: 900 }],
      labaBersih: 270,
      salesManual: null,
      divisi: [{ nama: "HR", nilai: 90 }],
    });
    expect(s.a.skor).toBe(40);
    expect(s.b.skor).toBeCloseTo(27, 5);
    // Sales same store diambil dari total actual B (900) → margin 30% → penuh.
    expect(s.c.sales).toBe(900);
    expect(s.c.skor).toBe(20);
    expect(s.d.skor).toBeCloseTo(9, 5);
    expect(s.akhir).toBe(96);
  });

  it("sales same store bisa ditulis tangan menggantikan total B", () => {
    const s = hitungManajemen({
      a: { bulanLalu: nol3, actual: 0 },
      outlet: [{ id: "1", nama: "A", umur: 24, bulanLalu: [1000, 1000, 1000], actual: 900 }],
      labaBersih: 300,
      salesManual: 2000,
      divisi: [],
    });
    expect(s.c.sales).toBe(2000);
    expect(s.c.margin).toBeCloseTo(15, 5);
  });

  it("gauge sama dengan jumlah keempat kartunya", () => {
    // Membulatkan tiap komponen lebih dulu membuat jumlah kartu meleset dari
    // angka di gauge — dan angka yang tidak cocok dengan penjumlahannya
    // sendiri tidak akan dipercaya siapa pun.
    const s = hitungManajemen({
      a: { bulanLalu: [3e9, 3e9, 3e9], actual: 2.77e9 },
      outlet: [{ id: "1", nama: "A", umur: 12, bulanLalu: [777, 777, 777], actual: 666 }],
      labaBersih: 111,
      salesManual: null,
      divisi: [{ nama: "HR", nilai: 83 }, { nama: "Fin", nilai: 77 }],
    });
    const jumlah = Math.round((s.a.skor + s.b.skor + s.c.skor + s.d.skor) * 100) / 100;
    expect(s.akhir).toBe(jumlah);
  });
});

describe("peringkat", () => {
  it("ambangnya sesuai PRD", () => {
    expect(peringkat(100).label).toBe("Sangat Baik");
    expect(peringkat(85).label).toBe("Sangat Baik");
    expect(peringkat(84.99).label).toBe("Baik");
    expect(peringkat(70).label).toBe("Baik");
    expect(peringkat(69.99).label).toBe("Perlu Perhatian");
    expect(peringkat(50).label).toBe("Perlu Perhatian");
    expect(peringkat(49.99).label).toBe("Kritis");
    expect(peringkat(0).label).toBe("Kritis");
  });

  it("Perlu Perhatian dan Kritis TIDAK berwarna sama", () => {
    // Pada versi sebelumnya keduanya merah, jadi skor 69 dan skor 20 terlihat
    // sama gawatnya — dan yang membacanya kehilangan satu-satunya petunjuk
    // bahwa yang satu masih bisa dikejar.
    expect(peringkat(69).tone).not.toBe(peringkat(20).tone);
  });
});
