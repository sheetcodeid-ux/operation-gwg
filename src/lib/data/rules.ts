import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { evaluasi, type HasilEvaluasi, type Operator, type Severity, type VersiAturan } from "@/lib/ops/rules";
import { bulanSah } from "@/lib/ops/waktu";
import type { StatusNilai } from "@/lib/ops/kpi-sales";

/**
 * MEMBACA ATURAN DAN MENILAI KPI SATU PERIODE.
 *
 * ┌─ HASILNYA TIDAK DISIMPAN, DAN ITU KEPUTUSAN ─────────────────────────────┐
 * │                                                                          │
 * │ Sebuah kondisi bisa dihasilkan ulang kapan saja dari dua hal yang sudah  │
 * │ tersimpan: angka di `kpi_values` dan aturan di `rule_versions`. Keduanya │
 * │ berversi dan tidak pernah disunting di tempat, jadi jawabannya untuk     │
 * │ periode mana pun selalu sama.                                            │
 * │                                                                          │
 * │ Menyimpannya berarti sumber kebenaran ketiga yang bisa basi diam-diam —  │
 * │ dan hari ini tidak ada satu pun pembaca yang membutuhkannya, sebab       │
 * │ Signal belum ada. Tabel `kpi_rule_evaluations` baru masuk akal ketika    │
 * │ Signal butuh mengingat "sudah pernah ditangani belum", dan itu phase     │
 * │ berikutnya.                                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Bacaannya MASSAL: tiga query untuk seluruh aturan, satu untuk seluruh nilai
 * KPI satu periode. Tidak ada query per outlet, tidak ada query per KPI.
 */

/* ─────────────────────────── pembacaan aturan ─────────────────────────── */

export interface BarisRule {
  kode: string;
  nama: string;
  kpi_definition_id: string;
  kategori: string;
  cakupan: string;
  aktif: boolean;
}

export interface BarisVersi {
  id: number;
  rule_kode: string;
  versi: number;
  berlaku_mulai: string;
  berlaku_sampai: string | null;
  severity_default: string;
  sumber: string;
}

export interface BarisSyarat {
  rule_version_id: number;
  urutan: number;
  operator: string;
  nilai_ambang: number | string;
  nilai_ambang_2: number | string | null;
  skala: string;
}

export interface KatalogAturan {
  /** kpi_definition_id → seluruh versi aturan untuk KPI itu. */
  perKpi: Map<string, VersiAturan[]>;
  jumlahRule: number;
  jumlahVersi: number;
  jumlahSyarat: number;
}

const angka = (v: number | string | null): number | null => (v === null ? null : Number(v));

