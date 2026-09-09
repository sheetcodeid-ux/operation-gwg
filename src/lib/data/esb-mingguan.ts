import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { esbConfigured, esbFetchHighlight, esbEnsureDeadline } from "@/lib/integrations/esb-client";
import { hariBulan, mingguBulan, tanggalMinggu, type RentangMinggu } from "@/lib/kpi/minggu";

/**
 * Net sales PER MINGGU per cabang — satu panggilan ESB per cabang per minggu.
 *
 * Sebulan berarti lima panggilan per cabang; 60 cabang = 300 panggilan sebulan.
 * Jalur harian per cabang butuh 1.800 untuk angka yang sama, dan itulah sebabnya
 * ia diisi bergiliran satu cabang per jalannya cron dan selalu tertinggal
 * puluhan outlet. Rincian mingguan tidak boleh menunggu giliran seperti itu:
 * outlet yang barisnya belum ditarik akan terbaca sebagai outlet yang tidak
 * berjualan, dan itu kesalahan yang paling mahal di halaman KPI.
 *
 * Minggu yang sudah lewat ditarik SEKALI lalu selesai. Yang ditarik ulang hanya
 * minggu berjalan — satu-satunya yang angkanya masih bertambah.
 */

export interface NetMinggu {
  net: number;
  bills: number | null;
  pax: number | null;
  /** Tanggal terakhir yang ikut terhitung — minggu berjalan belum penuh. */
  sampai: string;
  syncedAt: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hariIniWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Tanggal terakhir minggu itu yang sudah lewat; null bila minggunya belum
 * datang sama sekali.
 */
export function akhirMinggu(periode: string, m: RentangMinggu): string | null {
  const { dari, sampai } = tanggalMinggu(periode, m);
  const hariIni = hariIniWib();
  if (hariIni < dari) return null;
  return hariIni < sampai ? hariIni : sampai;
}

interface Row {
  branch: string;
  periode: string;
  minggu: number;
  net: number | string;
  bills: number | null;
  pax: number | null;
  sampai: string;
  synced_at: string;
}

/**
 * Angka mingguan seluruh cabang untuk satu bulan.
 *
 * Kuncinya `"<branch>|<minggu>"` — satu peta, bukan peta di dalam peta: yang
 * membacanya selalu tahu cabang DAN mingguya, dan peta bersarang hanya
 * menambah satu pemeriksaan kosong di tiap pemanggil.
 */
export async function netMingguanPerCabang(periode: string): Promise<Map<string, NetMinggu>> {
  const peta = new Map<string, NetMinggu>();
  if (!dbEnabled) return peta;
  const rows = await selectAll<Row>("esb_net_mingguan", (a, b) =>
    db().from("esb_net_mingguan").select("*").eq("periode", periode).order("branch").range(a, b),
  ).catch(() => [] as Row[]);
  for (const r of rows) {
    peta.set(`${r.branch}|${r.minggu}`, {
      net: Number(r.net) || 0,
      bills: r.bills,
      pax: r.pax,
      sampai: r.sampai,
      syncedAt: r.synced_at,
    });
  }
  return peta;
}

/** Jeda sebelum minggu yang baru berakhir dianggap benar-benar final. */
const JEDA_FINAL_HARI = 2;

/**
 * Umur maksimal angka minggu BERJALAN sebelum ditarik ulang.
 *
 * Sama alasannya dengan angka bulanan: kalau hanya tanggalnya yang diperiksa,
 * minggu berjalan cuma diperbarui sekali sehari dan yang membukanya sore hari
 * melihat angka pagi tanpa tahu itu angka pagi.
 */
const UMUR_SEGAR_MS = 6 * 60 * 60 * 1000;

/** Apakah satu baris masih boleh dipercaya tanpa ditarik ulang. */
function masihSegar(r: NetMinggu, periode: string, m: RentangMinggu): boolean {
  const akhir = akhirMinggu(periode, m);
  if (akhir === null || r.sampai < akhir) return false;

  const hariIni = hariIniWib();
  const sudahLewat = hariIni > akhir;
  if (!sudahLewat) return Date.now() - Date.parse(r.syncedAt) < UMUR_SEGAR_MS;

  // Ditarik tepat di hari terakhir minggu itu belum tentu memuat transaksi yang
  // masuk belakangan — tutup buku di lapangan tidak selesai pukul 23.59. Sekali
  // lagi dua hari sesudahnya, lalu tidak pernah disentuh.
  const final = new Date(Date.parse(`${akhir}T00:00:00Z`) + JEDA_FINAL_HARI * 86_400_000).toISOString().slice(0, 10);
  return r.syncedAt.slice(0, 10) >= final || hariIni < final;
}

export interface HasilMingguan {
  ditarik: number;
  sisa: number;
  error?: string;
}

/**
 * Menarik minggu yang belum ada / sudah tertinggal sampai anggaran waktu habis.
 *
 * URUTANNYA MINGGU DULU, BARU CABANG. Kalau diurut per cabang, satu jalannya
 * cron menyelesaikan lima minggu satu cabang lalu berhenti, dan halamannya
 * memperlihatkan satu outlet lengkap di antara 59 outlet kosong. Diurut per
 * minggu, minggu ke-1 selesai untuk SELURUH cabang lebih dulu — tabelnya
 * terbaca utuh sejak jalan pertama, cuma belum sampai minggu terakhir.
 *
 * Dikerjakan berurutan satu per satu: ESB melayani satu sesi per akun, dan
 * menembakkan puluhan permintaan sekaligus bukan mempercepat melainkan membuat
 * sebagiannya gagal tanpa pesan yang jelas.
 */
export async function syncNetMingguan(cabang: string[], periode: string, budgetMs = 45_000): Promise<HasilMingguan> {
  if (!dbEnabled || !esbConfigured()) return { ditarik: 0, sisa: 0 };

  const minggu = mingguBulan(periode);
  const ada = await netMingguanPerCabang(periode);
  const perlu: { cabang: string; m: RentangMinggu }[] = [];
  for (const m of minggu) {
    if (akhirMinggu(periode, m) === null) continue; // mingguanya belum datang
    for (const c of cabang) {
      const r = ada.get(`${c}|${m.minggu}`);
      if (!r || !masihSegar(r, periode, m)) perlu.push({ cabang: c, m });
    }
  }
  if (perlu.length === 0) return { ditarik: 0, sisa: 0 };

  const mulai = Date.now();
  esbEnsureDeadline(budgetMs);
  let ditarik = 0;
  let gagal = 0;
  let error: string | undefined;

  for (const t of perlu) {
    if (ditarik > 0 && Date.now() - mulai > budgetMs) break;
    const akhir = akhirMinggu(periode, t.m);
    if (akhir === null) continue;
    const { dari } = tanggalMinggu(periode, t.m);
    try {
      const h = await esbFetchHighlight(dari, akhir, t.cabang);
      const up = await db().from("esb_net_mingguan").upsert({
        branch: t.cabang,
        periode,
        minggu: t.m.minggu,
        net: h.net,
        bills: h.bills,
        pax: h.pax,
        dari,
        sampai: akhir,
        synced_at: new Date().toISOString(),
      });
      if (up.error) throw new Error(up.error.message);
      ditarik += 1;
      gagal = 0;
    } catch (e) {
      // ESB menolak sebentar setelah puluhan permintaan beruntun, dan bentuknya
      // bukan pesan yang jelas melainkan balasan yang tidak bisa diuraikan.
      // Menunggu sejenak sebelum mencoba lagi: tanpa jeda, lima kegagalan
      // berturut-turut datang dalam dua detik dan sisa anggarannya terbuang.
      error = e instanceof Error ? e.message : "Gagal memuat data ESB.";
      gagal += 1;
      if (gagal >= 5) break;
      await new Promise((r) => setTimeout(r, gagal * 1_500));
    }
  }

  return { ditarik, sisa: perlu.length - ditarik, error };
}

/**
 * Berapa hari minggu itu yang sudah ikut terhitung pada satu baris.
 *
 * Dipakai membedakan minggu yang MEMANG sepi dari minggu yang baru berjalan
 * dua hari — keduanya berangka kecil, tapi hanya yang pertama layak dibaca
 * sebagai kegagalan.
 */
export function hariTerhitung(periode: string, m: RentangMinggu, sampai: string | null): number {
  if (!sampai) return 0;
  const { dari } = tanggalMinggu(periode, m);
  if (sampai < dari) return 0;
  const tgl = Number(sampai.slice(8, 10));
  return Math.min(m.hari, Math.max(0, tgl - m.dari + 1));
}

/** Jumlah hari periode itu — dipakai bersama pembagian mingguannya. */
export const hariPeriode = (periode: string): number => hariBulan(periode);

/** Nama berkas/urutan minggu untuk keperluan tampilan. */
export const labelMinggu = (m: RentangMinggu): string => `M${m.minggu}`;

/** Rentang tanggal minggu dalam bentuk "1–7". */
export const rentangMinggu = (m: RentangMinggu): string => `${m.dari}–${m.sampai}`;

/** Awal minggu sebagai "YYYY-MM-DD" — dipakai penarik dan pembaca yang sama. */
export const awalMinggu = (periode: string, m: RentangMinggu): string => `${periode}-${pad(m.dari)}`;
