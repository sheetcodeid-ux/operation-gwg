import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/ops/settings-types";
import { evaluasi } from "@/lib/ops/rules";
import { susunKatalog, type BarisRule, type BarisSyarat, type BarisVersi } from "./rules";

/**
 * LAPISAN ATURAN TIDAK BOLEH JADI SUMBER KEBENARAN KEDUA.
 *
 * Dua bahaya yang dijaga di sini, dan keduanya berakhir sama: dua angka yang
 * berbeda untuk pertanyaan yang sama, tanpa cara tahu mana yang benar.
 *
 *   1. ambang disalin ke dalam kode — lalu berbeda dari yang di basis data
 *   2. hasil penilaian disimpan — lalu basi ketika aturannya berganti
 */

const tanpaKomentar = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const kode = tanpaKomentar("src/lib/data/rules.ts");
const sql = tanpaKomentar("supabase/migrations/0109_rule_versioning.sql").replace(/--.*$/gm, "");

describe("tidak ada ambang yang ditulis di kode", () => {
  it("lapisan data tidak memuat satu pun angka ambang", () => {
    expect(kode).not.toMatch(/nilaiAmbang\s*[:=]\s*\d/);
    expect(kode).not.toContain("expenseThresholds");
    expect(kode).not.toContain("purchaseLimits");
    expect(kode).not.toContain("marginBands");
  });

  it("mesinnya pun tidak", () => {
    const mesin = tanpaKomentar("src/lib/ops/rules.ts");
    expect(mesin).not.toContain("op_settings");
    expect(mesin).not.toContain("DEFAULT_SETTINGS");
  });
});

describe("hasil penilaian tidak disimpan", () => {
  it("tidak ada tabel evaluasi yang dibuat", () => {
    expect(sql).not.toContain("kpi_rule_evaluations");
    expect(sql.toLowerCase()).not.toMatch(/create\s+table[^;]*evaluat/);
  });

  it("lapisan data tidak menulis apa pun", () => {
    for (const tulis of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(kode).not.toContain(tulis);
    }
  });

  it("kpi_values hanya DIBACA, tidak pernah disentuh", () => {
    expect(kode).toContain('.from("kpi_values")');
    expect(kode).not.toMatch(/from\("kpi_values"\)[\s\S]{0,80}\.(update|upsert|insert|delete)/);
  });
});