/**
 * Merangkai katalog dari baris mentah — MURNI, supaya perilakunya bisa diuji.
 *
 * ┌─ ATURAN NON-AKTIF TIDAK IKUT, DAN ITU YANG DIJAGA DI SINI ───────────────┐
 * │                                                                          │
 * │ Penyaringannya sengaja ADA DI DUA TEMPAT: kueri `rules` sudah meminta    │
 * │ `aktif = true` supaya muatannya kecil, dan fungsi ini menyaring lagi.    │
 * │ Kelebihan yang disengaja — kalau kelak seseorang menghapus `.eq()` itu   │
 * │ demi menampilkan aturan non-aktif di layar pengaturan, ambang yang sudah │
 * │ ditarik TIDAK ikut hidup lagi diam-diam.                                 │
 * │                                                                          │
 * │ Yang ditarik hari ini: `listrik_persen`, `air_persen`, `internet_persen` │
 * │ (AD-13). Versi dan syaratnya masih ada di basis data — memang begitu     │
 * │ maksudnya — jadi tanpa saringan ini ambang 4/1/1 akan tetap menilai.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function susunKatalog(rules: BarisRule[], versi: BarisVersi[], syarat: BarisSyarat[]): KatalogAturan {
  const syaratPerVersi = new Map<number, BarisSyarat[]>();
  for (const s of syarat) {
    const daftar = syaratPerVersi.get(s.rule_version_id) ?? [];
    daftar.push(s);
    syaratPerVersi.set(s.rule_version_id, daftar);
  }

  const kpiPerRule = new Map(rules.filter((r) => r.aktif).map((r) => [r.kode, r.kpi_definition_id]));
  const perKpi = new Map<string, VersiAturan[]>();
  let jumlahSyarat = 0;

  for (const v of versi) {
    const kpi = kpiPerRule.get(v.rule_kode);
    if (!kpi) continue; // aturannya tidak aktif — versinya ikut tidak dipakai
    const s = syaratPerVersi.get(v.id) ?? [];
    jumlahSyarat += s.length;
    const daftar = perKpi.get(kpi) ?? [];
    daftar.push({
      ruleKode: v.rule_kode,
      versi: v.versi,
      berlakuMulai: v.berlaku_mulai,
      berlakuSampai: v.berlaku_sampai,
      severity: v.severity_default as Severity,
      sumber: v.sumber,
      syarat: s.map((x) => ({
        urutan: x.urutan,
        operator: x.operator as Operator,
        nilaiAmbang: Number(x.nilai_ambang),
        nilaiAmbang2: angka(x.nilai_ambang_2),
        skala: x.skala,
      })),
    });
    perKpi.set(kpi, daftar);
  }

  return { perKpi, jumlahRule: rules.length, jumlahVersi: versi.length, jumlahSyarat };
}

/** Seluruh aturan aktif beserta versi dan syaratnya — tiga query, sekali jalan. */
export async function bacaKatalogAturan(): Promise<KatalogAturan> {
  if (!dbEnabled) throw new Error("basis data tidak aktif");

  const [rules, versi, syarat] = await Promise.all([
    selectAll<BarisRule>("rules", (a, b) => db().from("rules").select("*").eq("aktif", true).order("kode").range(a, b)),
    selectAll<BarisVersi>("rule_versions", (a, b) => db().from("rule_versions").select("*").order("id").range(a, b)),
    selectAll<BarisSyarat>("rule_conditions", (a, b) => db().from("rule_conditions").select("*").order("id").range(a, b)),
  ]);

  return susunKatalog(rules, versi, syarat);
}

/* ─────────────────────────── penilaian periode ─────────────────────────── */

export interface KondisiKpi {
  kpiDefinitionId: string;
  cakupan: string;
  cakupanId: string;
  periode: string;
  nilai: number | null;
  status: StatusNilai;
  hasil: HasilEvaluasi;
}

export interface RingkasKondisi {
  periode: string;
  baris: KondisiKpi[];
  /** Cacah per kondisi — untuk dilaporkan apa adanya. */
  cacah: Record<string, number>;
}

interface BarisNilai {
  kpi_definition_id: string;
  cakupan: string;
  cakupan_id: string | null;
  nilai: number | string | null;
  status: string;
}

/**
 * Nilai seluruh KPI TERKINI satu periode terhadap aturan yang berlaku untuknya.
 *
 * TIDAK MENULIS APA PUN. Angka KPI-nya tidak disentuh, statusnya tidak
 * disentuh, dan tidak ada baris hasil yang disimpan.
 */
export async function kondisiPeriode(periode: string): Promise<RingkasKondisi> {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  if (!dbEnabled) throw new Error("basis data tidak aktif");

  const [katalog, nilai] = await Promise.all([
    bacaKatalogAturan(),
    selectAll<BarisNilai>("kpi_values", (a, b) =>
      db()
        .from("kpi_values")
        .select("kpi_definition_id,cakupan,cakupan_id,nilai,status")
        .eq("periode", periode)
        .eq("skala", "bulanan")
        .eq("terkini", true)
        .order("id")
        .range(a, b),
    ),
  ]);

  const baris: KondisiKpi[] = nilai.map((n) => ({
    kpiDefinitionId: n.kpi_definition_id,
    cakupan: n.cakupan,
    cakupanId: n.cakupan_id ?? "~korporat",
    periode,
    nilai: angka(n.nilai),
    status: n.status as StatusNilai,
    hasil: evaluasi({
      periode,
      nilai: angka(n.nilai),
      status: n.status as StatusNilai,
      versi: katalog.perKpi.get(n.kpi_definition_id) ?? [],
    }),
  }));

  const cacah: Record<string, number> = {};
  for (const b of baris) cacah[b.hasil.kondisi] = (cacah[b.hasil.kondisi] ?? 0) + 1;

  return { periode, baris, cacah };
}
