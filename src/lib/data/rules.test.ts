import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/ops/settings-types";

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
