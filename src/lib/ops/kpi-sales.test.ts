import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KPI, hitungSales, type MasukanSales, type NilaiKpi } from "./kpi-sales";
import type { AmbangKelengkapan } from "./kelengkapan";
import { petaCabangOutlet, saringFakta, type BarisSeasonal } from "./sales-fact";
import { hitungTargetSales } from "./target-sales";
import type { Outlet } from "@/lib/types";

/**
 * KPI SALES — yang diuji di sini PEMBEDAAN ANTARA NOL DAN TIDAK ADA.
 *
 * Kelima KPI ini akhirnya menjadi angka capaian, dan capaian menentukan
 * pencairan. Satu null yang diam-diam berubah jadi nol membuat outlet yang
 * datanya belum ditarik terbaca gagal total; satu nol yang diam-diam berubah
 * jadi null membuat outlet yang benar-benar tidak jualan menghilang dari
 * laporan. Keduanya tidak akan kelihatan salah di layar.
 */

const ambang = (persen: number): AmbangKelengkapan => ({ persen, sumber: "parameter" });

const dasar = (ubah: Partial<MasukanSales> = {}): MasukanSales => ({
  periode: "2026-08",
  outlets: [{ id: "o1", areaId: "a1" }],
  fakta: [],
  ambang: ambang(95),
  target: [],
  hariBerjalan: 31,
  periodeSelesai: true,
  ...ubah,
});

const hari = (n: number): string => `2026-08-${String(n).padStart(2, "0")}`;

const fakta = (o: string, n: number, net: number, extra: { gross?: number | null; bills?: number | null; pax?: number | null } = {}) => ({
  outletId: o,
  branch: `${o}-fnb`,
  tanggal: hari(n),
  net,
  gross: extra.gross ?? null,
  pax: extra.pax ?? null,
  bills: extra.bills ?? null,
});

const ambil = (n: NilaiKpi[], kpi: string, outletId: string | null = "o1"): NilaiKpi =>
  n.find((x) => x.kpiDefinitionId === kpi && x.outletId === outletId)!;

/* ─────────────────── nol versus tidak ada ─────────────────── */

describe("nol dan tidak-ada tidak pernah tertukar", () => {
  it("outlet TANPA satu baris pun: nilai null, status tidak_tersedia", () => {
    const h = hitungSales(dasar());
    const net = ambil(h.nilai, KPI.net);
    expect(net.nilai).toBeNull();
    expect(net.status).toBe("tidak_tersedia");
    expect(net.jumlahHari).toBe(0);
  });

  it("outlet yang jualannya NOL: nilai 0, status final", () => {
    const h = hitungSales(dasar({ fakta: Array.from({ length: 31 }, (_, i) => fakta("o1", i + 1, 0)) }));
    const net = ambil(h.nilai, KPI.net);
    expect(net.nilai).toBe(0);
    expect(net.status).toBe("final");
    expect(net.jumlahHari).toBe(31);
  });

  it("dua keadaan itu benar-benar berbeda barisnya", () => {
    const kosong = ambil(hitungSales(dasar()).nilai, KPI.net);
    const nol = ambil(hitungSales(dasar({ fakta: [fakta("o1", 1, 0)] })).nilai, KPI.net);
    expect(kosong.nilai).not.toBe(nol.nilai);
    expect(kosong.status).not.toBe(nol.status);
  });

  it("outlet yang tidak punya data TETAP menghasilkan baris", () => {
    // Outlet yang hilang dari hasil tidak bisa dibedakan dari outlet yang
    // terlewat dihitung — dan yang kedua justru yang perlu kelihatan.
    const h = hitungSales(dasar({ outlets: [{ id: "o1", areaId: "a1" }, { id: "o2", areaId: "a1" }], fakta: [fakta("o1", 1, 500)] }));
    expect(h.nilai.filter((x) => x.outletId === "o2")).toHaveLength(5);
    expect(ambil(h.nilai, KPI.net, "o2").nilai).toBeNull();
  });
});

/* ─────────────────── gross yang tidak pernah terukur ─────────────────── */

