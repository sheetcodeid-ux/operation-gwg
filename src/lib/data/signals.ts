import "server-only";

import { db, dbEnabled } from "./db";
import { kondisiPeriode, type KatalogAturan, type KondisiKpi } from "./rules";
import { versiBerlaku } from "@/lib/ops/rules";
import { bulanSah } from "@/lib/ops/waktu";

/**
 * DETEKSI SIGNAL — mencatat bahwa sebuah angka melanggar aturan yang memang
 * berlaku untuknya.
 *
 * ┌─ SIGNAL BUKAN TAFSIR YANG DISIMPAN ──────────────────────────────────────┐
 * │                                                                          │
 * │ Yang disimpan HANYA pelanggaran — 341 dari 2.236 evaluasi. `aman`,       │
 * │ `tanpa_aturan`, `tidak_tersedia`, dan `invalid` tetap dihitung saat      │
 * │ dibaca dan tidak pernah punya baris.                                     │
 * │                                                                          │
 * │ Bedanya penting: "aman" adalah TAFSIR, dan tafsir yang tersimpan menjadi │
 * │ salah diam-diam begitu aturannya berganti. Sebuah PELANGGARAN bukan      │
 * │ tafsir — ia peristiwa yang benar-benar terjadi pada tanggal tertentu,    │
 * │ dan ia layak diingat karena ada orang yang harus menindaklanjutinya.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TIDAK ADA SATU PUN AMBANG DI BERKAS INI ────────────────────────────────┐
 * │                                                                          │
 * │ Penilaiannya seluruhnya `src/lib/ops/rules.ts`. Berkas ini cuma memutuskan│
 * │ APA YANG DILAKUKAN terhadap hasilnya. Tidak ada `if nilai > 30` di sini, │
 * │ dan tidak ada di SQL — `src/lib/data/signals.test.ts` menjaganya.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/* ─────────────────────────── bentuk muatan ─────────────────────────── */

/** Satu baris muatan untuk `gwg_deteksi_signal`. Namanya mengikuti kolom SQL. */
export interface BarisMuatan {
  /**
   * Boleh melahirkan Signal baru?
   *
   * Hanya `lewat_ambang` dari sumber yang sah. Baris lain tetap dikirim —
   * mereka mengabarkan keadaan terakhir kepada Signal yang mungkin sudah ada —
   * tapi tidak pernah menyisipkan baris baru.
   */
  boleh_sisip: boolean;
  rule_version_id: number;
  cakupan: string;
  outlet_id: string | null;
  area_id: string | null;
  periode: string;
  skala: string;
  kpi_definition_id: string;
  kpi_value_id: number;
  nilai_actual: number | null;
  nilai_ambang: number;
  nilai_ambang_2: number | null;
  operator: string;
  severity: string;
  status_kpi: string;
  kpi_value_id_terakhir: number;
  nilai_terakhir: number | null;
  kondisi_terakhir: string;
  status_kpi_terakhir: string;
}

export interface RingkasDeteksi {
  periode: string;
  /** Baris KPI terkini yang diperiksa. */
  diperiksa: number;
  /** Baris yang punya versi aturan berlaku, jadi punya identitas Signal. */
  beraturan: number;
  /** Baris yang boleh melahirkan Signal. */
  layak: number;
  disisipkan: number;
  diperbarui: number;
  diamatiSaja: number;
}

/* ─────────────────────────── penyusunan muatan ─────────────────────────── */

const penunjuk = (b: KondisiKpi): { outlet_id: string | null; area_id: string | null } =>
  b.cakupan === "outlet"
    ? { outlet_id: b.cakupanId, area_id: null }
    : b.cakupan === "area"
      ? { outlet_id: null, area_id: b.cakupanId }
      : { outlet_id: null, area_id: null };

/**
 * Menyusun muatan dari hasil penilaian — MURNI, supaya tiap keputusannya bisa
 * diuji tanpa basis data.
 *
 * Urutan pemeriksaannya disengaja dan mengikuti kontrak AD-14:
 *
 *   1. ada versi aturan yang berlaku untuk PERIODE ITU?  tidak → tidak ada
 *      identitas Signal sama sekali, barisnya dibuang
 *   2. versinya punya syarat?                            tidak → sama
 *   3. sumbernya sah DAN hasilnya `lewat_ambang`?         ya  → boleh melahirkan
 *   4. selain itu                                        → mengabarkan saja
 */
