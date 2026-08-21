import { describe, expect, it } from "vitest";

import {
  LEBAR_KARTU,
  LEBAR_KOLOM,
  bolehJadiAtasan,
  cocok,
  inisialDari,
  jumlahKeturunan,
  rantaiKeAtas,
  silsilah,
  simpulBercabang,
  tataKolom,
  garisBagan,
  perLevel,
  tataPohon,
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

describe("tataPohon", () => {
  it("induk berada tepat di tengah anak-anaknya", () => {
    const rows = [s("bos"), s("x", { parentId: "bos" }), s("y", { parentId: "bos" })];
    const t = tataPohon(rows);
    const bos = t.find((n) => n.id === "bos")!;
    const x = t.find((n) => n.id === "x")!;
    const y = t.find((n) => n.id === "y")!;
    expect(bos.x).toBe((x.x + y.x) / 2);
    expect(bos.y).toBeLessThan(x.y);
  });

  it("anak tunggal membuat induk tepat di atasnya", () => {
    const t = tataPohon([s("bos"), s("x", { parentId: "bos" })]);
    expect(t.find((n) => n.id === "bos")!.x).toBe(t.find((n) => n.id === "x")!.x);
  });

  it("posisi hasil geseran menang atas tata letak otomatis", () => {
    const t = tataPohon([s("a", { posX: 999, posY: 555 })]);
    expect(t[0]).toMatchObject({ x: 999, y: 555 });
  });

  it("LINGKARAN tidak membuat penelusuran berputar selamanya", () => {
    const rows = [s("a", { parentId: "b" }), s("b", { parentId: "a" })];
    const t = tataPohon(rows);
    expect(t).toHaveLength(2);
  });

  it("atasan yang menunjuk id terhapus tetap digambar sebagai akar", () => {
    const t = tataPohon([s("a", { parentId: "sudah-dihapus" })]);
    expect(t).toHaveLength(1);
    expect(t[0].kedalaman).toBe(0);
  });

  it("beberapa akar tidak saling menimpa", () => {
    const t = tataPohon([s("a"), s("b")]);
    const [a, b] = ["a", "b"].map((id) => t.find((n) => n.id === id)!);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(LEBAR_KARTU);
  });

  it("urutan menentukan siapa di kiri", () => {
    const rows = [
      s("bos"),
      s("kanan", { parentId: "bos", urutan: 2 }),
      s("kiri", { parentId: "bos", urutan: 1 }),
    ];
    const t = tataPohon(rows);
    expect(t.find((n) => n.id === "kiri")!.x).toBeLessThan(t.find((n) => n.id === "kanan")!.x);
  });
});

describe("garisBagan", () => {
  it("menggambar satu garis per hubungan induk-anak", () => {
    const t = tataPohon([s("bos"), s("x", { parentId: "bos" })]);
    const g = garisBagan(t);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ dari: "bos", ke: "x" });
    expect(g[0].y1).toBeLessThan(g[0].y2);
  });

  it("akar tanpa induk tidak menghasilkan garis menggantung", () => {
    expect(garisBagan(tataPohon([s("a")]))).toEqual([]);
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
  // bos → (ea) → (div1, div2); div1 → sub1 → sub1a
  const pohon = [
    s("bos"),
    s("ea", { parentId: "bos" }),
    s("div1", { parentId: "ea", urutan: 1 }),
    s("div2", { parentId: "ea", urutan: 2 }),
    s("sub1", { parentId: "div1" }),
    s("sub1a", { parentId: "sub1" }),
  ];

  it("keturunan sebuah kolom menumpuk pada x yang SAMA", () => {
    const t = tataKolom(pohon);
    const [div1, sub1, sub1a] = ["div1", "sub1", "sub1a"].map((id) => t.find((n) => n.id === id)!);
    expect(sub1.x).toBe(div1.x);
    expect(sub1a.x).toBe(div1.x);
    expect(sub1.y).toBeGreaterThan(div1.y);
    expect(sub1a.y).toBeGreaterThan(sub1.y);
  });

  it("kolom yang berbeda tidak saling menimpa", () => {
    const t = tataKolom(pohon);
    const [div1, div2] = ["div1", "div2"].map((id) => t.find((n) => n.id === id)!);
    expect(Math.abs(div1.x - div2.x)).toBeGreaterThanOrEqual(LEBAR_KOLOM);
  });

  it("melipat sebuah simpul menyembunyikan seluruh keturunannya", () => {
    const t = tataKolom(pohon, new Set(["div1"]));
    expect(t.find((n) => n.id === "sub1")).toBeUndefined();
    expect(t.find((n) => n.id === "sub1a")).toBeUndefined();
    expect(t.find((n) => n.id === "div1")).toBeDefined();
  });

  it("akar berada di paling atas", () => {
    const t = tataKolom(pohon);
    const bos = t.find((n) => n.id === "bos")!;
    expect(bos.y).toBe(0);
    expect(t.every((n) => n.y >= bos.y)).toBe(true);
  });

  it("lingkaran tidak membuat penelusuran berputar selamanya", () => {
    const t = tataKolom([s("a", { parentId: "b" }), s("b", { parentId: "a" })]);
    expect(t).toHaveLength(2);
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
