import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sidikMuatan, susunMuatan, type BarisMuatan } from "./signals";
import type { KatalogAturan, KondisiKpi } from "./rules";
import { evaluasi, type VersiAturan } from "@/lib/ops/rules";

/**
 * SIGNAL ADALAH TUDUHAN, dan tuduhan yang salah lebih mahal daripada diam.
 *
 * Tiga cara Signal bisa salah, dan ketiganya dijaga di sini:
 *
 *   1. lahir padahal tidak ada aturan yang pernah diputuskan siapa pun
 *   2. lahir dari angka yang sumbernya sudah dinyatakan salah
 *   3. lahir lagi dan lagi untuk masalah yang sama sampai daftarnya tidak
 *      berarti apa-apa
 */

const tanpaKomentar = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const kode = tanpaKomentar("src/lib/data/signals.ts");
const sql = tanpaKomentar("supabase/migrations/0111_signals.sql").replace(/--.*$/gm, "");

/* ─────────────────────────── perancah ─────────────────────────── */

const versi = (p: Partial<VersiAturan> = {}): VersiAturan => ({
  ruleKode: "tenaga_kerja_persen",
  versi: 1,
  berlakuMulai: "2026-08",
  berlakuSampai: null,
  severity: "high",
  sumber: "op_settings.expenseThresholds.tenaga_kerja = 13",
  syarat: [{ urutan: 1, operator: "gt", nilaiAmbang: 13, nilaiAmbang2: null, skala: "bulanan" }],
  ...p,
});

const katalogDari = (daftar: { kpi: string; v: VersiAturan; id: number }[]): KatalogAturan => {
  const perKpi = new Map<string, VersiAturan[]>();
  const idVersi = new Map<string, number>();
  for (const d of daftar) {
    perKpi.set(d.kpi, [...(perKpi.get(d.kpi) ?? []), d.v]);
    idVersi.set(`${d.v.ruleKode}|${d.v.versi}`, d.id);
  }
  return { perKpi, idVersi, jumlahRule: daftar.length, jumlahVersi: daftar.length, jumlahSyarat: daftar.length };
};

interface Opsi {
  kpi?: string;
  nilai?: number | null;
  status?: KondisiKpi["status"];
  sumberSah?: boolean;
  cakupan?: string;
  cakupanId?: string;
  kpiValueId?: number;
  periode?: string;
}

const baris = (o: Opsi, v: readonly VersiAturan[]): KondisiKpi => {
  const periode = o.periode ?? "2026-09";
  const nilai = o.nilai === undefined ? 14.2 : o.nilai;
  const status = o.status ?? "final";
  return {
    kpiValueId: o.kpiValueId ?? 8811,
    kpiDefinitionId: o.kpi ?? "biaya.labor_pct",
    cakupan: o.cakupan ?? "outlet",
    cakupanId: o.cakupanId ?? "out_1",
    periode,
    nilai,
    status,
    sumberSah: o.sumberSah ?? true,
    hasil: evaluasi({ periode, nilai, status, versi: v }),
  };
};

const muat = (o: Opsi, daftar = [{ kpi: "biaya.labor_pct", v: versi(), id: 77 }], periode = "2026-09"): BarisMuatan[] =>
  susunMuatan(periode, [baris({ ...o, periode }, daftar.filter((d) => d.kpi === (o.kpi ?? "biaya.labor_pct")).map((d) => d.v))], katalogDari(daftar));

const satu = (o: Opsi, daftar?: { kpi: string; v: VersiAturan; id: number }[], periode?: string) => muat(o, daftar, periode)[0];

/* ═════════════════ 1 · siapa yang boleh melahirkan Signal ═════════════════ */