describe("gross null bukan gross nol", () => {
  it("baris tanpa gross sama sekali: gross null, net tetap ada", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 500)] }));
    expect(ambil(h.nilai, KPI.net).nilai).toBe(500);
    expect(ambil(h.nilai, KPI.gross).nilai).toBeNull();
    expect(ambil(h.nilai, KPI.gross).status).toBe("tidak_tersedia");
  });

  it("gross nol yang terukur tetap nol", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 500, { gross: 0 })] }));
    expect(ambil(h.nilai, KPI.gross).nilai).toBe(0);
    expect(ambil(h.nilai, KPI.gross).status).toBe("final");
  });
});

/* ─────────────────── average transaction ─────────────────── */

describe("average transaction", () => {
  it("net dibagi jumlah bill", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 1_000, { bills: 4 }), fakta("o1", 2, 1_000, { bills: 6 })] }));
    expect(ambil(h.nilai, KPI.average).nilai).toBe(200);
  });

  it("bill nol TIDAK menghasilkan tak hingga", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 1_000, { bills: 0 })] }));
    const a = ambil(h.nilai, KPI.average);
    expect(a.nilai).toBeNull();
    expect(Number.isFinite(a.nilai as number)).toBe(false);
    expect(a.status).toBe("tidak_tersedia");
  });

  it("bill yang tidak pernah terukur menghasilkan null, bukan nol", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 1_000)] }));
    expect(ambil(h.nilai, KPI.average).nilai).toBeNull();
    expect(ambil(h.nilai, KPI.average).catatan).toContain("tidak terukur");
  });
});

/* ─────────────────── target dan capaian ─────────────────── */

describe("capaian tanpa target adalah null", () => {
  const riwayat = new Map<string, number | null>([
    ["o1|2026-07", 100],
    ["o1|2026-06", 100],
    ["o1|2026-05", 100],
  ]);

  it("outlet lama: ada target, ada capaian", () => {
    const target = hitungTargetSales({ periode: "2026-08", outlets: [{ id: "o1", bukaTanggal: "2024-01-01" }], riwayat, pertumbuhan: 0 });
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 50)], target }));
    expect(ambil(h.nilai, KPI.target).nilai).toBe(100);
    expect(ambil(h.nilai, KPI.capaian).nilai).toBe(50);
    expect(h.target).toHaveLength(1);
  });

  it("outlet baru: target null, capaian null — BUKAN nol dan BUKAN seratus", () => {
    // Nol membuatnya tampak gagal, seratus membuatnya tampak sempurna, dan
    // keduanya sama-sama karangan.
    const target = hitungTargetSales({ periode: "2026-08", outlets: [{ id: "o1", bukaTanggal: "2026-08-01" }], riwayat, pertumbuhan: 0 });
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 50)], target }));
    expect(ambil(h.nilai, KPI.target).nilai).toBeNull();
    expect(ambil(h.nilai, KPI.capaian).nilai).toBeNull();
    expect(ambil(h.nilai, KPI.capaian).catatan).toContain("Belum genap tiga bulan");
    // Dan tidak ada baris target yang disimpan untuknya.
    expect(h.target).toHaveLength(0);
  });

  it("target nol tidak dipakai sebagai pembagi", () => {
    const target = [
      { outletId: "o1", nilai: 0, alasan: null, bulan: [], riwayat: [], dipakai: [], pertumbuhan: 0 },
    ];
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 50)], target }));
    expect(ambil(h.nilai, KPI.capaian).nilai).toBeNull();
  });

  it("baris target membawa angka pembentuknya", () => {
    const target = hitungTargetSales({ periode: "2026-08", outlets: [{ id: "o1", bukaTanggal: "2024-01-01" }], riwayat, pertumbuhan: 15 });
    const h = hitungSales(dasar({ target }));
    expect(h.target[0].dasar.bulan).toEqual(["2026-07", "2026-06", "2026-05"]);
    expect(h.target[0].dasar.pertumbuhan).toBe(15);
    expect(h.target[0].sumber).toBe("rumus");
    expect(h.target[0].rumus).toBe("avg3-tumbuh");
  });

  it("PHASE 2A tidak pernah menulis target bersumber tangan", () => {
    // AD-05 mengatur persetujuannya, dan alur itu belum ada. Target tangan
    // tanpa persetujuan adalah angka yang bisa diturunkan sendiri oleh yang
    // dinilai.
    const target = hitungTargetSales({ periode: "2026-08", outlets: [{ id: "o1", bukaTanggal: "2024-01-01" }], riwayat, pertumbuhan: 15 });
    for (const t of hitungSales(dasar({ target })).target) expect(t.sumber).toBe("rumus");
  });
});

