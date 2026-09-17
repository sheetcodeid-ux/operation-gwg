import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { periksaHasil } from "./kpi-generate";
import type { NilaiKpi, NilaiTarget } from "@/lib/ops/kpi-sales";

/**
 * GERBANG SEBELUM MENULIS.
 *
 * Basis data sudah punya CHECK dan unique index-nya sendiri, dan itu memang
 * jaring terakhir. Tapi jaring terakhir memberi pesan basis data — "violates
 * check constraint kpi_values_nilai_sepakat" — yang tidak menyebut baris mana,
 * outlet mana, atau kenapa. Pemeriksaan di sini yang menyebutkannya, dan ia
 * berjalan SEBELUM satu baris pun berpindah.
 */

const AKTIF = new Set(["sales.net_sales", "sales.monthly_target", "biaya.rent_pct"]);

const nilai = (p: Partial<NilaiKpi> = {}): NilaiKpi => ({
  kpiDefinitionId: "sales.net_sales",
  cakupan: "outlet",
  outletId: "o1",
  areaId: null,
  periode: "2026-09",
  skala: "bulanan",
  nilai: 1_000,
  status: "sementara",
  sumber: "seasonal_daily",
  rumus: "jumlah-harian",
  rumusVersi: 1,
  sumberSah: true,
  kelengkapanPersen: null,
  jumlahHari: null,
  catatan: null,
  ...p,
});

const target = (p: Partial<NilaiTarget> = {}): NilaiTarget => ({
  kpiDefinitionId: "sales.monthly_target",
  cakupan: "outlet",
  outletId: "o1",
  areaId: null,
  periode: "2026-09",
  skala: "bulanan",
  nilai: 2_000,
  sumber: "rumus",
  rumus: "avg3-tumbuh",
  rumusVersi: 1,
  dasar: { bulan: [], riwayat: [], dipakai: [], pertumbuhan: 15 },
  ...p,
});

const periksa = (n: NilaiKpi[], t: NilaiTarget[] = []) => periksaHasil("2026-09", n, t, AKTIF);

describe("yang lolos", () => {
  it("satu baris wajar", () => {
    expect(() => periksa([nilai()])).not.toThrow();
  });

  it("baris kosong yang berstatus tidak_tersedia", () => {
    expect(() => periksa([nilai({ nilai: null, status: "tidak_tersedia" })])).not.toThrow();
  });

  it("nilai negatif — laba bersih memang bisa minus", () => {
    expect(() => periksa([nilai({ kpiDefinitionId: "biaya.rent_pct", nilai: -3.5 })])).not.toThrow();
  });

  it("nol adalah angka yang sah, bukan kekosongan", () => {
    expect(() => periksa([nilai({ nilai: 0 })])).not.toThrow();
  });
});

describe("angka yang bukan angka", () => {
  it("NaN ditolak", () => {
    expect(() => periksa([nilai({ nilai: Number.NaN })])).toThrow(/bukan angka terhingga/);
  });

  it("Infinity ditolak", () => {
    expect(() => periksa([nilai({ nilai: Number.POSITIVE_INFINITY })])).toThrow(/bukan angka terhingga/);
  });

  it("-Infinity ditolak", () => {
    expect(() => periksa([nilai({ nilai: Number.NEGATIVE_INFINITY })])).toThrow(/bukan angka terhingga/);
  });
});

describe("kosong dan status harus sepakat", () => {
  it("kosong tapi disebut sementara — ditolak", () => {
    expect(() => periksa([nilai({ nilai: null, status: "sementara" })])).toThrow(/bernilai kosong tapi berstatus/);
  });

  it("kosong tapi disebut final — ditolak", () => {
    expect(() => periksa([nilai({ nilai: null, status: "final" })])).toThrow(/bernilai kosong tapi berstatus/);
  });

  it("berstatus tidak_tersedia tapi punya nilai — ditolak", () => {
    // Omzet nol yang diam-diam jadi 0% akan lolos kalau pemeriksaan ini tidak ada.
    expect(() => periksa([nilai({ nilai: 0, status: "tidak_tersedia" })])).toThrow(/tapi punya nilai/);
  });
});