describe("Signal lahir HANYA dari pelanggaran aturan yang berlaku", () => {
  it("lewat ambang + sumber sah → boleh", () => {
    const m = satu({ nilai: 14.2 });
    expect(m.boleh_sisip).toBe(true);
    expect(m.kondisi_terakhir).toBe("lewat_ambang");
    expect(m.nilai_ambang).toBe(13);
    expect(m.operator).toBe("gt");
    expect(m.severity).toBe("high");
    expect(m.rule_version_id).toBe(77);
  });

  it("aman → TIDAK melahirkan, tapi tetap mengabarkan", () => {
    const m = satu({ nilai: 12.9 });
    expect(m.boleh_sisip).toBe(false);
    expect(m.kondisi_terakhir).toBe("aman");
  });

  it("tidak_tersedia → tidak melahirkan", () => {
    expect(satu({ nilai: null, status: "tidak_tersedia" }).boleh_sisip).toBe(false);
    expect(satu({ nilai: null, status: "tidak_tersedia" }).kondisi_terakhir).toBe("tidak_tersedia");
  });

  it("invalid → tidak melahirkan", () => {
    expect(satu({ nilai: null, status: "invalid" }).boleh_sisip).toBe(false);
    expect(satu({ nilai: Number.NaN }).boleh_sisip).toBe(false);
  });

  it("tanpa aturan → TIDAK ADA BARIS SAMA SEKALI, bukan sekadar tidak melahirkan", () => {
    // HPP 80% tanpa aturan aktif. Tidak ada `rule_version_id`, jadi tidak ada
    // identitas Signal — barisnya tidak bisa dibuat, bukan dibuat lalu ditolak.
    expect(muat({ kpi: "biaya.hpp_pct", nilai: 80 }, [{ kpi: "biaya.labor_pct", v: versi(), id: 77 }])).toHaveLength(0);
  });

  it("aturan yang ditarik (AD-13) tetap senyap walau angkanya tinggi", () => {
    // Listrik 9,2% jauh di atas bekas ambang 4% — dan tetap tidak ada barisnya.
    expect(muat({ kpi: "biaya.electricity_pct", nilai: 9.2 }, [{ kpi: "biaya.labor_pct", v: versi(), id: 77 }])).toHaveLength(0);
  });

  it("versi tanpa syarat tidak melahirkan apa pun", () => {
    const kosong = versi({ syarat: [] });
    expect(susunMuatan("2026-09", [baris({}, [kosong])], katalogDari([{ kpi: "biaya.labor_pct", v: kosong, id: 77 }]))).toHaveLength(0);
  });
});

/* ═════════════════ 2 · sumber yang sudah dinyatakan salah ═════════════════ */

describe("AD-14 · sumber_sah = false tidak pernah melahirkan tuduhan", () => {
  it("melanggar, tapi sumbernya tidak sah → TIDAK melahirkan", () => {
    const m = satu({ nilai: 14.2, sumberSah: false });
    expect(m.boleh_sisip).toBe(false);
  });

  it("barisnya TETAP dikirim, supaya Signal yang sudah ada tahu keadaannya", () => {
    // Inilah pilihan (b): yang diblokir kelahirannya, bukan pengamatannya.
    // Kalau barisnya dibuang, Signal lama membeku di `lewat_ambang` selamanya
    // tanpa satu pun tanda bahwa angkanya sekarang tidak bisa dipakai.
    const m = satu({ nilai: 14.2, sumberSah: false });
    expect(m).toBeDefined();
    expect(m.kondisi_terakhir).toBe("tidak_tersedia");
  });

  it("kondisinya `tidak_tersedia`, BUKAN `aman`", () => {
    // "Aman" berarti sudah dinilai dan lolos. Angka yang sumbernya dinyatakan
    // salah belum dinilai sama sekali.
    expect(satu({ nilai: 14.2, sumberSah: false }).kondisi_terakhir).not.toBe("aman");
  });

  it("sumber tidak sah + aman → tetap tidak_tersedia", () => {
    expect(satu({ nilai: 12.9, sumberSah: false }).kondisi_terakhir).toBe("tidak_tersedia");
  });

  it("`evaluasi()` sendiri TIDAK tahu-menahu soal sumber_sah", () => {
    // Keabsahan sumber urusan asal-usul data, bukan kondisi bisnis. Menaruhnya
    // di mesin aturan berarti mencemari satu-satunya penilai yang ada.
    const mesin = tanpaKomentar("src/lib/ops/rules.ts");
    expect(mesin).not.toContain("sumber_sah");
    expect(mesin).not.toContain("sumberSah");
    // Hasil evaluasinya memang tetap "lewat_ambang" — yang menahannya di sini.
    expect(baris({ nilai: 14.2, sumberSah: false }, [versi()]).hasil.kondisi).toBe("lewat_ambang");
  });
});

/* ═════════════════ 3 · titik batas ═════════════════ */

