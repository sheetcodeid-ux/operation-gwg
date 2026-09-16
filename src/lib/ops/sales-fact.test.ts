import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cabangTerpetakan,
  jumlahPerOutlet,
  outletTanpaCabang,
  petaCabangOutlet,
  petaHarian,
  saringFakta,
  totalNet,
  type BarisSeasonal,
} from "./sales-fact";
import type { Outlet } from "@/lib/types";

/**
 * PENJUALAN V.1 — yang diuji di sini BARIS MANA YANG BOLEH IKUT.
 *
 * `seasonal_daily` memuat dua hal yang bukan penjualan outlet, dan keduanya
 * tidak kelihatan dari nama kolomnya:
 *
 *   branch = ''      baris KORPORAT — 348 hari, Rp 118.092.066.971
 *   57-fnb_nord      cabang yatim   —  78 hari, Rp 164.030.635
 *
 * Diukur pada Agustus 2026: dari 60 cabang, 48 cocok persis dengan
 * `esb_net_bulanan`, 10 beda tipis (selisih total Rp 25.002 — kedatangan data
 * yang terlambat), dan dua baris di atas menambahkan Rp 13,4 miliar yang
 * seharusnya tidak ikut. Totalnya jadi DUA KALI LIPAT.
 *
 * Kesalahan semacam itu tidak akan terlihat dari layar: angkanya tetap masuk
 * akal, cuma dua kali lebih besar dari yang sebenarnya.
 */

/* ───────────────────────────── contoh data ───────────────────────────── */

const outlet = (id: string, branch: string | null, active = true): Outlet =>
  ({
    id,
    name: `Outlet ${id}`,
    code: `K-${id}`,
    city: "Pontianak",
    areaId: "area-1",
    supervisorId: null,
    picId: null,
    active,
    esbBranchId: branch,
  }) as Outlet;

const OUTLETS: Outlet[] = [
  outlet("o1", "18-fnb_nord"),
  outlet("o2", "22-fnb_cattu"),
  outlet("o3", null), // aktif, BELUM punya cabang ESB
  outlet("o4", "99-fnb_tutup", false), // sudah tidak aktif
];

const baris = (branch: string | null, day: string, net: number | string | null, extra: Partial<BarisSeasonal> = {}): BarisSeasonal => ({
  branch,
  day,
  net,
  ...extra,
});

const peta = () => petaCabangOutlet(OUTLETS);

/* ─────────────────────── tujuh kasus yang wajib ─────────────────────── */

describe("CASE 1 — cabang sah dengan outlet: IKUT", () => {
  it("baris dipetakan ke outletnya", () => {
    const h = saringFakta([baris("18-fnb_nord", "2026-08-01", 1_000_000)], peta());
    expect(h.fakta).toHaveLength(1);
    expect(h.fakta[0].outletId).toBe("o1");
    expect(h.fakta[0].net).toBe(1_000_000);
    expect(h.fakta[0].branch).toBe("18-fnb_nord");
  });
});

describe("CASE 2 — branch kosong: TIDAK IKUT", () => {
  it("string kosong dibuang dan dihitung sebagai korporat", () => {
    const h = saringFakta([baris("", "2026-08-01", 13_325_523_600)], peta());
    expect(h.fakta).toHaveLength(0);
    expect(h.dibuang.korporat).toBe(1);
  });

  it("null dan spasi juga korporat, bukan yatim", () => {
    const h = saringFakta([baris(null, "2026-08-01", 1), baris("   ", "2026-08-02", 1)], peta());
    expect(h.fakta).toHaveLength(0);
    expect(h.dibuang.korporat).toBe(2);
    expect(h.dibuang.yatim).toBe(0);
  });
});

describe("CASE 3 — cabang tanpa outlet: TIDAK IKUT", () => {
  it("dibuang sebagai yatim, dan cabangnya dilaporkan", () => {
    const h = saringFakta([baris("57-fnb_nord", "2026-08-01", 80_980_273)], peta());
    expect(h.fakta).toHaveLength(0);
    expect(h.dibuang.yatim).toBe(1);
    expect(h.dibuang.cabangYatim).toEqual(["57-fnb_nord"]);
  });

  it("cabang milik outlet NONAKTIF juga yatim", () => {
    // Outlet yang sudah tutup tidak boleh menyumbang penjualan ke periode baru.
    const h = saringFakta([baris("99-fnb_tutup", "2026-08-01", 5_000_000)], peta());
    expect(h.fakta).toHaveLength(0);
    expect(h.dibuang.cabangYatim).toEqual(["99-fnb_tutup"]);
  });
});

