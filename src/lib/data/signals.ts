import "server-only";

import { createHash } from "node:crypto";
import { db, dbEnabled } from "./db";
import { getAppConfig, setAppConfig } from "./app-config";
import { kondisiPeriode, type KatalogAturan, type KondisiKpi } from "./rules";
import { versiBerlaku } from "@/lib/ops/rules";
import { KUNCI_WATERMARK, rencanaDeteksi, type RencanaDeteksi } from "@/lib/ops/deteksi";
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
  /**
   * Ikut dikirim untuk keterbacaan muatan dan untuk sidik isi yang stabil.
   * `jsonb_to_recordset` di `gwg_deteksi_signal` TIDAK mendeklarasikannya, jadi
   * SQL mengabaikannya sepenuhnya — ia tidak pernah tersimpan di `signals`,
   * yang memang hanya menyimpan `rule_version_id`.
   */
  rule_kode: string;
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
      rule_kode: versi.ruleKode,
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

/* ─────────────────────────── sidik isi & pratinjau ─────────────────────────── */

/** Enam angka di belakang koma, dirender sama di TypeScript maupun SQL. */
const enam = (n: number | null): string => (n === null ? "~" : n.toFixed(6));

/**
 * Sidik jari himpunan kandidat — supaya "himpunan yang disetujui" dan
 * "himpunan yang benar-benar ditulis" bisa dibandingkan, bukan dipercaya.
 *
 * Resepnya sengaja dibuat bisa dihitung ulang di SQL: urutannya eksplisit dan
 * tiap angka dirender dengan enam desimal tetap. Tanpa itu, `0` dan `0.0000`
 * menghasilkan sidik yang berbeda untuk isi yang sama — dan sidik yang tidak
 * bisa dihitung ulang tidak membuktikan apa pun.
 */
export function sidikMuatan(muatan: readonly BarisMuatan[]): string {
  const urut = [...muatan].sort(
    (a, b) =>
      a.rule_kode.localeCompare(b.rule_kode) ||
      a.cakupan.localeCompare(b.cakupan) ||
      (a.outlet_id ?? a.area_id ?? "~korporat").localeCompare(b.outlet_id ?? b.area_id ?? "~korporat") ||
      a.kpi_value_id - b.kpi_value_id,
  );
  const baris = urut.map((m) =>
    [
      m.rule_kode,
      m.rule_version_id,
      m.cakupan,
      m.outlet_id ?? m.area_id ?? "~korporat",
      m.periode,
      m.skala,
      m.kpi_definition_id,
      m.kpi_value_id,
      enam(m.nilai_actual),
      enam(m.nilai_ambang),
      enam(m.nilai_ambang_2),
      m.operator,
      m.severity,
      m.status_kpi,
    ].join("|"),
  );
  return createHash("md5").update(baris.join("\n")).digest("hex");
}

export interface PratinjauDeteksi {
  periode: string;
  diperiksa: number;
  beraturan: number;
  /** Kandidat Signal — yang akan benar-benar disisipkan. */
  kandidat: number;
  perRule: Record<string, number>;
  perSeverity: Record<string, number>;
  perCakupan: Record<string, number>;
  perStatusKpi: Record<string, number>;
  sidik: string;
}

const cacah = (baris: readonly BarisMuatan[], ambil: (m: BarisMuatan) => string): Record<string, number> => {
  const h: Record<string, number> = {};
  for (const m of baris) h[ambil(m)] = (h[ambil(m)] ?? 0) + 1;
  return h;
};

/**
 * Menghitung apa yang AKAN terjadi, tanpa menulis satu baris pun.
 *
 * Memakai jalur yang sama persis dengan deteksi sungguhan — `kondisiPeriode()`
 * → `evaluasi()` → `susunMuatan()` — jadi yang dipratinjau memang yang akan
 * ditulis, bukan perkiraan yang disusun terpisah dan bisa berbeda diam-diam.
 */