describe("titik batas tidak pernah jadi tebakan", () => {
  it("tepat di ambang (gt 13, nilai 13) → aman, tidak melahirkan", () => {
    expect(satu({ nilai: 13 }).boleh_sisip).toBe(false);
  });

  it("di atas ambang → melahirkan", () => {
    expect(satu({ nilai: 13.000001 }).boleh_sisip).toBe(true);
  });

  it("di bawah ambang → tidak", () => {
    expect(satu({ nilai: 12.999999 }).boleh_sisip).toBe(false);
  });

  it("gte: tepat di ambang SUDAH melanggar", () => {
    const v = versi({ syarat: [{ urutan: 1, operator: "gte", nilaiAmbang: 13, nilaiAmbang2: null, skala: "bulanan" }] });
    expect(satu({ nilai: 13 }, [{ kpi: "biaya.labor_pct", v, id: 77 }]).boleh_sisip).toBe(true);
  });

  it("naik-baik (lt 30): nilai negatif melahirkan Signal", () => {
    const v = versi({ ruleKode: "laba_bersih_persen", severity: "critical", syarat: [{ urutan: 1, operator: "lt", nilaiAmbang: 30, nilaiAmbang2: null, skala: "bulanan" }] });
    const m = satu({ kpi: "biaya.net_profit_pct", nilai: -3.2 }, [{ kpi: "biaya.net_profit_pct", v, id: 88 }]);
    expect(m.boleh_sisip).toBe(true);
    expect(m.severity).toBe("critical");
    expect(m.operator).toBe("lt");
  });

  it("nol adalah angka, bukan kekosongan", () => {
    expect(satu({ nilai: 0 }).boleh_sisip).toBe(false);
  });
});

/* ═════════════════ 4 · periode berlaku ═════════════════ */

describe("periode berlaku aturan dihormati", () => {
  const sewa = versi({ ruleKode: "sewa_melebihi_ambang", severity: "medium", berlakuMulai: "2026-10", syarat: [{ urutan: 1, operator: "gt", nilaiAmbang: 5, nilaiAmbang2: null, skala: "bulanan" }] });
  const daftar = [{ kpi: "biaya.rent_pct", v: sewa, id: 99 }];

  it("September 2026 — sewa belum berlaku, tidak ada baris sama sekali", () => {
    expect(muat({ kpi: "biaya.rent_pct", nilai: 7.4 }, daftar, "2026-09")).toHaveLength(0);
  });

  it("Oktober 2026 — berlaku, melanggar", () => {
    const m = satu({ kpi: "biaya.rent_pct", nilai: 7.4 }, daftar, "2026-10");
    expect(m.boleh_sisip).toBe(true);
    expect(m.nilai_ambang).toBe(5);
    expect(m.periode).toBe("2026-10");
  });

  it("dua versi bertumpang DITOLAK, bukan dipilih salah satunya", () => {
    const a = versi({ versi: 1, berlakuMulai: "2026-08", berlakuSampai: null });
    const b = versi({ versi: 2, berlakuMulai: "2026-09", berlakuSampai: null });
    const kat = katalogDari([{ kpi: "biaya.labor_pct", v: a, id: 1 }, { kpi: "biaya.labor_pct", v: b, id: 2 }]);
    expect(() => susunMuatan("2026-09", [baris({}, [a])], kat)).toThrow(/lebih dari satu versi/);
  });

  it("versi berbeda → rule_version_id berbeda → identitas berbeda", () => {
    const v2 = versi({ versi: 2, berlakuMulai: "2026-12", syarat: [{ urutan: 1, operator: "gt", nilaiAmbang: 11, nilaiAmbang2: null, skala: "bulanan" }] });
    const m = satu({ nilai: 12 }, [{ kpi: "biaya.labor_pct", v: v2, id: 78 }], "2026-12");
    expect(m.rule_version_id).toBe(78);
    expect(m.nilai_ambang).toBe(11);
  });
});

/* ═════════════════ 5 · cakupan ═════════════════ */

describe("korporat dan outlet tidak pernah bercampur", () => {
  it("outlet membawa outlet_id, area_id kosong", () => {
    const m = satu({ cakupan: "outlet", cakupanId: "out_7" });
    expect(m.outlet_id).toBe("out_7");
    expect(m.area_id).toBeNull();
  });

  it("korporat tidak membawa penunjuk apa pun", () => {
    const m = satu({ cakupan: "korporat", cakupanId: "~korporat" });
    expect(m.outlet_id).toBeNull();
    expect(m.area_id).toBeNull();
  });

  it("area membawa area_id", () => {
    const m = satu({ cakupan: "area", cakupanId: "area_3" });
    expect(m.area_id).toBe("area_3");
    expect(m.outlet_id).toBeNull();
  });

  it("tidak ada agregasi, rata-rata, maupun penjumlahan di lapisan ini", () => {
    for (const p of ["AVG", "avg(", "SUM", "reduce((", "/ baris.length"]) {
      expect(kode).not.toContain(p);
    }
  });
});

