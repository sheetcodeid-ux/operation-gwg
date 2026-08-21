import { describe, expect, it } from "vitest";

import {
  LEBAR_KOLOM,
  bolehJadiAtasan,
  cocok,
  inisialDari,
  jumlahKeturunan,
  magnet,
  rantaiKeAtas,
  silsilah,
  simpulBercabang,
  tataKolom,
  perLevel,
  ukuranKanvas,
  type SimpulBagan,
} from "./bagan";

const s = (id: string, o: Partial<SimpulBagan> = {}): SimpulBagan => ({
  id,
  nama: id.toUpperCase(),
  level: null,
  parentId: null,
  urutan: null,
  posX: null,
  posY: null,
  jumlahOrang: 0,
  jabatan: [],
  ...o,
});

describe("bolehJadiAtasan", () => {
  const pohon = [s("a"), s("b", { parentId: "a" }), s("c", { parentId: "b" })];

  it("melepas atasan selalu boleh", () => {
    expect(bolehJadiAtasan(pohon, "c", null)).toBe(true);
  });

  it("tidak boleh jadi atasan dirinya sendiri", () => {
    expect(bolehJadiAtasan(pohon, "a", "a")).toBe(false);
  });

  it("tidak boleh mengambil atasan dari keturunannya sendiri", () => {
    // a → b → c. Menjadikan c atasan a berarti lingkaran.
    expect(bolehJadiAtasan(pohon, "a", "c")).toBe(false);
    expect(bolehJadiAtasan(pohon, "a", "b")).toBe(false);
  });

  it("menyambung ke saudara atau ke atas tetap boleh", () => {
    const rows = [s("a"), s("b", { parentId: "a" }), s("c", { parentId: "a" })];
    expect(bolehJadiAtasan(rows, "c", "b")).toBe(true);
  });

  it("id yang tidak dikenal ditolak", () => {
    expect(bolehJadiAtasan(pohon, "c", "entah")).toBe(false);
    expect(bolehJadiAtasan(pohon, "entah", "a")).toBe(false);
  });
});

describe("perLevel", () => {
  it("mengurutkan level menaik dan menaruh yang tanpa level di belakang", () => {
    const rows = [s("x", { level: 3 }), s("y"), s("z", { level: 1 })];
    expect(perLevel(rows).map((b) => b.level)).toEqual([1, 3, null]);
  });

  it("memberi nama level, bukan cuma angkanya", () => {
    expect(perLevel([s("x", { level: 1 })])[0].nama).toContain("Direksi");
  });
});

describe("ukuranKanvas", () => {
  it("tanpa simpul tetap memberi ukuran, bukan nol", () => {
    expect(ukuranKanvas([]).lebar).toBeGreaterThan(0);
  });
});

describe("cocok", () => {
  it("mencari di nama maupun jabatannya", () => {
    const n = s("a", { nama: "Human Capital", jabatan: ["Recruiter", "Payroll Staff"] });
    expect(cocok(n, "human")).toBe(true);
    expect(cocok(n, "payroll")).toBe(true);
    expect(cocok(n, "gudang")).toBe(false);
  });

  it("pencarian kosong mencocokkan semuanya", () => {
    expect(cocok(s("a"), "   ")).toBe(true);
  });
});

describe("inisialDari", () => {
  it("mengambil huruf pertama dua kata pertama", () => {
    expect(inisialDari("Managing Director")).toBe("MD");
    expect(inisialDari("Supply Chain & Warehouse")).toBe("SC");
  });

  it("satu kata hanya satu huruf", () => {
    expect(inisialDari("IT")).toBe("I");
    expect(inisialDari("Legal")).toBe("L");
  });

  it("tanda baca ikut apa adanya bila memang kata kedua", () => {
    expect(inisialDari("Accounting & Verification")).toBe("A&");
  });

  it("nama kosong tidak membuat gagal", () => {
    expect(inisialDari("   ")).toBe("?");
  });
});

