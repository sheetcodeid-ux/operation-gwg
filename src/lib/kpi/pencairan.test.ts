import { describe, expect, it } from "vitest";
import { AMBANG_PENUH, AMBANG_SEPARUH, barisPencairan, hasilCair, rata } from "./pencairan";
import type { DepartemenKpi } from "./manajemen";

/**
 * DAFTAR PENCAIRAN — yang diuji di sini menentukan siapa dibayar berapa.
 *
 * Tiap contoh di bawah ini datang dari contoh yang diberikan pemiliknya sendiri,
 * bukan dari angka yang direka: Adam, Abil, Mustadi, Bagas di PDQ, rata-ratanya
 * jadi KPI Head, dan tiga ambang pencairan.
 */

const dept = (
  kode: string,
  nama: string,
  orang: [string, number | null][],
): DepartemenKpi => ({
  kode,
  nama,
  singkat: nama,
  rata: null,
  lalu: null,
  posisi: [
    {
      kode: `${kode}_p`,
      nama: `${nama} Staff`,
      nilai: null,
      lalu: null,
      orang: orang.map(([n, v]) => ({ nama: n, nilai: v, bersama: false })),
    },
  ],
});

describe("ambang pencairan", () => {
  it("86 ke atas cair penuh, 62 sampai bawah 86 separuh, di bawahnya tidak", () => {
    expect(hasilCair(100)?.persen).toBe(100);
    expect(hasilCair(AMBANG_PENUH)?.persen).toBe(100);
    expect(hasilCair(85.9)?.persen).toBe(50);
    expect(hasilCair(AMBANG_SEPARUH)?.persen).toBe(50);
    expect(hasilCair(61.9)?.persen).toBe(0);
    expect(hasilCair(0)?.persen).toBe(0);
  });

  it("DI ATAS 100 tetap cair penuh", () => {
    // Aturan tertulisnya berhenti di "86% – 100%". Membaca batas atas itu
    // sebagai syarat membuat yang paling berprestasi justru tidak cair.
    expect(hasilCair(112)?.jenis).toBe("penuh");
  });

  it("belum ada angkanya BUKAN tidak cair", () => {
    // Nol dan "belum dihitung" adalah dua hal berbeda, dan yang kedua tidak
    // boleh diam-diam jadi keputusan tidak membayar.
    expect(hasilCair(null)).toBeNull();
    expect(hasilCair(Number.NaN)).toBeNull();
  });
});

describe("rata-rata", () => {
  it("mengabaikan yang kosong, bukan menghitungnya nol", () => {
    expect(rata([80, null, 100])).toBe(90);
    expect(rata([null, null])).toBeNull();
    expect(rata([])).toBeNull();
  });
});