describe("grain", () => {
  it("dua baris dengan grain sama ditolak sebelum basis data menolaknya", () => {
    expect(() => periksa([nilai(), nilai()])).toThrow(/grain kembar/);
  });

  it("outlet berbeda bukan kembar", () => {
    expect(() => periksa([nilai(), nilai({ outletId: "o2" })])).not.toThrow();
  });

  it("korporat dan outlet pada KPI yang sama bukan kembar", () => {
    expect(() => periksa([nilai(), nilai({ cakupan: "korporat", outletId: null })])).not.toThrow();
  });

  it("dua baris korporat pada KPI yang sama ADALAH kembar", () => {
    // Keduanya ber-outlet_id null, jadi unique index biasa tidak akan
    // menangkapnya. Inilah celah yang ditutup `cakupan_id` di migrasi 0103.
    const k = nilai({ cakupan: "korporat", outletId: null });
    expect(() => periksa([k, { ...k }])).toThrow(/grain kembar/);
  });
});

describe("periode dan skala", () => {
  it("periode yang tidak berbentuk YYYY-MM ditolak", () => {
    expect(() => periksaHasil("2026-9", [nilai()], [], AKTIF)).toThrow(/periode tidak sah/);
  });

  it("baris berperiode lain ditolak — Agustus tidak boleh menyelinap ke September", () => {
    expect(() => periksa([nilai({ periode: "2026-08" })])).toThrow(/berperiode 2026-08/);
  });

  it("skala selain bulanan ditolak", () => {
    expect(() => periksa([nilai({ skala: "harian" })])).toThrow(/berskala harian/);
  });

  it("hasil kosong ditolak — bukan dianggap sukses", () => {
    expect(() => periksa([])).toThrow(/tidak ada satu pun baris/);
  });
});

describe("definisi KPI", () => {
  it("KPI yang tidak ada di katalog ditolak", () => {
    expect(() => periksa([nilai({ kpiDefinitionId: "biaya.tidak_ada" })])).toThrow(/tidak ada atau tidak aktif/);
  });

  it("status yang tidak dikenal ditolak", () => {
    expect(() => periksa([nilai({ status: "hampir" as NilaiKpi["status"] })])).toThrow(/status tidak dikenal/);
  });
});

describe("target", () => {
  it("target wajar lolos", () => {
    expect(() => periksa([nilai()], [target()])).not.toThrow();
  });

  it("outlet yang belum berhak TIDAK menghasilkan baris target sama sekali", () => {
    // `targets.nilai` NOT NULL. Yang belum genap tiga bulan hilang dari daftar,
    // bukan muncul dengan nilai kosong.
    expect(() => periksa([nilai()], [])).not.toThrow();
  });

  it("target kosong ditolak", () => {
    expect(() => periksa([nilai()], [target({ nilai: null as unknown as number })])).toThrow(/bukan angka terhingga/);
  });

  it("target NaN ditolak", () => {
    expect(() => periksa([nilai()], [target({ nilai: Number.NaN })])).toThrow(/bukan angka terhingga/);
  });

  it("target bersumber tangan ditolak — generator hanya menulis target berumus", () => {
    expect(() => periksa([nilai()], [target({ sumber: "manual" as NilaiTarget["sumber"] })])).toThrow(/bukan bersumber rumus/);
  });

  it("dua target untuk outlet yang sama ditolak", () => {
    expect(() => periksa([nilai()], [target(), target()])).toThrow(/grain target kembar/);
  });

  it("target berperiode lain ditolak", () => {
    expect(() => periksa([nilai()], [target({ periode: "2026-08" })])).toThrow(/berperiode 2026-08/);
  });
});

/* ────────────────────────── penjaga sumber ────────────────────────── */

/** Badan `hitungPeriode()` saja — berhenti sebelum penyusun muatan RPC. */
const badanHitungPeriode = (kode: string) =>
  kode.slice(kode.indexOf("export async function hitungPeriode"), kode.indexOf("const muatanNilai"));

const kodeTanpaKomentar = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