describe("CASE 4 — outlet tanpa esb_branch_id tidak dipaksa punya penjualan", () => {
  it("tidak masuk peta cabang sama sekali", () => {
    const p = peta();
    expect([...p.values()]).not.toContain("o3");
    expect(cabangTerpetakan(OUTLETS)).toEqual(["18-fnb_nord", "22-fnb_cattu"]);
  });

  it("disebut terang-terangan, bukan didiamkan", () => {
    expect(outletTanpaCabang(OUTLETS).map((o) => o.id)).toEqual(["o3"]);
  });

  it("tidak muncul di hasil agregasi mana pun", () => {
    const h = saringFakta(
      [baris("18-fnb_nord", "2026-08-01", 100), baris("22-fnb_cattu", "2026-08-01", 200)],
      peta(),
    );
    expect(jumlahPerOutlet(h.fakta).map((r) => r.outletId)).toEqual(["o2", "o1"]);
  });
});

describe("CASE 5 — aturan cabangnya sama dengan Daily existing", () => {
  /**
   * Rekonsiliasi angka sungguhan menuntut basis data, dan uji ini berjalan
   * tanpa basis data. Yang bisa dijamin di sini: KEDUANYA MENURUNKAN DAFTAR
   * CABANG DARI ATURAN YANG SAMA — outlet aktif yang punya `esbBranchId`.
   *
   * Selama aturannya sama dan sumbernya satu tabel, angkanya tidak bisa
   * berbeda. Yang dijaga justru kalau suatu hari salah satunya diubah.
   */
  const kelengkapan = readFileSync(join(process.cwd(), "src/lib/data/kelengkapan-daily.ts"), "utf8");
  const daily = readFileSync(join(process.cwd(), "src/lib/data/daily-outlet.ts"), "utf8");

  it("cabangDaily existing memakai aturan aktif + punya cabang", () => {
    expect(kelengkapan).toContain("o.active && !!o.esbBranchId");
  });

  it("Daily menyaring barisnya lewat daftar cabang, bukan membaca tabel mentah", () => {
    // Inilah sebabnya Daily tidak pernah terkena hitung ganda.
    expect(daily).toContain('.in("branch", cabang)');
    expect(daily).toContain("outlet.filter((o) => !!o.esbBranchId)");
  });

  it("cabangTerpetakan menghasilkan daftar yang sama untuk outlet yang sama", () => {
    // Aturan Daily ditulis ulang di sini SEBAGAI PEMBANDING, bukan sebagai
    // implementasi — kalau keduanya berbeda, uji ini yang gagal lebih dulu.
    const caraDaily = [
      ...new Set(OUTLETS.filter((o) => o.active && !!o.esbBranchId).map((o) => o.esbBranchId as string)),
    ];
    expect(cabangTerpetakan(OUTLETS)).toEqual(caraDaily);
  });
});

describe("CASE 6 — total tidak menghitung ganda karena baris korporat", () => {
  it("baris korporat sebesar seluruh cabang digabung tidak menggandakan total", () => {
    // Bentuknya persis keadaan Agustus 2026: korporat kira-kira sama besar
    // dengan jumlah seluruh cabang.
    const cabang = [
      baris("18-fnb_nord", "2026-08-01", 6_000_000),
      baris("22-fnb_cattu", "2026-08-01", 7_000_000),
    ];
    const korporat = baris("", "2026-08-01", 13_000_000);

    const tanpaSaringan = [...cabang, korporat].reduce((n, r) => n + Number(r.net), 0);
    const denganSaringan = totalNet(saringFakta([...cabang, korporat], peta()).fakta);

    expect(tanpaSaringan).toBe(26_000_000); // inilah angka yang salah
    expect(denganSaringan).toBe(13_000_000); // dan inilah yang benar
    expect(denganSaringan * 2).toBe(tanpaSaringan);
  });
});

describe("CASE 7 — 57-fnb_nord tidak masuk agregat outlet", () => {
  it("tidak menambah total walau barisnya ada tiap hari", () => {
    const rows = [
      baris("18-fnb_nord", "2026-08-01", 1_000_000),
      ...Array.from({ length: 31 }, (_, i) => baris("57-fnb_nord", `2026-08-${String(i + 1).padStart(2, "0")}`, 2_612_269)),
    ];
    const h = saringFakta(rows, peta());
    expect(totalNet(h.fakta)).toBe(1_000_000);
    expect(h.dibuang.yatim).toBe(31);
    expect(h.dibuang.cabangYatim).toEqual(["57-fnb_nord"]);
  });
});

/* ───────────────────── nol bukan hilang ───────────────────── */