describe("jumlahKeturunan", () => {
  const pohon = [
    s("bos"),
    s("a", { parentId: "bos" }),
    s("b", { parentId: "bos" }),
    s("a1", { parentId: "a" }),
    s("a2", { parentId: "a" }),
    s("a1x", { parentId: "a1" }),
  ];

  it("menghitung seluruh keturunan, bukan cuma anak langsung", () => {
    expect(jumlahKeturunan(pohon, "bos")).toBe(5);
    expect(jumlahKeturunan(pohon, "a")).toBe(3);
  });

  it("daun tidak punya keturunan", () => {
    expect(jumlahKeturunan(pohon, "b")).toBe(0);
  });

  it("lingkaran tidak membuat hitungan berputar selamanya", () => {
    expect(jumlahKeturunan([s("x", { parentId: "y" }), s("y", { parentId: "x" })], "x")).toBe(2);
  });
});

describe("tataKolom", () => {
  // Struktur seperti GWG: MD di puncak; Level 2 dan Level 3 sama-sama melapor
  // ke MD; unit Level 4 ke bawah menggantung di divisinya.
  const pohon = [
    s("md", { level: 1 }),
    s("ea", { level: 2, parentId: "md" }),
    s("audit", { level: 2, parentId: "md" }),
    s("it", { level: 3, parentId: "md", urutan: 1 }),
    s("hc", { level: 3, parentId: "md", urutan: 2 }),
    s("bs", { level: 4, parentId: "it", urutan: 1 }),
    s("sd", { level: 4, parentId: "it", urutan: 2 }),
    s("staf", { level: 5, parentId: "bs" }),
  ];

  it("Level 2 SEBARIS mendatar, bukan bertumpuk", () => {
    const t = tataKolom(pohon);
    const [ea, audit] = ["ea", "audit"].map((id) => t.find((n) => n.id === id)!);
    expect(ea.y).toBe(audit.y);
    expect(Math.abs(ea.x - audit.x)).toBeGreaterThanOrEqual(LEBAR_KOLOM);
  });

  it("Level 3 sebaris mendatar DI BAWAH Level 2, meski sama-sama melapor ke MD", () => {
    // Inilah yang salah saat tingkat dihitung dari kedalaman pohon: ketiga
    // belasnya jadi satu baris karena induknya sama-sama Managing Director.
    const t = tataKolom(pohon);
    const [ea, it, hc] = ["ea", "it", "hc"].map((id) => t.find((n) => n.id === id)!);
    expect(it.y).toBe(hc.y);
    expect(it.y).toBeGreaterThan(ea.y);
  });

  it("Level 4 ke bawah MENUMPUK ke bawah di dalam kolom divisinya", () => {
    const t = tataKolom(pohon);
    const [it, bs, sd] = ["it", "bs", "sd"].map((id) => t.find((n) => n.id === id)!);
    expect(bs.y).toBeGreaterThan(it.y);
    expect(sd.y).toBeGreaterThan(bs.y);
    // Bertumpuk, bukan berjajar: selisih x-nya hanya sebesar indentasi.
    expect(Math.abs(bs.x - sd.x)).toBeLessThan(LEBAR_KOLOM);
  });

  it("tiap turun satu tingkat berindentasi sedikit ke kanan", () => {
    const t = tataKolom(pohon);
    const [it, bs, staf] = ["it", "bs", "staf"].map((id) => t.find((n) => n.id === id)!);
    expect(bs.x).toBeGreaterThan(it.x);
    expect(staf.x).toBeGreaterThan(bs.x);
  });

  it("kolom divisi yang berbeda tidak saling menimpa", () => {
    const t = tataKolom(pohon);
    const [it, hc] = ["it", "hc"].map((id) => t.find((n) => n.id === id)!);
    expect(Math.abs(it.x - hc.x)).toBeGreaterThanOrEqual(LEBAR_KOLOM);
  });

  it("puncak berada di baris paling atas", () => {
    const t = tataKolom(pohon);
    expect(t.find((n) => n.id === "md")!.y).toBe(0);
  });

  it("melipat sebuah divisi menyembunyikan seluruh isinya", () => {
    const t = tataKolom(pohon, new Set(["it"]));
    expect(t.find((n) => n.id === "bs")).toBeUndefined();
    expect(t.find((n) => n.id === "staf")).toBeUndefined();
    expect(t.find((n) => n.id === "it")).toBeDefined();
  });

  it("tanpa level sama sekali, kedalaman pohon dipakai sebagai cadangan", () => {
    const tanpaLevel = [s("a"), s("b", { parentId: "a" }), s("c", { parentId: "b" })];
    expect(tataKolom(tanpaLevel)).toHaveLength(3);
  });

  it("lingkaran tidak membuat penelusuran berputar selamanya", () => {
    expect(tataKolom([s("x", { parentId: "y" }), s("y", { parentId: "x" })])).toHaveLength(2);
  });

  it("seluruh simpul tergambar, tidak ada yang hilang", () => {
    expect(tataKolom(pohon)).toHaveLength(pohon.length);
  });
});