/* ═════════════════ 6 · status KPI ═════════════════ */

describe("status KPI disalin apa adanya, bukan jadi state Signal", () => {
  it("final", () => {
    const m = satu({ nilai: 14.2, status: "final" });
    expect(m.status_kpi).toBe("final");
    expect(m.status_kpi_terakhir).toBe("final");
  });

  it("sementara TETAP melahirkan Signal", () => {
    const m = satu({ nilai: 14.2, status: "sementara" });
    expect(m.boleh_sisip).toBe(true);
    expect(m.status_kpi).toBe("sementara");
  });

  it("tidak ada state `provisional` di mana pun", () => {
    expect(kode).not.toContain("provisional");
    expect(sql).not.toContain("provisional");
  });
});

/* ═════════════════ 7 · bukti vs identitas ═════════════════ */

describe("kpi_value_id adalah bukti, bukan identitas", () => {
  it("regenerasi KPI mengganti bukti, bukan identitasnya", () => {
    const a = satu({ nilai: 14.2, kpiValueId: 8811 });
    const b = satu({ nilai: 14.4, kpiValueId: 9929 });
    // Identitasnya sama persis — unique index yang akan menyatukannya.
    for (const k of ["rule_version_id", "cakupan", "outlet_id", "periode", "skala"] as const) {
      expect(a[k]).toEqual(b[k]);
    }
    expect(a.kpi_value_id).not.toBe(b.kpi_value_id);
  });

  it("muatan membawa keduanya: bukti awal dan bukti terakhir", () => {
    const m = satu({ nilai: 14.2, kpiValueId: 8811 });
    expect(m.kpi_value_id).toBe(8811);
    expect(m.kpi_value_id_terakhir).toBe(8811);
  });
});

/* ═════════════════ 8 · penjaga batas ═════════════════ */

describe("mesin aturan tetap satu-satunya penilai", () => {
  it("tidak ada satu pun ambang di lapisan deteksi", () => {
    expect(kode).not.toMatch(/nilaiAmbang\s*[:=]\s*\d/);
    expect(kode).not.toContain("expenseThresholds");
    expect(kode).not.toContain("purchaseLimits");
    expect(kode).not.toContain("marginBands");
    expect(kode).not.toMatch(/>\s*(30|35|13|5|3)\b/);
  });

  it("perbandingan ambang tidak diulang di sini — dipanggil dari mesinnya", () => {
    expect(kode).not.toContain("melanggar(");
    expect(kode).toContain("versiBerlaku(");
  });

  it("PENULISNYA tidak menilai apa pun — ia cuma menyimpan", () => {
    // Daftar operator yang sah BOLEH ada di CHECK constraint: itu domain
    // kolom, bukan penilaian. Yang tidak boleh adalah penulisnya MEMBANDINGKAN
    // angka atau bercabang berdasarkan operator — di situlah mesin kedua lahir.
    const penulis = sql.slice(sql.indexOf("create or replace function gwg_deteksi_signal"));
    for (const op of ["'gt'", "'gte'", "'lt'", "'lte'", "'between'"]) {
      expect(penulis).not.toContain(op);
    }
    expect(penulis).not.toMatch(/nilai_ambang\s*[<>]/);
    expect(penulis).not.toMatch(/nilai_actual\s*[<>]/);
    expect(penulis).not.toMatch(/\bcase\b/i);
    // Keputusannya datang jadi, sebagai kolom.
    expect(penulis).toContain("where m.boleh_sisip");
  });

  it("tidak ada Diagnosis, Action, Impact, Learning, maupun AI", () => {
    for (const p of ["diagnos", "Diagnos", "impact", "Impact", "learning", "Learning", "openai", "anthropic"]) {
      expect(kode).not.toContain(p);
      expect(sql).not.toContain(p);
    }
  });

  it("tidak ada notifikasi di Phase 4, termasuk untuk critical", () => {
    expect(kode).not.toContain("notify");
    expect(kode).not.toContain("notifications");
    const rute = tanpaKomentar("src/app/api/cron/kpi-bulanan/route.ts");
    expect(rute).not.toContain("notify");
  });
});

