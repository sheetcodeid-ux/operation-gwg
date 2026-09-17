import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { berlakuUntuk, evaluasi, melanggar, versiBerlaku, type SyaratAturan, type VersiAturan } from "./rules";

/**
 * SEBUAH ANGKA YANG ARTINYA BERUBAH DIAM-DIAM adalah kegagalan yang paling
 * sulit dilihat: angkanya tetap sama, jadi tidak ada yang curiga, sementara
 * kesimpulannya sudah lain karena seseorang mengubah ambang bulan lalu.
 *
 * Itu yang dijaga berkas ini.
 */

const syarat = (p: Partial<SyaratAturan> = {}): SyaratAturan => ({
  urutan: 1,
  operator: "gt",
  nilaiAmbang: 30,
  nilaiAmbang2: null,
  skala: "bulanan",
  ...p,
});

const versi = (p: Partial<VersiAturan> = {}): VersiAturan => ({
  ruleKode: "warehouse_persen",
  versi: 1,
  berlakuMulai: "2026-08",
  berlakuSampai: null,
  severity: "medium",
  sumber: "op_settings.purchaseLimits.warehouse = 30",
  syarat: [syarat()],
  ...p,
});

const nilaiKpi = (nilai: number | null, v: VersiAturan[] = [versi()], periode = "2026-09", status = "final" as const) =>
  evaluasi({ periode, nilai, status, versi: v });

/* ─────────────────────────── pemilihan versi ─────────────────────────── */

describe("versi dipilih oleh periode KPI, bukan oleh hari ini", () => {
  const v1 = versi({ versi: 1, berlakuMulai: "2026-08", berlakuSampai: "2026-11", syarat: [syarat({ nilaiAmbang: 30 })] });
  const v2 = versi({ versi: 2, berlakuMulai: "2026-12", berlakuSampai: null, syarat: [syarat({ nilaiAmbang: 25 })] });

  it("sebelum tanggal berlaku: tidak ada aturan", () => {
    expect(versiBerlaku([v1, v2], "2026-07")).toBeNull();
  });

  it("tepat pada periode mulai: sudah berlaku", () => {
    expect(versiBerlaku([v1, v2], "2026-08")?.versi).toBe(1);
  });

  it("di tengah rentang", () => {
    expect(versiBerlaku([v1, v2], "2026-09")?.versi).toBe(1);
  });

  it("tepat pada periode berakhir: MASIH berlaku", () => {
    expect(versiBerlaku([v1, v2], "2026-11")?.versi).toBe(1);
  });

  it("sesudahnya: versi berikutnya", () => {
    expect(versiBerlaku([v1, v2], "2026-12")?.versi).toBe(2);
    expect(versiBerlaku([v1, v2], "2027-06")?.versi).toBe(2);
  });

  it("berlakuSampai null berarti masih berlaku", () => {
    expect(berlakuUntuk(v2, "2099-01")).toBe(true);
  });

  it("dua versi yang bertumpang DITOLAK — bukan dipilih salah satunya", () => {
    const tumpang = versi({ versi: 2, berlakuMulai: "2026-09", berlakuSampai: null });
    expect(() => versiBerlaku([v1, tumpang], "2026-09")).toThrow(/lebih dari satu versi/);
  });
});

describe("hasil lama tetap bisa dihasilkan ulang setelah versi baru lahir", () => {
  const v1 = versi({ versi: 1, berlakuMulai: "2026-08", berlakuSampai: "2026-11", syarat: [syarat({ nilaiAmbang: 30 })] });
  const v2 = versi({ versi: 2, berlakuMulai: "2026-12", berlakuSampai: null, syarat: [syarat({ nilaiAmbang: 25 })] });

  it("September tetap dinilai dengan v1 walau v2 sudah ada", () => {
    // 27% aman menurut v1 (ambang 30), melanggar menurut v2 (ambang 25).
    const sept = nilaiKpi(27, [v1, v2], "2026-09");
    expect(sept.versi).toBe(1);
    expect(sept.nilaiAmbang).toBe(30);
    expect(sept.kondisi).toBe("aman");
  });

  it("Desember memakai v2 — periode yang berbeda, aturan yang berbeda", () => {
    const des = nilaiKpi(27, [v1, v2], "2026-12");
    expect(des.versi).toBe(2);
    expect(des.nilaiAmbang).toBe(25);
    expect(des.kondisi).toBe("lewat_ambang");
  });

  it("angka yang sama + versi yang sama = hasil yang sama, selalu", () => {
    const a = nilaiKpi(27, [v1, v2], "2026-09");
    const b = nilaiKpi(27, [v1, v2], "2026-09");
    expect(a).toEqual(b);
  });
});