/* ─────────────────── final versus sementara ─────────────────── */

describe("periode berjalan tidak boleh disebut final", () => {
  it("bulan yang belum selesai berstatus sementara", () => {
    const h = hitungSales(dasar({ periodeSelesai: false, hariBerjalan: 16, fakta: [fakta("o1", 1, 500)] }));
    expect(ambil(h.nilai, KPI.net).status).toBe("sementara");
  });

  it("bulan yang sudah selesai berstatus final", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 500)] }));
    expect(ambil(h.nilai, KPI.net).status).toBe("final");
  });

  it("target tetap final walau bulannya berjalan", () => {
    // Targetnya dihitung dari tiga bulan yang sudah tutup; ia tidak bergerak.
    const riwayat = new Map<string, number | null>([["o1|2026-07", 100], ["o1|2026-06", 100], ["o1|2026-05", 100]]);
    const target = hitungTargetSales({ periode: "2026-08", outlets: [{ id: "o1", bukaTanggal: "2024-01-01" }], riwayat, pertumbuhan: 0 });
    const h = hitungSales(dasar({ periodeSelesai: false, target }));
    expect(ambil(h.nilai, KPI.target).status).toBe("final");
  });
});

/* ─────────────────── sumber yang dinyatakan tidak berlaku ─────────────────── */

describe("bulan yang angka ESB-nya sudah dinyatakan salah", () => {
  it("angkanya tetap dicatat, tapi ditandai tidak sah", () => {
    // Dibuang akan membuat V.1 berbeda dari halaman Daily tanpa sebab yang
    // terbaca; diterima diam-diam akan membuat angka yang sudah dinyatakan
    // salah ikut menilai orang.
    const h = hitungSales(dasar({ outlets: [{ id: "o1", areaId: "a1", esbTidakBerlaku: true }], fakta: [fakta("o1", 1, 500)] }));
    const net = ambil(h.nilai, KPI.net);
    expect(net.nilai).toBe(500);
    expect(net.sumberSah).toBe(false);
    expect(net.catatan).toContain("tidak berlaku");
  });

  it("outlet biasa tetap sah", () => {
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 500)] }));
    expect(ambil(h.nilai, KPI.net).sumberSah).toBe(true);
    expect(ambil(h.nilai, KPI.net).catatan).toBeNull();
  });
});

/* ─────────────────── korporat ─────────────────── */

describe("angka korporat dijumlah dari outlet, bukan dari baris korporat ESB", () => {
  it("total korporat sama dengan jumlah seluruh outlet", () => {
    const h = hitungSales(
      dasar({
        outlets: [{ id: "o1", areaId: "a1" }, { id: "o2", areaId: "a1" }],
        fakta: [fakta("o1", 1, 300), fakta("o2", 1, 200)],
      }),
    );
    const korporat = h.nilai.find((x) => x.cakupan === "korporat" && x.kpiDefinitionId === KPI.net)!;
    expect(korporat.nilai).toBe(500);
    expect(korporat.outletId).toBeNull();
    expect(korporat.areaId).toBeNull();
  });

  it("baris korporat `branch = ''` TIDAK ikut — ia sudah dibuang lebih dulu", () => {
    // Inilah Rp 13,4 miliar yang membuat SUM(net) mentah jadi dua kali lipat.
    const outlets = [{ id: "o1", name: "O1", code: "K1", active: true, esbBranchId: "b1" } as Outlet];
    const baris: BarisSeasonal[] = [
      { branch: "b1", day: hari(1), net: 300 },
      { branch: "", day: hari(1), net: 999_999 },
      { branch: "yatim", day: hari(1), net: 777 },
    ];
    const { fakta: bersih, dibuang } = saringFakta(baris, petaCabangOutlet(outlets));
    const h = hitungSales(dasar({ outlets: [{ id: "o1", areaId: null }], fakta: bersih }));
    const korporat = h.nilai.find((x) => x.cakupan === "korporat" && x.kpiDefinitionId === KPI.net)!;
    expect(korporat.nilai).toBe(300);
    expect(dibuang.korporat).toBe(1);
    expect(dibuang.cabangYatim).toEqual(["yatim"]);
  });

  it("tanpa satu outlet pun yang berdata: korporat null, bukan nol", () => {
    const korporat = hitungSales(dasar()).nilai.find((x) => x.cakupan === "korporat" && x.kpiDefinitionId === KPI.net)!;
    expect(korporat.nilai).toBeNull();
    expect(korporat.status).toBe("tidak_tersedia");
  });
});