describe("baris pencairan", () => {
  const pdq = dept("pdq", "Product Development & Quality", [
    ["Adam", 70],
    ["Abil", 83],
    ["Mustadi", 85],
    ["Bagas", 82],
  ]);
  const heads = [{ nama: "Andi", divisi: "Product Development & Quality" }];

  it("KPI Head adalah rata-rata KPI orang-orang divisinya", () => {
    // (70 + 83 + 85 + 82) / 4 = 80
    const b = barisPencairan([pdq], heads);
    const andi = b.find((x) => x.nama === "Andi")!;
    expect(andi.head).toBe(true);
    expect(andi.personal).toBe(80);
    expect(andi.divisi).toBe(80);
    expect(andi.dasar).toBe(80);
    expect(andi.hasil?.persen).toBe(50);
  });

  it("capaian personal anggota adalah KPI-nya sendiri", () => {
    const abil = barisPencairan([pdq], heads).find((x) => x.nama === "Abil")!;
    expect(abil.personal).toBe(83);
    expect(abil.divisi).toBe(80);
  });

  it("yang menentukan cair adalah RATA-RATA personal dan divisi", () => {
    // Abil (83 + 80) / 2 = 81,5 → separuh. Kalau yang dipakai personalnya saja
    // hasilnya sama; yang membedakan justru Adam di bawah ini.
    const b = barisPencairan([pdq], heads);
    expect(b.find((x) => x.nama === "Abil")!.dasar).toBe(81.5);
    // Adam 70 sendirian tidak cair (70 < 62? tidak — 70 separuh). Yang diuji
    // di sini: angkanya memang gabungan, bukan salah satunya.
    expect(b.find((x) => x.nama === "Adam")!.dasar).toBe(75);
  });

  it("divisi yang kuat MENARIK NAIK yang personalnya di bawah ambang", () => {
    const kuat = dept("x", "X", [
      ["Lemah", 58],
      ["Kuat", 98],
      ["Kuat2", 98],
    ]);
    const b = barisPencairan([kuat], []);
    const lemah = b.find((x) => x.nama === "Lemah")!;
    // personal 58 sendirian tidak cair; dengan divisi 84,67 → (58+84,67)/2 = 71,3 → separuh
    expect(hasilCair(58)!.persen).toBe(0);
    expect(lemah.hasil!.persen).toBe(50);
  });

  it("tanpa capaian personal, pencairannya TIDAK diputuskan otomatis", () => {
    // Memakai capaian divisi sendirian berarti membayar orang semata-mata atas
    // hasil kerja timnya — keputusan yang harus diambil orang, bukan rumus.
    const sebagian = dept("y", "Y", [["Ada", 90], ["Belum", null]]);
    const b = barisPencairan([sebagian], []);
    const belum = b.find((x) => x.nama === "Belum")!;
    expect(belum.personal).toBeNull();
    expect(belum.divisi).toBe(90);
    expect(belum.dasar).toBeNull();
    expect(belum.hasil).toBeNull();
    expect(belum.alasan).toBeTruthy();
  });

  it("baris orang itu TIDAK hilang dari daftar", () => {
    // Hilang dari daftar berarti tidak dibayar tanpa ada yang memutuskan.
    const sebagian = dept("y", "Y", [["Ada", 90], ["Belum", null]]);
    expect(barisPencairan([sebagian], []).map((x) => x.nama).sort()).toEqual(["Ada", "Belum"]);
  });
});

describe("Head yang divisinya belum punya KPI", () => {
  const operational = dept("operational", "Operational", [["A", 90], ["B", 70]]);

  it("Head yang divisinya dinamai persis seperti divisi KPI tetap ketemu", () => {
    // Pemetaan nama→kode tidak boleh jadi satu-satunya jalan: satu nama divisi
    // yang berubah akan membuat Head-nya diam-diam "belum dinilai".
    const b = barisPencairan([operational], [{ nama: "X", divisi: "Operational" }]);
    expect(b.find((x) => x.nama === "X")!.personal).toBe(80);
  });

  it("nama divisi Head mengikuti nama divisi anak buahnya", () => {
    // "Finance Accounting Tax" di sebelah "Finance" terbaca seperti dua divisi.
    const fin = dept("finance", "Finance", [["Bella", 90]]);
    const b = barisPencairan([fin], [{ nama: "Indah", divisi: "Finance Accounting Tax" }]);
    expect(b.find((x) => x.nama === "Indah")!.departemen).toBe("Finance");
  });

  it("Business Development sementara mengikuti Operational", () => {
    const b = barisPencairan([operational], [{ nama: "Ilfiana", divisi: "Business Development" }]);
    const ilfi = b.find((x) => x.nama === "Ilfiana")!;
    expect(ilfi.personal).toBe(80);
    expect(ilfi.divisi).toBe(80);
    expect(ilfi.alasan).toContain("Operational");
  });

  it("divisi tanpa KPI dan tanpa pinjaman TIDAK dihitung nol", () => {
    // Supply Chain belum punya modul KPI dan tidak meminjam dari mana pun.
    // Menampilkannya nol berarti memutuskan tidak membayar atas angka yang
    // tidak pernah dihitung.
    const b = barisPencairan([operational], [{ nama: "Stevanie", divisi: "Supply Chain" }]);
    const s = b.find((x) => x.nama === "Stevanie")!;
    expect(s.personal).toBeNull();
    expect(s.hasil).toBeNull();
    expect(s.alasan).toBeTruthy();
  });
});
