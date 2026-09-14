import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PENARIKAN BORONGAN — inilah yang mengubah "berhari-hari" jadi "berpuluh menit".
 *
 * Yang diuji di sini bukan angkanya melainkan PERILAKUNYA di keadaan buruk,
 * karena keadaan buruk itulah yang dulu memakan waktu tanpa terlihat: ESB
 * mengerem sesudah puluhan permintaan beruntun, dan tulisan ke basis data bisa
 * gagal sesudah panggilannya sendiri berhasil. Dua-duanya pernah terjadi.
 */

const esb = vi.hoisted(() => ({
  tunda: 5,
  gagalSampai: 0,
  panggil: 0,
  sedang: 0,
  puncak: 0,
}));

const dbSt = vi.hoisted(() => ({
  ditulis: [] as { day: string; branch: string }[][],
  gagalTulis: false,
  /** Baris yang seolah-olah sudah tersimpan, untuk uji pencarian lubang. */
  tersimpan: [] as { day: string; branch: string; synced_at: string }[],
}));

vi.mock("./db", () => ({
  dbEnabled: true,
  db: () => ({
    from: () => {
      const rantai = {
        select: () => rantai,
        in: () => rantai,
        gte: () => rantai,
        lte: () => rantai,
        order: () => rantai,
        range: async (a: number, b: number) => ({ data: dbSt.tersimpan.slice(a, b + 1), error: null }),
        upsert: async (rows: { day: string; branch: string }[]) => {
          dbSt.ditulis.push(rows);
          return dbSt.gagalTulis ? { error: { message: "tulis gagal" } } : { error: null };
        },
      };
      return rantai;
    },
  }),
}));

vi.mock("@/lib/integrations/esb-client", () => ({
  esbConfigured: () => true,
  esbEnsureDeadline: () => {},
  esbListBranches: async () => [],
  esbFetchSales: async () => {
    esb.panggil += 1;
    esb.sedang += 1;
    esb.puncak = Math.max(esb.puncak, esb.sedang);
    try {
      await new Promise((r) => setTimeout(r, esb.tunda));
      if (esb.panggil <= esb.gagalSampai) throw new Error("ESB menolak");
      return { gross: 1, net: 1, pax: 1, bills: 1 };
    } finally {
      esb.sedang -= 1;
    }
  },
}));

const { tarikPasangan, lubangSeasonal } = await import("./seasonal");

const tugas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ branch: `b${i % 5}`, day: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }));

beforeEach(() => {
  esb.tunda = 5;
  esb.gagalSampai = 0;
  esb.panggil = 0;
  esb.sedang = 0;
  esb.puncak = 0;
  dbSt.ditulis = [];
  dbSt.gagalTulis = false;
  dbSt.tersimpan = [];
});

describe("beberapa panggilan sekaligus", () => {
  it("benar-benar berbarengan, bukan satu-satu", async () => {
    // Inti perbaikannya. Satu panggilan highlight ke ESB 0,6–1 detik dan
    // hampir seluruhnya menunggu jaringan; menunggunya satu per satu berarti
    // 11.000 detik murni menunggu.
    const r = await tarikPasangan(tugas(40), { budgetMs: 10_000, konkuren: 6 });
    expect(r.terisi).toBe(40);
    expect(esb.puncak).toBe(6);
  });

  it("tidak melewati batas atas walau diminta lebih", async () => {
    await tarikPasangan(tugas(60), { budgetMs: 10_000, konkuren: 50 });
    expect(esb.puncak).toBeLessThanOrEqual(10);
  });
});

describe("rem ESB", () => {
  it("mengecilkan jumlah panggilan berbarengan saat gagal beruntun", async () => {
    // ESB berhenti menjawab sebentar sesudah permintaan bertubi-tubi. Yang
    // pertama dikorbankan jumlah panggilan berbarengan — bukan langsung
    // menyerah, karena menyerah berarti jendela itu pulang dengan tangan
    // kosong.
    esb.gagalSampai = 30;
    const r = await tarikPasangan(tugas(60), { budgetMs: 2_500, konkuren: 6 });
    expect(r.konkuren).toBeLessThan(6);
    expect(r.gagal).toBeGreaterThan(0);
  }, 15_000);

  it("keadaan terburuknya sama dengan cara lama, bukan lebih buruk", async () => {
    // Serendah-rendahnya tetap satu pekerja yang jalan, jadi penarikan tidak
    // pernah berhenti total gara-gara pengecilan ini.
    esb.gagalSampai = 200;
    const r = await tarikPasangan(tugas(300), { budgetMs: 3_000, konkuren: 6 });
    expect(r.konkuren).toBe(1);
    expect(r.error).toBeTruthy();
  }, 25_000);

  it("TIDAK mati di rem pertama — sisa jendelanya tetap dipakai", async () => {
    // Inilah yang dulu terjadi di produksi: rem datang di detik ke-12, lalu
    // tiga puluh detik sisanya terbuang tanpa satu baris pun bertambah.
    // Sesudah remnya lewat, penarikan harus jalan lagi sendiri.
    esb.gagalSampai = 14; // 14 panggilan pertama ditolak, sesudahnya normal
    const r = await tarikPasangan(tugas(120), { budgetMs: 12_000, konkuren: 4 });
    expect(r.gagal).toBeGreaterThan(0);
    expect(r.terisi).toBeGreaterThan(50);
    expect(r.jeda).toBeGreaterThan(0);
  }, 25_000);

  it("mencatat berapa kali ESB dipanggil, bukan cuma yang berhasil", async () => {
    // Bentuk rem ESB hanya bisa dibaca dari jumlah panggilan; tanpa angka ini
    // letak batasnya cuma bisa ditebak.
    const r = await tarikPasangan(tugas(20), { budgetMs: 10_000, konkuren: 4 });
    expect(r.panggilan).toBe(20);
    expect(r.konkurenAwal).toBe(4);
  });
});