describe("silsilah", () => {
  //  bos → a → a1 → a1x ;  bos → b
  const pohon = [
    s("bos"),
    s("a", { parentId: "bos" }),
    s("b", { parentId: "bos" }),
    s("a1", { parentId: "a" }),
    s("a1x", { parentId: "a1" }),
  ];

  it("mencakup dirinya, atasannya ke atas, dan bawahannya ke bawah", () => {
    expect([...silsilah(pohon, "a1")].sort()).toEqual(["a", "a1", "a1x", "bos"]);
  });

  it("tidak menarik cabang saudara", () => {
    expect(silsilah(pohon, "a1").has("b")).toBe(false);
  });

  it("dari puncak mencakup semuanya", () => {
    expect(silsilah(pohon, "bos").size).toBe(pohon.length);
  });

  it("lingkaran tidak membuatnya berputar selamanya", () => {
    const l = [s("x", { parentId: "y" }), s("y", { parentId: "x" })];
    expect(silsilah(l, "x").size).toBe(2);
  });
});

describe("rantaiKeAtas", () => {
  const pohon = [s("bos"), s("a", { parentId: "bos" }), s("a1", { parentId: "a" })];

  it("mengurut dari atasan terdekat ke puncak", () => {
    expect(rantaiKeAtas(pohon, "a1").map((x) => x.id)).toEqual(["a", "bos"]);
  });

  it("puncak tidak punya atasan", () => {
    expect(rantaiKeAtas(pohon, "bos")).toEqual([]);
  });
});

describe("simpulBercabang", () => {
  it("hanya simpul yang benar-benar punya bawahan", () => {
    const pohon = [s("bos"), s("a", { parentId: "bos" }), s("b", { parentId: "bos" })];
    expect(simpulBercabang(pohon)).toEqual(["bos"]);
  });
});

describe("magnet", () => {
  it("menempel PERSIS ke tepi kartu lain yang hampir sejajar", () => {
    const h = magnet(103, 200, [{ x: 100, y: 500 }]);
    expect(h.x).toBe(100);
    expect(h.panduX).toBe(100);
  });

  it("sumbu yang tidak menempel dibulatkan ke kisi", () => {
    const h = magnet(103, 203, [{ x: 100, y: 500 }]);
    expect(h.x).toBe(100);
    expect(h.y).toBe(200); // 203 → kelipatan 8 terdekat
    expect(h.panduY).toBeNull();
  });

  it("tanpa kartu lain, keduanya sekadar dibulatkan ke kisi", () => {
    expect(magnet(13, 29, [])).toEqual({ x: 16, y: 32, panduX: null, panduY: null });
  });

  it("yang terlalu jauh tidak ditarik — jatuh ke kisi, bukan ke kartu itu", () => {
    const h = magnet(140, 200, [{ x: 100, y: 200 }]);
    expect(h.panduX).toBeNull();
    expect(h.x).toBe(144); // kelipatan 8 terdekat, bukan 100
  });

  it("di antara dua kandidat, yang TERDEKAT yang menang", () => {
    const h = magnet(100, 0, [{ x: 96, y: 0 }, { x: 102, y: 0 }]);
    expect(h.x).toBe(102);
  });

  it("menempel di dua sumbu sekaligus bila memang keduanya dekat", () => {
    const h = magnet(101, 301, [{ x: 100, y: 300 }]);
    expect([h.x, h.y]).toEqual([100, 300]);
    expect([h.panduX, h.panduY]).toEqual([100, 300]);
  });
});