/* ═════════════════ 9 · migrasi ═════════════════ */

describe("migrasi 0111 hanya menambah", () => {
  it("tidak menyentuh satu pun tabel yang sudah ada", () => {
    for (const t of ["kpi_values", "targets", "rules", "rule_versions", "rule_conditions", "op_settings", "op_expenses", "op_pnl", "op_purchases"]) {
      expect(sql).not.toMatch(new RegExp(`(alter|drop|update|delete\\s+from|insert\\s+into)\\s+(table\\s+)?${t}\\b`, "i"));
    }
  });

  it("tidak menyemai satu baris Signal pun", () => {
    expect(sql).not.toMatch(/insert\s+into\s+signals[\s\S]*values/i);
  });

  it("RLS menyala tanpa satu pun policy", () => {
    expect(sql).toMatch(/alter table signals enable row level security/);
    expect(sql).not.toMatch(/create\s+policy/i);
    expect(sql).toMatch(/revoke all on table signals from anon, authenticated/);
  });

  it("identitasnya memakai cakupan_id — bukan outlet_id yang bisa NULL", () => {
    expect(sql).toContain("coalesce(outlet_id, area_id, '~korporat')");
    expect(sql).toContain("create unique index if not exists signals_unik\n  on signals (rule_version_id, cakupan, cakupan_id, periode, skala)");
  });

  it("identitasnya TIDAK memakai kpi_value_id", () => {
    expect(sql).not.toMatch(/signals_unik[\s\S]{0,140}kpi_value_id/);
  });

  it("rule_kode tidak disalin ke dalam signals", () => {
    expect(sql).not.toMatch(/\brule_kode\s+text/);
  });

  it("gap, gap_persen, dan revenue_gap tidak ada", () => {
    for (const k of ["gap_persen", "revenue_gap", "gap "]) expect(sql).not.toContain(k);
  });

  it("hanya dua keadaan kerja", () => {
    expect(sql).toContain("status in ('terbuka', 'diabaikan')");
    for (const s of ["acknowledged", "diagnosing", "escalated", "resolved", "expired"]) {
      expect(sql).not.toContain(s);
    }
  });

  it("upsert hanya menyentuh blok pengamatan", () => {
    const conflict = sql.slice(sql.indexOf("on conflict"), sql.indexOf("returning (xmax = 0)"));
    for (const boleh of ["kpi_value_id_terakhir", "nilai_terakhir", "kondisi_terakhir", "status_kpi_terakhir", "diamati_pada"]) {
      expect(conflict).toContain(boleh);
    }
    for (const haram of ["status =", "diabaikan_oleh", "diabaikan_pada", "diabaikan_alasan", "nilai_actual", "nilai_ambang", "severity", "terdeteksi_pada", "kpi_definition_id"]) {
      expect(conflict).not.toContain(haram);
    }
  });

  it("kunci nasihat dan RPC tertutup rapat", () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('gwg_signal'), hashtext(p_periode))");
    expect(sql).toContain("revoke all on function gwg_deteksi_signal(text, jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function gwg_deteksi_signal(text, jsonb) to service_role");
  });
});

/* ═════════════════ 10 · rute cron ═════════════════ */