export async function praDeteksi(periode: string): Promise<PratinjauDeteksi> {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  if (!dbEnabled) throw new Error("basis data tidak aktif");

  const ringkas = await kondisiPeriode(periode);
  const muatan = susunMuatan(periode, ringkas.baris, ringkas.katalog);
  const kandidat = muatan.filter((m) => m.boleh_sisip);

  return {
    periode,
    diperiksa: ringkas.baris.length,
    beraturan: muatan.length,
    kandidat: kandidat.length,
    perRule: cacah(kandidat, (m) => m.rule_kode),
    perSeverity: cacah(kandidat, (m) => m.severity),
    perCakupan: cacah(kandidat, (m) => m.cakupan),
    perStatusKpi: cacah(kandidat, (m) => m.status_kpi),
    sidik: sidikMuatan(kandidat),
  };
}

/* ─────────────────────────── watermark ─────────────────────────── */

/** Bulan terakhir yang deteksinya sudah tuntas, atau null kalau belum pernah ada. */
export async function bacaWatermark(): Promise<string | null> {
  const nilai = await getAppConfig(KUNCI_WATERMARK);
  return nilai && bulanSah(nilai) ? nilai : null;
}

/**
 * Memajukan watermark — HANYA maju, tidak pernah mundur.
 *
 * Mundur berarti periode yang sudah dinilai akan dinilai ulang tanpa alasan;
 * lebih buruk, ia menyembunyikan bug yang menulis nilai lama ke sana.
 */
export async function majuWatermark(periode: string): Promise<boolean> {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  const sekarang = await bacaWatermark();
  if (sekarang !== null && periode <= sekarang) return false;
  await setAppConfig(KUNCI_WATERMARK, periode);
  return true;
}

/** Periode KPI bulanan paling awal yang ada — dasar bootstrap, diturunkan dari data. */
export async function periodeKpiPalingAwal(): Promise<string | null> {
  if (!dbEnabled) throw new Error("basis data tidak aktif");
  const { data, error } = await db()
    .from("kpi_values")
    .select("periode")
    .eq("skala", "bulanan")
    .eq("terkini", true)
    .order("periode", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`gagal membaca periode KPI paling awal: ${error.message}`);
  return (data as { periode: string } | null)?.periode ?? null;
}

export interface RingkasTerjadwal {
  watermarkSebelum: string | null;
  watermarkSesudah: string | null;
  rencana: RencanaDeteksi;
  hasil: RingkasDeteksi[];
}

/**
 * Deteksi terjadwal — tunggakan lebih dulu, bulan berjalan belakangan.
 *
 * ┌─ WATERMARK MAJU PER PERIODE, BUKAN DI AKHIR ─────────────────────────────┐
 * │                                                                          │
 * │ Kalau periode ketiga gagal, dua yang pertama tetap tercatat tuntas —     │
 * │ pekerjaan yang sudah berhasil tidak dibuang, dan tidak ada periode yang  │
 * │ dilangkahi. Kegagalan melempar ke pemanggil, jadi rute tetap membalas    │
 * │ 500 dan `sinkron_sehat` tetap mencatat galat.                            │
 * │                                                                          │
 * │ Bulan berjalan dinilai paling akhir dan TIDAK PERNAH menggeser           │
 * │ watermark — lihat `src/lib/ops/deteksi.ts`.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export async function deteksiTerjadwal(pada: number = Date.now()): Promise<RingkasTerjadwal> {
  const watermarkSebelum = await bacaWatermark();
  const rencana = rencanaDeteksi(watermarkSebelum, await periodeKpiPalingAwal(), pada);

  const hasil: RingkasDeteksi[] = [];
  let watermarkSesudah = watermarkSebelum;

  for (const p of rencana.susulan) {
    hasil.push(await deteksiSignal(p));
    await majuWatermark(p);
    watermarkSesudah = p;
  }

  hasil.push(await deteksiSignal(rencana.berjalan));

  return { watermarkSebelum, watermarkSesudah, rencana, hasil };
}