/* ─────────────────────────── titik batas ─────────────────────────── */

describe("perilaku di titik batas tidak pernah jadi tebakan", () => {
  it("gt: tepat di ambang masih AMAN", () => {
    expect(melanggar(30, syarat({ operator: "gt", nilaiAmbang: 30 }))).toBe(false);
    expect(melanggar(30.000001, syarat({ operator: "gt", nilaiAmbang: 30 }))).toBe(true);
    expect(melanggar(29.999999, syarat({ operator: "gt", nilaiAmbang: 30 }))).toBe(false);
  });

  it("gte: tepat di ambang SUDAH melanggar", () => {
    expect(melanggar(30, syarat({ operator: "gte", nilaiAmbang: 30 }))).toBe(true);
  });

  it("lt: tepat di ambang masih AMAN", () => {
    expect(melanggar(30, syarat({ operator: "lt", nilaiAmbang: 30 }))).toBe(false);
    expect(melanggar(29.999999, syarat({ operator: "lt", nilaiAmbang: 30 }))).toBe(true);
  });

  it("lte: tepat di ambang SUDAH melanggar", () => {
    expect(melanggar(30, syarat({ operator: "lte", nilaiAmbang: 30 }))).toBe(true);
  });

  it("between: melanggar bila di LUAR rentang, batasnya ikut aman", () => {
    const s = syarat({ operator: "between", nilaiAmbang: 15, nilaiAmbang2: 30 });
    expect(melanggar(15, s)).toBe(false);
    expect(melanggar(30, s)).toBe(false);
    expect(melanggar(14.9, s)).toBe(true);
    expect(melanggar(30.1, s)).toBe(true);
  });
});

describe("turun-baik dan naik-baik", () => {
  it("turun-baik: lebih dari ambang berarti melanggar", () => {
    const v = [versi({ syarat: [syarat({ operator: "gt", nilaiAmbang: 13 })] })];
    expect(nilaiKpi(27.05, v).kondisi).toBe("lewat_ambang");
    expect(nilaiKpi(12.9, v).kondisi).toBe("aman");
  });

  it("naik-baik: kurang dari ambang berarti melanggar", () => {
    const v = [versi({ ruleKode: "laba_bersih_persen", syarat: [syarat({ operator: "lt", nilaiAmbang: 30 })] })];
    expect(nilaiKpi(-3.2, v).kondisi).toBe("lewat_ambang");
    expect(nilaiKpi(32.6, v).kondisi).toBe("aman");
    expect(nilaiKpi(30, v).kondisi).toBe("aman");
  });

  it("nilai negatif tetap dinilai, bukan dianggap tidak ada", () => {
    const v = [versi({ syarat: [syarat({ operator: "lt", nilaiAmbang: 30 })] })];
    expect(nilaiKpi(-3.206789, v).kondisi).toBe("lewat_ambang");
  });

  it("nol adalah angka, bukan kekosongan", () => {
    expect(nilaiKpi(0).kondisi).toBe("aman");
  });
});

/* ─────────────────────────── yang tidak dinilai ─────────────────────────── */

describe("kosong tidak pernah jadi aman", () => {
  it("nilai null → tidak_tersedia", () => {
    const h = nilaiKpi(null, [versi()], "2026-09", "tidak_tersedia");
    expect(h.kondisi).toBe("tidak_tersedia");
    expect(h.alasan).toContain("BUKAN berarti aman");
  });

  it("status tidak_tersedia walau nilainya entah bagaimana ada", () => {
    expect(evaluasi({ periode: "2026-09", nilai: 5, status: "tidak_tersedia", versi: [versi()] }).kondisi).toBe("tidak_tersedia");
  });

  it("tidak mengembalikan ambang untuk angka yang tidak ada", () => {
    const h = nilaiKpi(null, [versi()], "2026-09", "tidak_tersedia");
    expect(h.nilaiAmbang).toBeNull();
    expect(h.ruleKode).toBeNull();
  });
});

