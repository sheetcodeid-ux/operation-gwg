import { describe, expect, it } from "vitest";

import {
  LEBAR_KARTU,
  bolehJadiAtasan,
  cocok,
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