describe("orkestrator tidak boleh menumbuhkan rumusnya sendiri", () => {
  const kode = kodeTanpaKomentar("src/lib/data/kpi-generate.ts");

  it("memanggil ketiga mesin yang sudah ada", () => {
    expect(kode).toContain("hitungSales(");
    expect(kode).toContain("hitungTargetSales(");
    expect(kode).toContain("hitungKeuangan(");
  });

  it("tidak ada mesin bayangan bernama *Recurring", () => {
    expect(kode).not.toMatch(/hitung\w*Recurring/);
  });

  it("penyebut KPI keuangan tidak pernah op_pnl.pendapatan", () => {
    // Nol di seluruh 174 baris — memakainya berarti tiap KPI keuangan membagi nol.
    expect(kode).not.toContain("pendapatan");
  });

  it("tidak memakai grossOutlet sebagai penyebut KPI", () => {
    // `grossOutlet` memang dipakai, tapi HANYA untuk riwayat target. Penyebut
    // KPI datang dari `saringFakta` atas `seasonal_daily`.
    const badan = badanHitungPeriode(kode);
    expect(badan).toContain("saringFakta(");
    expect(badan).not.toContain("grossOutlet(");
  });

  it("laju pertumbuhan dibaca dari indikatornya, tidak ditulis di sini", () => {
    expect(kode).toContain("tumbuhCa()");
    expect(kode).not.toMatch(/pertumbuhan:\s*\d/);
  });
});

describe("tidak menyentuh ESB", () => {
  const kode = kodeTanpaKomentar("src/lib/data/kpi-generate.ts");

  it("tidak mengambil sewa ESB", () => {
    expect(kode).not.toContain("ambilKunciEsb");
    expect(kode).not.toContain("lepasKunciEsb");
  });

  it("tidak memanggil satu pun penarik ESB", () => {
    for (const p of ["syncSeasonalDays", "syncNetBulanan", "syncFraudRange", "esbSetDeadline", "syncEsbMenus"]) {
      expect(kode).not.toContain(p);
    }
  });
});

describe("pembacaannya massal, bukan satu query per outlet", () => {
  const kode = kodeTanpaKomentar("src/lib/data/kpi-generate.ts");

  it("tidak ada query di dalam perulangan outlet", () => {
    // Di dalam `hitungPeriode` tidak boleh ada `db()` sama sekali: seluruh
    // bacaannya lewat fungsi baca massal yang sudah disiapkan di atas.
    expect(badanHitungPeriode(kode)).not.toContain("db()");
  });

  it("op_expenses, op_purchases, dan op_pnl dibaca sekali per bulan", () => {
    expect(kode).toContain("listExpenses(periode)");
    expect(kode).toContain("listPurchases(periode)");
    expect(kode).toContain("listPnl(periode)");
  });
});

describe("rute cron mengikuti pola yang sudah ada", () => {
  const rute = kodeTanpaKomentar("src/app/api/cron/kpi-bulanan/route.ts");

  it("memakai cronAuthorized, bukan pemeriksaan buatan sendiri", () => {
    expect(rute).toContain("cronAuthorized(req");
    expect(rute).toContain('"kpi_bulanan_token"');
  });

  it("tidak ada satu pun rahasia yang ditulis di berkasnya", () => {
    expect(rute).not.toMatch(/token\s*=\s*["'][A-Za-z0-9_-]{8,}/);
    expect(rute).not.toContain("CRON_SECRET");
  });

  it("gagal membalas 500, bukan 200", () => {
    expect(rute).toContain("status: 500");
  });

  it("melapor ke sinkron_sehat, sukses maupun gagal", () => {
    // Dihitung di badan GET saja: jalur remediasi (TASK #88B) punya kunci
    // `sinkron_sehat` sendiri dan diuji terpisah, jadi mencampur keduanya
    // membuat angka ini tidak lagi berarti apa-apa.
    const badanGet = rute.slice(rute.indexOf("export async function GET"), rute.indexOf("async function remediasi"));
    expect(badanGet.match(/catatHasilSinkron\(/g) ?? []).toHaveLength(2);
    expect(rute).toContain("error: pesan");
  });

  it("dibatasi 60 detik seperti rute cron lain", () => {
    expect(rute).toContain("maxDuration = 60");
  });
});

describe("vercel.json tidak ikut berubah", () => {
  it("tetap dua cron, dan tidak ada kpi-bulanan di dalamnya", () => {
    const v = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string }[];
    };
    expect(v.crons).toHaveLength(2);
    expect(v.crons.map((c) => c.path)).toEqual(["/api/cron/fraud-sync", "/api/cron/bersih-foto"]);
  });
});