export function susunMuatan(periode: string, baris: readonly KondisiKpi[], katalog: KatalogAturan): BarisMuatan[] {
  const muatan: BarisMuatan[] = [];

  for (const b of baris) {
    // Memakai fungsi mesin yang sama dengan `evaluasi()`, bukan salinannya.
    // Ia melempar bila ada dua versi yang bertumpang — jaring kedua setelah
    // pemicu basis data, dan memang tidak boleh dijawab oleh urutan baris.
    const versi = versiBerlaku(katalog.perKpi.get(b.kpiDefinitionId) ?? [], periode);
    if (!versi) continue; // tanpa_aturan — tidak ada `rule_version_id`, jadi tidak ada Signal
    if (versi.syarat.length === 0) continue;

    const id = katalog.idVersi.get(`${versi.ruleKode}|${versi.versi}`);
    if (id === undefined) continue; // versinya tidak dikenal katalog — tidak menebak

    const melanggar = b.hasil.kondisi === "lewat_ambang";
    // Syarat yang dilanggar sudah dipilih `evaluasi()`; kalau tidak ada yang
    // dilanggar, syarat pertama yang dicatat — dan ia toh tidak pernah disisipkan.
    const urut = [...versi.syarat].sort((x, y) => x.urutan - y.urutan);
    const dipakai = melanggar
      ? { operator: b.hasil.operator ?? urut[0].operator, nilaiAmbang: b.hasil.nilaiAmbang ?? urut[0].nilaiAmbang, nilaiAmbang2: b.hasil.nilaiAmbang2 ?? urut[0].nilaiAmbang2 }
      : { operator: urut[0].operator, nilaiAmbang: urut[0].nilaiAmbang, nilaiAmbang2: urut[0].nilaiAmbang2 };

    // Sumber yang sudah dinyatakan tidak sah tidak pernah melahirkan tuduhan,
    // dan keadaan terakhirnya dicatat apa adanya: angkanya tidak bisa dipakai.
    const bolehSisip = melanggar && b.sumberSah;
    const kondisi = b.sumberSah ? b.hasil.kondisi : "tidak_tersedia";

    muatan.push({
      boleh_sisip: bolehSisip,
      rule_version_id: id,
      cakupan: b.cakupan,
      ...penunjuk(b),
      periode,
      skala: "bulanan",
      kpi_definition_id: b.kpiDefinitionId,
      kpi_value_id: b.kpiValueId,
      nilai_actual: b.nilai,
      nilai_ambang: dipakai.nilaiAmbang,
      nilai_ambang_2: dipakai.nilaiAmbang2,
      operator: dipakai.operator,
      severity: versi.severity,
      status_kpi: b.status,
      kpi_value_id_terakhir: b.kpiValueId,
      nilai_terakhir: b.nilai,
      kondisi_terakhir: kondisi,
      status_kpi_terakhir: b.status,
    });
  }

  return muatan;
}

/* ─────────────────────────── penulisan ─────────────────────────── */

/** Deteksi satu periode. Idempoten: jalan kedua tidak melahirkan baris baru. */
export async function deteksiSignal(periode: string): Promise<RingkasDeteksi> {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  if (!dbEnabled) throw new Error("basis data tidak aktif");

  const ringkas = await kondisiPeriode(periode);
  const muatan = susunMuatan(periode, ringkas.baris, ringkas.katalog);

  const kosong: RingkasDeteksi = {
    periode,
    diperiksa: ringkas.baris.length,
    beraturan: muatan.length,
    layak: muatan.filter((m) => m.boleh_sisip).length,
    disisipkan: 0,
    diperbarui: 0,
    diamatiSaja: 0,
  };
  if (muatan.length === 0) return kosong;

  const { data, error } = await db().rpc("gwg_deteksi_signal", { p_periode: periode, p_baris: muatan });
  if (error) throw new Error(`deteksi signal ${periode} gagal: ${error.message}`);

  const h = (data ?? {}) as { disisipkan?: number; diperbarui?: number; diamati_saja?: number };
  return {
    ...kosong,
    disisipkan: h.disisipkan ?? 0,
    diperbarui: h.diperbarui ?? 0,
    diamatiSaja: h.diamati_saja ?? 0,
  };
}

/**
 * Deteksi beberapa periode berurutan.
 *
 * Berurutan, bukan paralel: tiap periode memegang kunci nasihatnya sendiri, dan
 * menjalankannya bersamaan cuma menukar waktu tunggu dengan tekanan koneksi.
 */
export async function deteksiPeriode(periode: readonly string[]): Promise<RingkasDeteksi[]> {
  const hasil: RingkasDeteksi[] = [];
  for (const p of [...new Set(periode)].sort()) hasil.push(await deteksiSignal(p));
  return hasil;
}
