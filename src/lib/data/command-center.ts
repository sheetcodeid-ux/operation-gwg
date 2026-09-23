import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { SKALA_SIGNAL, urutSeverity } from "./signal-baca";
import { areaName, getOutlets, getUsers } from "./store";
import { bulanIniWib, bulanSah } from "@/lib/ops/waktu";

/**
 * COMMAND CENTER — pembacanya, dan ia terpisah dari pembaca Weekly dengan sengaja.
 *
 * ┌─ KENAPA BUKAN MEMPERLUAS `signal-baca.ts` ───────────────────────────────┐
 * │                                                                          │
 * │ `signalBulananOutlet()` mengunci `cakupan = 'outlet'` dan satu periode,  │
 * │ dan kuncian itu BENAR untuk Weekly: layar itu bersumbu minggu dalam satu │
 * │ bulan, dan Signal korporat tidak punya tempat di baris per outlet.       │
 * │                                                                          │
 * │ Command Center menanyakan hal yang berbeda — "apa yang masih perlu       │
 * │ ditangani", lintas periode, outlet DAN korporat. Melonggarkan pembaca    │
 * │ Weekly untuk melayani keduanya berarti satu fungsi dengan dua kontrak    │
 * │ yang bisa berbeda diam-diam, dan Weekly yang sudah berjalan yang akan    │
 * │ menanggung akibatnya.                                                    │
 * │                                                                          │
 * │ Yang dibagi cuma primitif yang memang satu aturan: `SKALA_SIGNAL` dan    │
 * │ `urutSeverity`.                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DUA JALUR CAKUPAN, DAN ITU BUKAN KELALAIAN ─────────────────────────────┐
 * │                                                                          │
 * │ Signal OUTLET disaring daftar outlet yang sah — `persempit()` di         │
 * │ halamannya, bukan di sini.                                               │
 * │                                                                          │
 * │ Signal KORPORAT tidak punya `outlet_id`, jadi ia TIDAK BISA melewati     │
 * │ penyaring berbasis outlet. Gerbangnya `canReachMenu()` di halaman        │
 * │ (Z-01 · O10 = B). `sertakanKorporat` di sini menyampaikan hasil gerbang  │
 * │ itu, bukan memutuskannya sendiri.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TIDAK MENULIS APA PUN. Membaca `signals` apa adanya; tidak menjalankan
 * detektor, tidak menghitung ulang KPI, tidak menyentuh snapshot.
 */

/** Satu Signal sebagaimana dibutuhkan layar triase. */
export interface SignalTriase {
  id: number;
  cakupan: "outlet" | "korporat";
  periode: string;
  outletId: string | null;
  outletNama: string | null;
  areaNama: string | null;
  kpiDefinitionId: string;
  severity: string;
  operator: string;
  nilaiActual: number;
  nilaiAmbang: number;
  nilaiAmbang2: number | null;
  /** Keadaan saat PERTAMA terdeteksi — beku. */
  statusKpi: string;
  terdeteksiPada: string;
  /** Pengamatan TERAKHIR — inilah yang membedakan memburuk dari membaik. */
  nilaiTerakhir: number | null;
  kondisiTerakhir: string;
  statusKpiTerakhir: string;
  diamatiPada: string;
  /** Work-state: siapa yang sudah menyatakan melihatnya, dan kapan. */
  diakuiOleh: string | null;
  diakuiNama: string | null;
  diakuiPada: string | null;
}

/** Signal satu outlet pada satu periode — bentuk yang digambar layar. */
export interface KelompokOutlet {
  outletId: string;
  outletNama: string;
  areaNama: string;
  signal: SignalTriase[];
}

export interface KelompokPeriode {
  periode: string;
  /** Periode ini masih berjalan menurut WIB — Signal-nya INDIKASI (AD-17). */
  berjalan: boolean;
  outlet: KelompokOutlet[];
}

export interface RingkasTriase {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  /** Berapa yang sudah dinyatakan dilihat orang. */
  diakui: number;
  outletTerdampak: number;
}

export interface PapanCommandCenter {
  /** Periode yang sedang dilihat, atau null bila seluruh periode ditampilkan. */
  periode: string | null;
  /** Bulan berjalan menurut WIB — acuan penanda MTD. */
  bulanBerjalan: string;
  /** Periode yang benar-benar punya Signal terbuka, terbaru lebih dulu. */
  periodeTersedia: string[];
  kelompok: KelompokPeriode[];
  korporat: SignalTriase[];
  /** Benar bila korporat memang ikut dibaca — supaya layar tidak menulis
   *  "tidak ada" untuk sesuatu yang tidak pernah ditanyakan. */
  korporatDibaca: boolean;
  ringkas: RingkasTriase;
}