describe("nol jualan BUKAN data hilang", () => {
  it("net nol tetap fakta yang sah", () => {
    const h = saringFakta([baris("18-fnb_nord", "2026-08-01", 0)], peta());
    expect(h.fakta).toHaveLength(1);
    expect(h.fakta[0].net).toBe(0);
    expect(h.dibuang.cacat).toBe(0);
  });

  it("net null adalah baris cacat, bukan nol jualan", () => {
    const h = saringFakta([baris("18-fnb_nord", "2026-08-01", null)], peta());
    expect(h.fakta).toHaveLength(0);
    expect(h.dibuang.cacat).toBe(1);
  });

  it("net berupa teks yang bukan angka juga cacat", () => {
    const h = saringFakta([baris("18-fnb_nord", "2026-08-01", "entah")], peta());
    expect(h.dibuang.cacat).toBe(1);
  });

  it("net berupa teks angka diterima — basis data mengirim numeric sebagai string", () => {
    const h = saringFakta([baris("18-fnb_nord", "2026-08-01", "1234567.89")], peta());
    expect(h.fakta[0].net).toBeCloseTo(1_234_567.89, 2);
  });

  it("tanggal yang bentuknya salah dihitung cacat", () => {
    const h = saringFakta(
      [baris("18-fnb_nord", "01-08-2026", 100), baris("18-fnb_nord", "", 100)],
      peta(),
    );
    expect(h.fakta).toHaveLength(0);
    expect(h.dibuang.cacat).toBe(2);
  });
});

/* ───────────────────────────── agregasi ───────────────────────────── */

describe("agregasi per outlet", () => {
  const rows = [
    baris("18-fnb_nord", "2026-08-01", 100, { gross: 120, pax: 10, bills: 8 }),
    baris("18-fnb_nord", "2026-08-02", 200, { gross: 240, pax: 20, bills: 16 }),
    baris("22-fnb_cattu", "2026-08-01", 50),
    baris("", "2026-08-01", 999_999),
  ];

  it("menjumlah per outlet dan mengurutkan dari terbesar", () => {
    const r = jumlahPerOutlet(saringFakta(rows, peta()).fakta);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ outletId: "o1", net: 300, gross: 360, pax: 30, bills: 24, hariAda: 2 });
    expect(r[1]).toMatchObject({ outletId: "o2", net: 50, hariAda: 1 });
  });

  it("gross/pax/bills tetap NULL bila tidak satu pun terukur", () => {
    // Null berarti "tidak pernah diukur", nol berarti "diukur dan hasilnya nol".
    // Menyamakannya membuat outlet tanpa data struk terbaca seperti outlet
    // tanpa pengunjung.
    const r = jumlahPerOutlet(saringFakta([baris("22-fnb_cattu", "2026-08-01", 50)], peta()).fakta);
    expect(r[0].gross).toBeNull();
    expect(r[0].pax).toBeNull();
    expect(r[0].bills).toBeNull();
  });

  it("hariAda menghitung baris, bukan hari dalam periodenya", () => {
    const r = jumlahPerOutlet(saringFakta(rows, peta()).fakta);
    expect(r[0].hariAda).toBe(2); // bukan 31
  });

  it("peta harian berkunci outlet dan tanggal", () => {
    const p = petaHarian(saringFakta(rows, peta()).fakta);
    expect(p.get("o1|2026-08-02")).toBe(200);
    expect(p.get("o2|2026-08-01")).toBe(50);
    expect(p.has("|2026-08-01")).toBe(false);
  });
});

describe("dua outlet berbagi satu cabang", () => {
  it("yang pertama menang, penjualannya tidak digandakan", () => {
    const kembar = [outlet("a1", "sama-fnb"), outlet("a2", "sama-fnb")];
    const p = petaCabangOutlet(kembar);
    expect(p.get("sama-fnb")).toBe("a1");
    const h = saringFakta([baris("sama-fnb", "2026-08-01", 500)], p);
    expect(h.fakta).toHaveLength(1);
    expect(totalNet(h.fakta)).toBe(500); // bukan 1000
  });
});

describe("masukan kosong", () => {
  it("tidak meledak", () => {
    const h = saringFakta([], peta());
    expect(h.fakta).toEqual([]);
    expect(h.dibuang).toMatchObject({ korporat: 0, yatim: 0, cacat: 0, cabangYatim: [] });
    expect(totalNet([])).toBe(0);
    expect(jumlahPerOutlet([])).toEqual([]);
  });

  it("tanpa outlet sama sekali, semua baris jadi yatim", () => {
    const h = saringFakta([baris("18-fnb_nord", "2026-08-01", 100)], petaCabangOutlet([]));
    expect(h.fakta).toEqual([]);
    expect(h.dibuang.yatim).toBe(1);
  });
});