describe("penulisan ke basis data", () => {
  it("borongan, bukan satu baris satu perjalanan", async () => {
    await tarikPasangan(tugas(50), { budgetMs: 10_000, konkuren: 5 });
    expect(dbSt.ditulis.length).toBeLessThanOrEqual(4);
    expect(dbSt.ditulis.reduce((n, b) => n + b.length, 0)).toBe(50);
  });

  it("sisa yang belum sempat penuh satu borongan tetap ditulis", async () => {
    // Tanpa penuangan terakhir, sampai 24 baris terakhir tiap jendela hilang —
    // dan ditarik ulang jendela berikutnya, selamanya.
    await tarikPasangan(tugas(12), { budgetMs: 10_000, konkuren: 4 });
    expect(dbSt.ditulis.reduce((n, b) => n + b.length, 0)).toBe(12);
  });

  it("baris yang GAGAL ditulis tidak dihitung sebagai terisi", async () => {
    // Menghitungnya terisi membuat layar melaporkan kemajuan yang tidak ada di
    // basis data — dan pengejaran otomatis berhenti karena mengira sudah maju.
    dbSt.gagalTulis = true;
    const r = await tarikPasangan(tugas(30), { budgetMs: 10_000, konkuren: 5 });
    expect(r.terisi).toBe(0);
    expect(r.gagal).toBe(30);
    expect(r.error).toBe("tulis gagal");
  });
});

describe("anggaran waktu", () => {
  it("berhenti saat waktunya habis, tidak menghabiskan seluruh daftar", async () => {
    // Vercel memutus permintaan di detik ke-60. Jendela yang kelewat batas
    // pulang tanpa apa pun — termasuk baris yang sudah sempat ditarik.
    esb.tunda = 20;
    const r = await tarikPasangan(tugas(5_000), { budgetMs: 300, konkuren: 4 });
    expect(r.terisi).toBeGreaterThan(0);
    expect(r.terisi).toBeLessThan(5_000);
  });

  it("daftar kosong tidak memanggil ESB sama sekali", async () => {
    const r = await tarikPasangan([], { budgetMs: 10_000 });
    expect(r.terisi).toBe(0);
    expect(esb.panggil).toBe(0);
  });
});

describe("mencari lubang", () => {
  const SUDAH = "2026-02-01T00:00:00.000Z"; // sesudah hari-hari yang diuji berakhir

  it("hanya memulangkan pasangan yang memang belum ada", async () => {
    dbSt.tersimpan = [{ day: "2026-01-01", branch: "a", synced_at: SUDAH }];
    const l = await lubangSeasonal("2026-01-01", "2026-01-02", ["a", "b"]);
    expect(l).toEqual([
      { branch: "b", day: "2026-01-01" },
      { branch: "a", day: "2026-01-02" },
      { branch: "b", day: "2026-01-02" },
    ]);
  });

  it("urutannya tanggal dulu baru cabang", async () => {
    // Supaya panggilan yang berjalan berbarengan selalu mengenai cabang yang
    // BERBEDA, bukan menumpuk di satu cabang yang sama.
    const l = await lubangSeasonal("2026-01-01", "2026-01-03", ["a", "b", "c"]);
    expect(l.slice(0, 3).map((t) => t.branch)).toEqual(["a", "b", "c"]);
    expect(l.slice(0, 3).every((t) => t.day === "2026-01-01")).toBe(true);
  });

  it("tanpa cabang berarti tidak ada pekerjaan", async () => {
    expect(await lubangSeasonal("2026-01-01", "2026-01-31", [])).toEqual([]);
  });
});