interface Baris {
  id: number;
  cakupan: string;
  periode: string;
  outlet_id: string | null;
  kpi_definition_id: string;
  severity: string;
  operator: string;
  nilai_actual: number | string;
  nilai_ambang: number | string;
  nilai_ambang_2: number | string | null;
  status_kpi: string;
  terdeteksi_pada: string;
  nilai_terakhir: number | string | null;
  kondisi_terakhir: string;
  status_kpi_terakhir: string;
  diamati_pada: string;
  diakui_oleh: string | null;
  diakui_pada: string | null;
}

const KOLOM =
  "id,cakupan,periode,outlet_id,kpi_definition_id,severity,operator,nilai_actual,nilai_ambang," +
  "nilai_ambang_2,status_kpi,terdeteksi_pada,nilai_terakhir,kondisi_terakhir,status_kpi_terakhir," +
  "diamati_pada,diakui_oleh,diakui_pada";

const angka = (v: number | string | null): number | null => (v === null ? null : Number(v));

export interface MintaPapan {
  /** "YYYY-MM", atau null untuk seluruh periode yang masih terbuka. */
  periode: string | null;
  /** Outlet yang boleh dibaca orang ini — hasil `persempit()` di halaman. */
  outletIds: readonly string[];
  /** Hasil `canReachMenu()` di halaman. Lihat catatan kepala berkas. */
  sertakanKorporat: boolean;
  pada?: number;
}

/**
 * Daftar kerja Command Center.
 *
 * Yang DIKELUARKAN, beserta alasannya — sama persis dengan pembaca Weekly
 * supaya dua layar tidak pernah menjawab berbeda untuk Signal yang sama:
 *
 *   status = 'diabaikan'            sudah diputuskan orang untuk tidak
 *                                   ditindaklanjuti (Z-01 Q3)
 *   kondisi_terakhir ≠ pelanggaran  pengamatan terakhir menyatakan angkanya
 *                                   sudah tidak melanggar
 *   skala ≠ 'bulanan'               tidak ada Signal berskala lain, dan
 *                                   `signals` tidak menyimpan kapan di dalam
 *                                   bulan sebuah pelanggaran terjadi
 */
export async function papanCommandCenter(m: MintaPapan): Promise<PapanCommandCenter> {
  const pada = m.pada ?? Date.now();
  const bulanBerjalan = bulanIniWib(pada);
  if (m.periode !== null && !bulanSah(m.periode)) throw new Error(`periode tidak sah: ${m.periode}`);

  const kosong: PapanCommandCenter = {
    periode: m.periode,
    bulanBerjalan,
    periodeTersedia: [],
    kelompok: [],
    korporat: [],
    korporatDibaca: m.sertakanKorporat,
    ringkas: { total: 0, critical: 0, high: 0, medium: 0, low: 0, diakui: 0, outletTerdampak: 0 },
  };
  if (!dbEnabled) return kosong;

  const ids = [...new Set(m.outletIds)];
  const [barisOutlet, barisKorporat] = await Promise.all([
    ids.length === 0 ? Promise.resolve([] as Baris[]) : bacaOutlet(m.periode, ids),
    m.sertakanKorporat ? bacaKorporat(m.periode) : Promise.resolve([] as Baris[]),
  ]);

  const semua = [...barisOutlet, ...barisKorporat];
  const nama = petaNama();
  const triase = semua.map((r) => keTriase(r, nama));

  const korporat = triase.filter((s) => s.cakupan === "korporat").sort(urutSeverity);
  const outlet = triase.filter((s) => s.cakupan === "outlet");

  return {
    ...kosong,
    periodeTersedia: [...new Set(triase.map((s) => s.periode))].sort().reverse(),
    kelompok: kelompokkanSignal(outlet, bulanBerjalan),
    korporat,
    ringkas: ringkasSignal(triase, outlet),
  };
}

/* ─────────────────────────────── pembacaan ─────────────────────────────── */

function bacaOutlet(periode: string | null, ids: string[]): Promise<Baris[]> {
  return selectAll<Baris>("signals", (a, b) => {
    let q = db()
      .from("signals")
      .select(KOLOM)
      .eq("skala", SKALA_SIGNAL)
      .eq("cakupan", "outlet")
      .eq("status", "terbuka")
      .eq("kondisi_terakhir", "lewat_ambang")
      .in("outlet_id", ids);
    if (periode !== null) q = q.eq("periode", periode);
    return q.order("id").range(a, b);
  }).catch(() => [] as Baris[]);
}

function bacaKorporat(periode: string | null): Promise<Baris[]> {
  return selectAll<Baris>("signals", (a, b) => {
    let q = db()
      .from("signals")
      .select(KOLOM)
      .eq("skala", SKALA_SIGNAL)
      .eq("cakupan", "korporat")
      .eq("status", "terbuka")
      .eq("kondisi_terakhir", "lewat_ambang");
    if (periode !== null) q = q.eq("periode", periode);
    return q.order("id").range(a, b);
  }).catch(() => [] as Baris[]);
}