describe("invalid tetap invalid", () => {
  it("status invalid tidak dinilai terhadap aturan mana pun", () => {
    const h = evaluasi({ periode: "2026-09", nilai: 99, status: "invalid", versi: [versi()] });
    expect(h.kondisi).toBe("invalid");
    expect(h.versi).toBeNull();
  });

  it("NaN dan Infinity ditolak sebagai tidak sah", () => {
    expect(nilaiKpi(Number.NaN).kondisi).toBe("invalid");
    expect(nilaiKpi(Number.POSITIVE_INFINITY).kondisi).toBe("invalid");
  });
});

describe("tanpa aturan BUKAN aman", () => {
  it("KPI yang belum punya aturan sama sekali", () => {
    const h = nilaiKpi(21.08, []);
    expect(h.kondisi).toBe("tanpa_aturan");
    expect(h.alasan).toContain("bukan aman");
  });

  it("periode sebelum aturannya berlaku — sewa sebelum Oktober 2026", () => {
    const sewa = versi({ ruleKode: "sewa_melebihi_ambang", berlakuMulai: "2026-10", syarat: [syarat({ nilaiAmbang: 5 })] });
    expect(nilaiKpi(1.07, [sewa], "2026-09").kondisi).toBe("tanpa_aturan");
    expect(nilaiKpi(1.07, [sewa], "2026-10").kondisi).toBe("aman");
  });

  it("versi tanpa satu pun syarat", () => {
    expect(nilaiKpi(10, [versi({ syarat: [] })]).kondisi).toBe("tanpa_aturan");
  });
});

/* ─────────────────────────── jejak penjelasan ─────────────────────────── */

describe("tiap penilaian bisa dijelaskan tanpa membaca kode", () => {
  it("menyebut aturan, versi, ambang, dan sumbernya", () => {
    const h = nilaiKpi(20.364919);
    expect(h.ruleKode).toBe("warehouse_persen");
    expect(h.versi).toBe(1);
    expect(h.nilaiAmbang).toBe(30);
    expect(h.operator).toBe("gt");
    expect(h.severity).toBe("medium");
    expect(h.sumber).toContain("op_settings.purchaseLimits.warehouse");
    expect(h.alasan).toContain("20.364919");
    expect(h.alasan).toContain("tidak dilanggar");
  });

  it("yang melanggar menyebutnya terang-terangan", () => {
    expect(nilaiKpi(35).alasan).toContain("dilanggar");
  });
});

/* ─────────────────────────── penjaga batas phase ─────────────────────────── */

describe("Phase 3 berhenti di kondisi", () => {
  const kode = readFileSync(join(process.cwd(), "src/lib/ops/rules.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("tidak ada Signal, Diagnosis, Action, Impact, maupun Learning", () => {
    for (const p of ["signal", "Signal", "diagnos", "Diagnos", "tindakan", "Action", "Impact", "Learning"]) {
      expect(kode).not.toContain(p);
    }
  });

  it("murni — tidak menyentuh basis data maupun waktu sekarang", () => {
    expect(kode).not.toContain("server-only");
    expect(kode).not.toContain("db()");
    expect(kode).not.toContain("Date.now");
  });

  it("tidak ada satu pun ambang yang ditulis di dalam mesinnya", () => {
    // Ambang hidup di `rule_conditions`, titik. Begitu angka muncul di sini,
    // mengubah kebijakan berarti mengubah kode — dan sejarahnya ikut hilang.
    const badan = kode.slice(kode.indexOf("export function melanggar"));
    expect(badan).not.toMatch(/nilaiAmbang\s*=\s*\d/);
    expect(badan).not.toMatch(/\b(30|13|35|5|4|3|1)\s*[;),]/);
  });
});