describe("deteksi menumpang penjadwal yang sudah ada", () => {
  const rute = tanpaKomentar("src/app/api/cron/kpi-bulanan/route.ts");

  it("urutannya generasi → finalisasi → deteksi", () => {
    const a = rute.indexOf("generateTerjadwal()");
    const b = rute.indexOf("finalisasiPeriodeSelesai()");
    const c = rute.indexOf("deteksiTerjadwal()");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("periodenya ditentukan WATERMARK, bukan periodeDifinalisasi", () => {
    // Inilah lubang yang ditutup: `periodeDifinalisasi` hanya menangkap periode
    // yang ditutup HARI INI, jadi periode yang sudah final sebelum Phase 4 ada
    // tidak pernah masuk lewat pintu mana pun.
    expect(rute).toContain("await deteksiTerjadwal();");
    // `periodeDifinalisasi` boleh tetap muncul di laporan kesehatan — yang
    // tidak boleh adalah ia kembali menjadi MASUKAN deteksi.
    expect(rute).not.toMatch(/deteksi\w*\([^)]*periodeDifinalisasi/);
    expect(rute).not.toMatch(/deteksi\w*\([^)]*generasi\.map/);
  });

  it("watermark ikut dilaporkan supaya pergerakannya terlihat", () => {
    expect(rute).toContain("watermark_sebelum");
    expect(rute).toContain("watermark_sesudah");
  });

  it("ikut dilaporkan ke sinkron_sehat — sukses dan gagal", () => {
    expect(rute).toContain("deteksi:");
    // Dihitung di badan GET saja; jalur remediasi punya kuncinya sendiri dan
    // diuji terpisah, jadi mencampur keduanya membuat angka ini tidak berarti.
    const badanGet = rute.slice(rute.indexOf("export async function GET"), rute.indexOf("async function remediasi"));
    expect(badanGet.match(/catatHasilSinkron\(/g) ?? []).toHaveLength(2);
  });

  it("tidak ada cron kedua", () => {
    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
    expect(vercel.match(/"path"/g) ?? []).toHaveLength(2);
    expect(vercel).not.toContain("signal");
  });
});

/* ═════════════════ 11 · sidik isi himpunan kandidat ═════════════════ */

describe("sidik isi bisa dihitung ulang, dan itu gunanya", () => {
  const dasar = (o: Partial<BarisMuatan> = {}): BarisMuatan => ({
    boleh_sisip: true,
    rule_kode: "tenaga_kerja_persen",
    rule_version_id: 6,
    cakupan: "outlet",
    outlet_id: "out_1",
    area_id: null,
    periode: "2026-08",
    skala: "bulanan",
    kpi_definition_id: "biaya.labor_pct",
    kpi_value_id: 1158,
    nilai_actual: 14.2,
    nilai_ambang: 13,
    nilai_ambang_2: null,
    operator: "gt",
    severity: "high",
    status_kpi: "final",
    kpi_value_id_terakhir: 1158,
    nilai_terakhir: 14.2,
    kondisi_terakhir: "lewat_ambang",
    status_kpi_terakhir: "final",
    ...o,
  });

  it("isi yang sama menghasilkan sidik yang sama, urutan tidak penting", () => {
    const a = dasar();
    const b = dasar({ outlet_id: "out_2", kpi_value_id: 1159 });
    expect(sidikMuatan([a, b])).toBe(sidikMuatan([b, a]));
  });

  it("satu angka bergeser, sidiknya berubah", () => {
    expect(sidikMuatan([dasar()])).not.toBe(sidikMuatan([dasar({ nilai_actual: 14.200001 })]));
    expect(sidikMuatan([dasar()])).not.toBe(sidikMuatan([dasar({ nilai_ambang: 13.000001 })]));
    expect(sidikMuatan([dasar()])).not.toBe(sidikMuatan([dasar({ severity: "medium" })]));
    expect(sidikMuatan([dasar()])).not.toBe(sidikMuatan([dasar({ rule_version_id: 7 })]));
  });

  it("nol dan nol-dengan-desimal adalah angka yang sama", () => {
    // Resepnya merender enam desimal tetap supaya sidiknya bisa dihitung ulang
    // di SQL — tanpa itu, `0` dan `0.0000` memberi sidik berbeda untuk isi sama.
    expect(sidikMuatan([dasar({ nilai_actual: 0 })])).toBe(sidikMuatan([dasar({ nilai_actual: 0.0 })]));
  });

  it("korporat disidik lewat '~korporat', bukan lewat NULL", () => {
    const korp = dasar({ cakupan: "korporat", outlet_id: null });
    expect(sidikMuatan([korp])).toBe(sidikMuatan([korp]));
    expect(sidikMuatan([korp])).not.toBe(sidikMuatan([dasar()]));
  });

  it("himpunan kosong tetap punya sidik yang stabil", () => {
    expect(sidikMuatan([])).toBe(sidikMuatan([]));
  });
});

/* ═════════════════ 12 · pintu remediasi ═════════════════ */

describe("pintu remediasi terkunci sekencang jalur terjadwal", () => {
  const rute = tanpaKomentar("src/app/api/cron/kpi-bulanan/route.ts");

  it("gerbang tokennya SATU, dan remediasi berada di belakangnya", () => {
    const gerbang = rute.indexOf("cronAuthorized(");
    const pintu = rute.indexOf('url.searchParams.get("mode") === "deteksi"');
    expect(gerbang).toBeGreaterThan(-1);
    expect(pintu).toBeGreaterThan(gerbang);
    expect(rute.match(/cronAuthorized\(/g) ?? []).toHaveLength(1);
  });

  it("periodenya lewat daftar putih, bukan sekadar bentuk", () => {
    expect(rute).toContain("bolehDiremediasi(periode)");
    expect(rute).not.toMatch(/periode\s*&&\s*bulanSah\(periode\)\s*\)\s*\{/);
  });

  it("tidak menggenerate, tidak memfinalisasi", () => {
    const badan = rute.slice(rute.indexOf("async function remediasi"));
    expect(badan).not.toContain("generateTerjadwal");
    expect(badan).not.toContain("finalisasiPeriodeSelesai");
  });

  it("tidak menggeser watermark", () => {
    const badan = rute.slice(rute.indexOf("async function remediasi"));
    expect(badan).not.toContain("majuWatermark");
    expect(badan).not.toContain("deteksiTerjadwal");
  });

  it("memakai jalur deteksi yang sama, bukan jalur pintas", () => {
    const badan = rute.slice(rute.indexOf("async function remediasi"));
    expect(badan).toContain("deteksiSignal(periode)");
    expect(badan).toContain("praDeteksi(periode)");
  });

  it("pratinjau tidak menulis apa pun", () => {
    const pra = kode.slice(kode.indexOf("export async function praDeteksi"), kode.indexOf("export async function bacaWatermark"));
    expect(pra).not.toContain(".rpc(");
    expect(pra).not.toContain("gwg_deteksi_signal");
    expect(pra).not.toContain("majuWatermark");
  });

  it("melapor ke sinkron_sehat dengan kunci TERPISAH dari jalur terjadwal", () => {
    expect(rute).toContain('"kpi-bulanan-remediasi"');
  });

  it("gagal tetap terlihat gagal — 500, bukan 200", () => {
    const badan = rute.slice(rute.indexOf("async function remediasi"));
    expect(badan).toContain("status: 500");
    expect(badan).toContain("status: 400");
  });
});

/* ═════════════════ 13 · watermark di lapisan data ═════════════════ */

describe("watermark hanya maju setelah deteksi berhasil", () => {
  it("tunggakan dinilai dulu, baru watermark digeser — per periode", () => {
    const badan = kode.slice(kode.indexOf("export async function deteksiTerjadwal"));
    const deteksi = badan.indexOf("await deteksiSignal(p)");
    const maju = badan.indexOf("await majuWatermark(p)");
    expect(deteksi).toBeGreaterThan(-1);
    expect(maju).toBeGreaterThan(deteksi);
  });

  it("bulan berjalan dinilai SESUDAH tunggakan dan tidak menggeser watermark", () => {
    const badan = kode.slice(kode.indexOf("export async function deteksiTerjadwal"));
    const berjalan = badan.indexOf("deteksiSignal(rencana.berjalan)");
    expect(berjalan).toBeGreaterThan(badan.indexOf("await majuWatermark(p)"));
    expect(badan.slice(berjalan)).not.toContain("majuWatermark");
  });

  it("watermark tidak pernah mundur", () => {
    const badan = kode.slice(kode.indexOf("export async function majuWatermark"), kode.indexOf("export async function periodeKpiPalingAwal"));
    expect(badan).toContain("periode <= sekarang");
    expect(badan).toContain("return false");
  });

  it("nilai watermark yang tidak sah dianggap belum ada, bukan dipakai", () => {
    const badan = kode.slice(kode.indexOf("export async function bacaWatermark"), kode.indexOf("export async function majuWatermark"));
    expect(badan).toContain("bulanSah(nilai)");
  });

  it("memakai app_config yang sudah ada — tanpa tabel baru", () => {
    expect(kode).toContain("getAppConfig");
    expect(kode).toContain("setAppConfig");
    expect(kode).not.toMatch(/from\("signal_watermark/);
    const sqlBaru = tanpaKomentar("supabase/migrations/0111_signals.sql");
    expect(sqlBaru).not.toContain("watermark");
  });

  it("bootstrap diturunkan dari data, bukan bulan yang ditulis di kode", () => {
    const badan = kode.slice(kode.indexOf("export async function periodeKpiPalingAwal"));
    expect(badan).toContain('.from("kpi_values")');
    expect(badan).toContain('order("periode"');
    expect(kode).not.toMatch(/"2026-0[0-9]"/);
  });
});