/* ─────────────────────────────── penyusunan ─────────────────────────────── */

interface PetaNama {
  outlet: Map<string, { nama: string; area: string }>;
  orang: Map<string, string>;
}

function petaNama(): PetaNama {
  const outlet = new Map<string, { nama: string; area: string }>();
  for (const o of getOutlets()) outlet.set(o.id, { nama: o.name, area: areaName(o.areaId) });
  const orang = new Map<string, string>();
  for (const u of getUsers()) orang.set(u.id, u.name);
  return { outlet, orang };
}

function keTriase(r: Baris, nama: PetaNama): SignalTriase {
  const o = r.outlet_id ? nama.outlet.get(r.outlet_id) : undefined;
  return {
    id: r.id,
    cakupan: r.cakupan === "korporat" ? "korporat" : "outlet",
    periode: r.periode,
    outletId: r.outlet_id,
    outletNama: o?.nama ?? r.outlet_id,
    areaNama: o?.area ?? null,
    kpiDefinitionId: r.kpi_definition_id,
    severity: r.severity,
    operator: r.operator,
    nilaiActual: Number(r.nilai_actual),
    nilaiAmbang: Number(r.nilai_ambang),
    nilaiAmbang2: angka(r.nilai_ambang_2),
    statusKpi: r.status_kpi,
    terdeteksiPada: r.terdeteksi_pada,
    nilaiTerakhir: angka(r.nilai_terakhir),
    kondisiTerakhir: r.kondisi_terakhir,
    statusKpiTerakhir: r.status_kpi_terakhir,
    diamatiPada: r.diamati_pada,
    diakuiOleh: r.diakui_oleh,
    // Nama yang tidak dikenal TIDAK diganti "—": id-nya tetap ditampilkan
    // supaya tetap bisa ditelusuri ke akun yang benar.
    diakuiNama: r.diakui_oleh ? (nama.orang.get(r.diakui_oleh) ?? r.diakui_oleh) : null,
    diakuiPada: r.diakui_pada,
  };
}

/**
 * PERIODE → OUTLET → Signal. Grain datanya tidak berubah; yang dikelompokkan
 * tampilannya (Z-01 Q6).
 *
 * MURNI dan diekspor — supaya urutan serta penanda MTD-nya bisa diuji tanpa
 * basis data. Urutan yang salah tidak pernah terlihat salah dari layar.
 */
export function kelompokkanSignal(outlet: SignalTriase[], bulanBerjalan: string): KelompokPeriode[] {
  const perPeriode = new Map<string, Map<string, SignalTriase[]>>();
  for (const s of outlet) {
    const kunci = s.outletId ?? "~tanpa-outlet";
    const p = perPeriode.get(s.periode) ?? new Map<string, SignalTriase[]>();
    p.set(kunci, [...(p.get(kunci) ?? []), s]);
    perPeriode.set(s.periode, p);
  }

  return [...perPeriode.entries()]
    // Terbaru lebih dulu: yang sedang berjalan yang paling mungkin bisa
    // ditindaklanjuti hari ini.
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([periode, perOutlet]) => ({
      periode,
      berjalan: periode === bulanBerjalan,
      outlet: [...perOutlet.entries()]
        .map(([outletId, daftar]) => ({
          outletId,
          outletNama: daftar[0].outletNama ?? outletId,
          areaNama: daftar[0].areaNama ?? "—",
          signal: [...daftar].sort(urutSeverity),
        }))
        // Yang paling berat lebih dulu, lalu yang paling banyak, lalu abjad —
        // supaya urutannya tidak berubah-ubah antar pemuatan.
        .sort(
          (a, b) =>
            beban(a.signal) - beban(b.signal) ||
            b.signal.length - a.signal.length ||
            a.outletNama.localeCompare(b.outletNama, "id"),
        ),
    }));
}

/** Severity terberat sebuah outlet, sebagai angka kecil = lebih berat. */
const beban = (daftar: SignalTriase[]): number =>
  daftar.reduce((n, s) => Math.min(n, ({ critical: 0, high: 1, medium: 2, low: 3 })[s.severity] ?? 9), 9);

/** MURNI dan diekspor — dasar seluruh angka di kepala layar. */
export function ringkasSignal(semua: SignalTriase[], outlet: SignalTriase[]): RingkasTriase {
  const cacah = (sev: string) => semua.filter((s) => s.severity === sev).length;
  return {
    total: semua.length,
    critical: cacah("critical"),
    high: cacah("high"),
    medium: cacah("medium"),
    low: cacah("low"),
    diakui: semua.filter((s) => s.diakuiOleh !== null).length,
    outletTerdampak: new Set(outlet.map((s) => s.outletId)).size,
  };
}