describe("migrasi hanya menambah", () => {
  it("tidak menyentuh satu pun tabel yang sudah ada", () => {
    for (const t of ["kpi_values", "targets", "op_expenses", "op_purchases", "op_pnl", "op_settings", "seasonal_daily"]) {
      expect(sql).not.toMatch(new RegExp(`(alter|drop|update|delete\\s+from)\\s+(table\\s+)?${t}\\b`, "i"));
    }
  });

  it("tidak ada DROP maupun ALTER pada kpi_definitions", () => {
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/alter\s+table\s+kpi_definitions/i);
    // Satu-satunya sentuhan ke kpi_definitions adalah foreign key.
    expect(sql).toContain("references kpi_definitions (id)");
  });

  it("RLS dinyalakan untuk ketiga tabel baru", () => {
    for (const t of ["rules", "rule_versions", "rule_conditions"]) {
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`));
    }
  });

  it("tidak ada policy permisif yang dibuat", () => {
    expect(sql).not.toMatch(/create\s+policy/i);
  });
});

describe("benihnya benar-benar disalin dari op_settings", () => {
  it("angka yang disemai sama dengan yang dipakai produksi", () => {
    // Kalau salah satunya digeser tanpa yang lain, KPI Supervisor dan
    // Operational V.1 akan menilai bulan yang sama dengan dua ambang berbeda.
    expect(sql).toContain("('warehouse_persen',       'gt', 30)");
    expect(sql).toContain("('non_warehouse_persen',   'gt',  5)");
    expect(sql).toContain("('total_pembelian_persen', 'gt', 35)");
    expect(sql).toContain("('tenaga_kerja_persen',    'gt', 13)");
    expect(sql).toContain("('lainnya_persen',         'gt',  3)");
    expect(sql).toContain("('laba_bersih_persen',     'lt', 30)");
  });

  it("cocok dengan DEFAULT_SETTINGS yang masih berlaku", () => {
    expect(DEFAULT_SETTINGS.purchaseLimits).toEqual({ warehouse: 30, nonWarehouse: 5, total: 35 });
    expect(DEFAULT_SETTINGS.expenseThresholds.tenaga_kerja).toBe(13);
    expect(DEFAULT_SETTINGS.expenseThresholds.lainnya).toBe(3);
    expect(DEFAULT_SETTINGS.marginBands.sehat).toBe(30);
  });
});

describe("AD-02 · sewa", () => {
  it("ambangnya 5 dan HANYA hidup di rule_conditions", () => {
    expect(sql).toContain("('sewa_melebihi_ambang',   'gt',  5)");
  });

  it("op_settings.sewa TETAP 3 — tidak diubah, tidak disalin jadi 5", () => {
    expect(DEFAULT_SETTINGS.expenseThresholds.sewa).toBe(3);
    expect(sql).not.toMatch(/update\s+op_settings/i);
  });

  it("berlakunya 2026-10, jadi periode sebelumnya sengaja tanpa aturan sewa", () => {
    expect(sql).toContain("'sewa_melebihi_ambang',   1, '2026-10'");
  });

  it("sumbernya menunjuk AD-02, bukan angka telanjang", () => {
    expect(sql).toContain("AD-02");
  });
});

describe("KPI yang memang belum punya aturan tidak dikarang", () => {
  it("HPP, Cleaning, Platform Fee, dan PBJT tidak diberi ambang", () => {
    // Tidak ada sumber berwenang untuk keempatnya. Mengarangnya berarti
    // memberi angka yang tidak pernah diputuskan siapa pun kekuatan menilai.
    for (const kpi of ["biaya.hpp_pct", "biaya.cleaning_pct", "biaya.platform_fee_pct", "biaya.pbjt_pct"]) {
      expect(sql).not.toContain(`'${kpi}'`);
    }
  });

  it("KPI Sales juga belum punya aturan", () => {
    for (const kpi of ["sales.net_sales", "sales.gross_sales", "sales.achievement", "sales.average_transaction"]) {
      expect(sql).not.toContain(`'${kpi}'`);
    }
  });
});

describe("Phase 3 berhenti di kondisi", () => {
  it("tidak ada Signal, Diagnosis, Action, Impact, Learning", () => {
    for (const p of ["signal", "Signal", "diagnos", "Diagnos", "impact", "Impact", "learning", "Learning"]) {
      expect(kode).not.toContain(p);
      expect(sql).not.toContain(p);
    }
  });

  it("tidak menyentuh jalur generasi maupun finalisasi TASK #85/#85A", () => {
    expect(kode).not.toContain("generateTerjadwal");
    expect(kode).not.toContain("finalisasiPeriodeSelesai");
    expect(kode).not.toContain("gwg_tulis_kpi_bulanan");
    const rute = tanpaKomentar("src/app/api/cron/kpi-bulanan/route.ts");
    expect(rute).not.toContain("kondisiPeriode");
    expect(rute).not.toContain("rules");
  });
});

describe("bacaannya massal", () => {
  it("tiga query untuk seluruh aturan, satu untuk seluruh nilai", () => {
    expect((kode.match(/selectAll</g) ?? []).length).toBe(4);
  });

  it("tidak ada query di dalam perulangan", () => {
    const badan = kode.slice(kode.indexOf("export async function kondisiPeriode"));
    expect(badan).not.toMatch(/for\s*\([\s\S]{0,200}db\(\)/);
  });
});

/* ────────────────── AD-13 · aturan yang ditarik tidak menilai ────────────────── */

describe("AD-13 · rule non-aktif WAJIB menghasilkan tanpa_aturan", () => {
  /**
   * Ambang 4/1/1 untuk listrik, air, dan internet TIDAK PERNAH jadi keputusan
   * bisnis — ia ikut tersemai di `0109` dari prompt TASK #87. Barisnya sengaja
   * TIDAK dihapus: `sumber`-nya yang menyebut asal-usulnya itulah jejak yang
   * membuat penarikannya bisa ditelusuri.
   *
   * Karena barisnya masih ada, satu-satunya yang menahan ambang itu menilai
   * adalah `rules.aktif`. Kalau saringan itu hilang, angka yang sudah ditarik
   * kembali menghakimi tanpa satu pun tanda — dan kondisinya akan terbaca
   * "aman" atau "lewat ambang" seolah pernah ada yang memutuskannya.
   */
  const rule = (kode: string, kpi: string, aktif: boolean): BarisRule => ({
    kode,
    nama: kode,
    kpi_definition_id: kpi,
    kategori: "biaya",
    cakupan: "semua",
    aktif,
  });

  const versiBaris = (id: number, kode: string): BarisVersi => ({
    id,
    rule_kode: kode,
    versi: 1,
    berlaku_mulai: "2026-08",
    berlaku_sampai: null,
    severity_default: "medium",
    sumber: "TASK #87 bagian 3 — disebut pemiliknya; belum ada di op_settings",
  });

  const syaratBaris = (versionId: number, ambang: number): BarisSyarat => ({
    rule_version_id: versionId,
    urutan: 1,
    operator: "gt",
    nilai_ambang: ambang,
    nilai_ambang_2: null,
    skala: "bulanan",
  });

  // Persis bentuk produksi sesudah 0110: tiga ditarik, satu tetap berjalan.
  const rules = [
    rule("listrik_persen", "biaya.electricity_pct", false),
    rule("air_persen", "biaya.water_pct", false),
    rule("internet_persen", "biaya.internet_pct", false),
    rule("warehouse_persen", "biaya.warehouse_pct", true),
  ];
  const versi = [versiBaris(1, "listrik_persen"), versiBaris(2, "air_persen"), versiBaris(3, "internet_persen"), versiBaris(4, "warehouse_persen")];
  const syarat = [syaratBaris(1, 4), syaratBaris(2, 1), syaratBaris(3, 1), syaratBaris(4, 30)];

  const katalog = susunKatalog(rules, versi, syarat);

  it("ketiganya tidak punya satu pun versi di katalog", () => {
    for (const kpi of ["biaya.electricity_pct", "biaya.water_pct", "biaya.internet_pct"]) {
      expect(katalog.perKpi.get(kpi)).toBeUndefined();
    }
  });

  it("angkanya jadi tanpa_aturan — BUKAN aman, BUKAN lewat_ambang", () => {
    // 9% jauh di atas bekas ambang 4%, dan 0,4% jauh di bawahnya. Keduanya
    // harus berakhir sama: belum dinilai.
    for (const nilai of [9.2, 0.4]) {
      const h = evaluasi({
        periode: "2026-09",
        nilai,
        status: "final",
        versi: katalog.perKpi.get("biaya.electricity_pct") ?? [],
      });
      expect(h.kondisi).toBe("tanpa_aturan");
      expect(h.nilaiAmbang).toBeNull();
      expect(h.ruleKode).toBeNull();
      expect(h.alasan).toContain("bukan aman");
    }
  });

  it("yang menahannya memang `aktif`, bukan ketiadaan data", () => {
    // Versi dan syaratnya utuh di masukan — sejarahnya tidak dihapus.
    expect(versi.filter((v) => v.rule_kode === "listrik_persen")).toHaveLength(1);
    expect(syarat.filter((s) => s.rule_version_id === 1)[0]?.nilai_ambang).toBe(4);
  });

  it("aturan yang masih aktif tetap menilai seperti biasa", () => {
    const wh = katalog.perKpi.get("biaya.warehouse_pct");
    expect(wh).toHaveLength(1);
    expect(evaluasi({ periode: "2026-09", nilai: 33, status: "final", versi: wh ?? [] }).kondisi).toBe("lewat_ambang");
  });

  it("dikukuhkan kelak = dinyalakan lagi, tanpa menyentuh sejarahnya", () => {
    const dihidupkan = rules.map((r) => (r.kode === "listrik_persen" ? { ...r, aktif: true } : r));
    const sesudah = susunKatalog(dihidupkan, versi, syarat);
    const h = evaluasi({
      periode: "2026-09",
      nilai: 9.2,
      status: "final",
      versi: sesudah.perKpi.get("biaya.electricity_pct") ?? [],
    });
    expect(h.kondisi).toBe("lewat_ambang");
    expect(h.nilaiAmbang).toBe(4);
  });

  it("saringan `aktif` ada di kueri DAN di perakitan", () => {
    // Dua-duanya disengaja. Yang di kueri mengecilkan muatan; yang di
    // perakitan yang benar-benar menjaga, dan ia yang diuji di atas.
    expect(kode).toContain('.eq("aktif", true)');
    expect(kode).toMatch(/rules\.filter\(\(r\) => r\.aktif\)/);
  });
});

describe("migrasi 0110 hanya menonaktifkan", () => {
  const m = tanpaKomentar("supabase/migrations/0110_decision_lock_87a.sql").replace(/--.*$/gm, "");

  it("tidak menghapus apa pun", () => {
    expect(m).not.toMatch(/\bdelete\b/i);
    expect(m).not.toMatch(/\bdrop\b/i);
  });

  it("tidak menyentuh rule_versions maupun rule_conditions", () => {
    expect(m).not.toContain("rule_versions");
    expect(m).not.toContain("rule_conditions");
  });

  it("tidak mengubah skema, ambang, KPI, target, maupun op_settings", () => {
    expect(m).not.toMatch(/\balter\b/i);
    expect(m).not.toMatch(/\binsert\b/i);
    expect(m).not.toContain("nilai_ambang");
    for (const t of ["kpi_values", "targets", "op_settings", "op_expenses", "op_pnl", "op_purchases"]) {
      expect(m).not.toContain(t);
    }
  });

  it("satu-satunya pernyataannya menonaktifkan tepat tiga aturan", () => {
    expect((m.match(/update\s+rules/gi) ?? []).length).toBe(1);
    expect(m).toContain("set aktif   = false");
    for (const kode of ["listrik_persen", "air_persen", "internet_persen"]) {
      expect(m).toContain(`'${kode}'`);
    }
    expect(m).toContain("and aktif");
  });
});