/* ─────────────────── bentuk baris ─────────────────── */

describe("bentuk baris cocok dengan tabelnya", () => {
  it("cakupan selalu sepakat dengan penunjuk yang terisi", () => {
    // CHECK `kpi_values_cakupan_cocok` di migrasi 0103 menolak yang tidak
    // sepakat; diuji di sini supaya ketahuan sebelum menyentuh basis data.
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 500)] }));
    for (const n of h.nilai) {
      if (n.cakupan === "outlet") {
        expect(n.outletId).not.toBeNull();
        expect(n.areaId).toBeNull();
      } else if (n.cakupan === "korporat") {
        expect(n.outletId).toBeNull();
        expect(n.areaId).toBeNull();
      }
    }
  });

  it("status yang menyatakan tidak ada tidak pernah membawa angka", () => {
    // CHECK `kpi_values_nilai_sepakat` menolak yang membawa.
    const h = hitungSales(dasar({ fakta: [fakta("o1", 1, 500)] }));
    for (const n of h.nilai) {
      if (n.status === "tidak_tersedia" || n.status === "invalid") expect(n.nilai).toBeNull();
    }
  });

  it("periode bulanan selalu berbentuk YYYY-MM", () => {
    // CHECK `kpi_values_periode_bentuk` menolak bentuk lain.
    for (const n of hitungSales(dasar()).nilai) {
      expect(n.skala).toBe("bulanan");
      expect(n.periode).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("tiap baris menyebut rumus dan versinya", () => {
    for (const n of hitungSales(dasar()).nilai) {
      expect(n.rumus).toBeTruthy();
      expect(n.rumusVersi).toBeGreaterThanOrEqual(1);
      expect(n.sumber).toBeTruthy();
    }
  });

  it("lima KPI per outlet, tidak kurang dan tidak lebih", () => {
    const h = hitungSales(dasar());
    const punya = h.nilai.filter((x) => x.outletId === "o1").map((x) => x.kpiDefinitionId).sort();
    expect(punya).toEqual([KPI.average, KPI.capaian, KPI.gross, KPI.net, KPI.target].sort());
  });
});

/* ─────────────────── kelengkapan ─────────────────── */

describe("kelengkapan ikut dilaporkan, tidak disembunyikan", () => {
  it("ambangnya ikut, dan datang dari luar", () => {
    const h = hitungSales(dasar({ ambang: ambang(80), hariBerjalan: 10, fakta: Array.from({ length: 9 }, (_, i) => fakta("o1", i + 1, 1)) }));
    expect(h.kelengkapan.ambang.persen).toBe(80);
    expect(h.kelengkapan.persen).toBe(90);
    expect(h.kelengkapan.bolehDinilai).toBe(true);
  });

  it("baris cacat membuat periodenya invalid", () => {
    const h = hitungSales(dasar({ cacat: 2, hariBerjalan: 3, fakta: [fakta("o1", 1, 1)] }));
    expect(h.kelengkapan.status).toBe("invalid");
    expect(h.kelengkapan.bolehDinilai).toBe(false);
  });
});

/* ─────────────────── penjaga berkas ─────────────────── */

describe("murni — tidak menyentuh basis data", () => {
  // Komentarnya menyebut hal-hal yang dilarang justru untuk menjelaskan
  // larangannya, jadi yang diperiksa KODE-nya saja.
  const kode = readFileSync(join(process.cwd(), "src/lib/ops/kpi-sales.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("tidak ber-server-only dan tidak memanggil Supabase", () => {
    expect(kode).not.toContain('import "server-only"');
    expect(kode).not.toContain("@/lib/data/db");
    expect(kode.toLowerCase()).not.toContain("supabase");
    expect(kode).not.toMatch(/\bawait\b/);
    expect(kode).not.toMatch(/\basync\b/);
  });

  it("kode definisi KPI-nya sama persis dengan migrasi 0103", () => {
    const migrasi = readFileSync(join(process.cwd(), "supabase/migrations/0103_kpi_target.sql"), "utf8");
    for (const id of Object.values(KPI)) expect(migrasi, id).toContain(`'${id}'`);
  });
});
