import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { bulanSah } from "@/lib/ops/waktu";

/**
 * PEMBACA SIGNAL — satu-satunya, dan ia hanya membaca.
 *
 * `src/lib/data/signals.ts` MENULIS Signal; berkas ini membacanya kembali.
 * Dipisah dengan sengaja: penulis menyusun muatan RPC dan menggeser watermark,
 * pembaca cuma menjawab pertanyaan layar. Menggabungkannya berarti satu berkas
 * yang berubah tiap kali salah satu dari dua alasan itu berubah.
 *
 * ┌─ SKALA DIKUNCI `bulanan`, DAN ITU BUKAN SEKADAR FILTER ──────────────────┐
 * │                                                                          │
 * │ Seluruh 341 Signal produksi berskala `bulanan` (M-02). Fungsi di sini    │
 * │ TIDAK menerima parameter minggu, tidak menerima parameter skala, dan     │
 * │ tidak punya jalan untuk mengembalikan Signal per minggu — supaya         │
 * │ `weekly_signal_count` tidak bisa ditulis siapa pun tanpa lebih dulu      │
 * │ mengubah berkas ini dan gagal di ujinya.                                 │
 * │                                                                          │
 * │ Alasannya bukan selera: tabel `signals` menyimpan `periode` (bulan) dan  │
 * │ `diamati_pada` (waktu cron berjalan). Tidak ada satu kolom pun yang      │
 * │ menyatakan KAPAN pelanggaran itu terjadi di dalam bulan. Menempelkannya  │
 * │ ke minggu berarti mengarang informasi yang tidak pernah ada.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Satu Signal bulanan, sebagaimana dibutuhkan layar. */
export interface SignalBulanan {
  id: number;
  /** "YYYY-MM" — WAJIB ikut ditampilkan sebagai label periode. */
  periode: string;
  outletId: string;
  kpiDefinitionId: string;
  nilaiActual: number;
  nilaiAmbang: number;
  nilaiAmbang2: number | null;
  operator: string;
  severity: string;
  statusKpi: string;
  /** Keadaan pengamatan TERAKHIR — inilah yang membedakan memburuk dari membaik. */
  nilaiTerakhir: number | null;
  kondisiTerakhir: string;
  statusKpiTerakhir: string;
  terdeteksiPada: string;
  diamatiPada: string;
}

interface Baris {
  id: number;
  periode: string;
  outlet_id: string | null;
  kpi_definition_id: string;
  nilai_actual: number | string;
  nilai_ambang: number | string;
  nilai_ambang_2: number | string | null;
  operator: string;
  severity: string;
  status_kpi: string;
  nilai_terakhir: number | string | null;
  kondisi_terakhir: string;
  status_kpi_terakhir: string;
  terdeteksi_pada: string;
  diamati_pada: string;
}

const angka = (v: number | string | null): number | null => (v === null ? null : Number(v));

/** Skala yang boleh dibaca fungsi ini. Satu, dan tidak bisa ditimpa pemanggil. */
export const SKALA_SIGNAL = "bulanan" as const;

/**
 * Signal bulanan TERBUKA per outlet untuk satu periode.
 *
 * Hasilnya `outletId → Signal[]`, urut severity paling berat lebih dulu.
 *
 * Yang DIKELUARKAN, beserta alasannya:
 *
 *   status = 'diabaikan'          sudah diputuskan orang untuk tidak
 *                                 ditindaklanjuti — menampilkannya sebagai
 *                                 konteks aktif menghidupkan kembali keputusan
 *                                 yang sudah diambil
 *   kondisi_terakhir ≠ pelanggaran  pengamatan terakhir menyatakan angkanya
 *                                 sudah tidak melanggar; Signal-nya tetap ada
 *                                 di basis data sebagai riwayat, tapi ia bukan
 *                                 konteks yang sedang berjalan
 *   cakupan ≠ 'outlet'            halaman ini per outlet; Signal area dan
 *                                 korporat punya alamatnya sendiri
 */
export async function signalBulananOutlet(
  periode: string,
  outletIds: readonly string[],
): Promise<Map<string, SignalBulanan[]>> {
  const peta = new Map<string, SignalBulanan[]>();
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  if (!dbEnabled || outletIds.length === 0) return peta;

  const ids = [...outletIds];
  const rows = await selectAll<Baris>("signals", (a, b) =>
    db()
      .from("signals")
      .select(
        "id,periode,outlet_id,kpi_definition_id,nilai_actual,nilai_ambang,nilai_ambang_2,operator,severity,status_kpi,nilai_terakhir,kondisi_terakhir,status_kpi_terakhir,terdeteksi_pada,diamati_pada",
      )
      .eq("periode", periode)
      .eq("skala", SKALA_SIGNAL)
      .eq("cakupan", "outlet")
      .eq("status", "terbuka")
      .eq("kondisi_terakhir", "lewat_ambang")
      .in("outlet_id", ids)
      .order("id")
      .range(a, b),
  ).catch(() => [] as Baris[]);

  for (const r of rows) {
    if (!r.outlet_id) continue; // constraint sudah menjaminnya, tapi tipenya tetap nullable
    const daftar = peta.get(r.outlet_id) ?? [];
    daftar.push({
      id: r.id,
      periode: r.periode,
      outletId: r.outlet_id,
      kpiDefinitionId: r.kpi_definition_id,
      nilaiActual: Number(r.nilai_actual),
      nilaiAmbang: Number(r.nilai_ambang),
      nilaiAmbang2: angka(r.nilai_ambang_2),
      operator: r.operator,
      severity: r.severity,
      statusKpi: r.status_kpi,
      nilaiTerakhir: angka(r.nilai_terakhir),
      kondisiTerakhir: r.kondisi_terakhir,
      statusKpiTerakhir: r.status_kpi_terakhir,
      terdeteksiPada: r.terdeteksi_pada,
      diamatiPada: r.diamati_pada,
    });
    peta.set(r.outlet_id, daftar);
  }

  for (const daftar of peta.values()) daftar.sort(urutSeverity);
  return peta;
}

/** Paling berat lebih dulu; yang setara diurut KPI supaya tampilannya stabil. */
const BOBOT: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const urutSeverity = (a: SignalBulanan, b: SignalBulanan): number =>
  (BOBOT[a.severity] ?? 9) - (BOBOT[b.severity] ?? 9) || a.kpiDefinitionId.localeCompare(b.kpiDefinitionId);

/** Cacah per severity — untuk lencana ringkas di layar. Tetap per BULAN. */
export function cacahSeverity(daftar: readonly SignalBulanan[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const s of daftar) h[s.severity] = (h[s.severity] ?? 0) + 1;
  return h;
}
