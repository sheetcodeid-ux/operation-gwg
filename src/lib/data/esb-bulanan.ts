import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { esbConfigured, esbFetchHighlight, esbEnsureDeadline } from "@/lib/integrations/esb-client";

/**
 * Net sales SEBULAN per cabang — satu panggilan ESB per cabang per bulan.
 *
 * Sebelumnya angka ini dijumlahkan dari data harian per cabang, dan itu memaksa
 * 250 panggilan untuk satu cabang. Untuk 57 cabang berarti belasan ribu
 * panggilan dan berhari-hari menunggu — sementara selama itu Management Fee dan
 * budget Efisiensi berdiri di atas bulan yang baru separuh.
 *
 * Padahal keduanya tidak pernah membutuhkan rincian harian per outlet: yang
 * dipakai totalnya sebulan. Satu panggilan dengan rentang satu bulan memberi
 * angka itu utuh — 57 panggilan, bukan 14.250 — dan tidak ada lagi bulan yang
 * "baru separuh": barisnya ada berarti bulannya utuh.
 *
 * Data harian per cabang tetap ditarik seperti biasa untuk Data Analysis; yang
 * berubah cuma dari mana angka bulanan diambil.
 */

export interface NetBulanan {
  net: number;
  bills: number | null;
  pax: number | null;
  /** Tanggal terakhir yang ikut terhitung — untuk bulan berjalan belum sebulan penuh. */
  sampai: string;
  /** Kapan barisnya ditarik — dipakai menentukan apakah perlu ditarik ulang. */
  syncedAt: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const hariIniWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Tanggal terakhir bulan itu yang sudah lewat; kosong bila bulannya belum datang. */
export function akhirTerpakai(periode: string): string | null {
  const hariIni = hariIniWib();
  const [th, bl] = periode.split("-").map(Number);
  const akhir = `${periode}-${pad(new Date(Date.UTC(th, bl, 0)).getUTCDate())}`;
  if (hariIni < `${periode}-01`) return null;
  return hariIni < akhir ? hariIni : akhir;
}

interface Row {
  branch: string;
  periode: string;
  net: number | string;
  bills: number | null;
  pax: number | null;
  sampai: string;
  synced_at: string;
}

/** Angka bulanan seluruh cabang untuk satu bulan. Kosong = belum ditarik. */
export async function netBulananPerCabang(periode: string): Promise<Map<string, NetBulanan>> {
  const peta = new Map<string, NetBulanan>();
  if (!dbEnabled) return peta;
  const rows = await selectAll<Row>("esb_net_bulanan", (a, b) =>
    db().from("esb_net_bulanan").select("*").eq("periode", periode).order("branch").range(a, b),
  ).catch(() => [] as Row[]);
  for (const r of rows) {
    peta.set(r.branch, { net: Number(r.net) || 0, bills: r.bills, pax: r.pax, sampai: r.sampai, syncedAt: r.synced_at });
  }
  return peta;
}

/** Jeda sebelum bulan yang baru berakhir dianggap benar-benar final. */
const JEDA_FINAL_HARI = 2;

/**
 * Umur maksimal angka bulan BERJALAN sebelum ditarik ulang.
 *
 * Kalau hanya tanggalnya yang diperiksa, angka bulan berjalan cuma diperbarui
 * sekali sehari — penjualan hari ini baru terhitung besok, dan yang membuka
 * halamannya sore hari melihat angka pagi tanpa tahu itu angka pagi. Enam jam
 * membuatnya terasa hidup tanpa menembakkan 57 panggilan tiap jam ke ESB.
 */
const UMUR_SEGAR_MS = 6 * 60 * 60 * 1000;

/**
 * Seberapa lama satu baris boleh dipercaya.
 *
 * Bulan berjalan masih bertambah tiap hari, jadi ditarik ulang begitu tanggal
 * terakhirnya tertinggal — itu yang membuat angkanya ikut bergerak tiap hari.
 *
 * Bulan yang sudah lewat ditarik sekali lalu selesai; menariknya ulang tiap jam
 * membuang panggilan ESB untuk angka yang dijamin sama. SATU KECUALI: baris
 * yang ditarik tepat di hari terakhir bulan itu belum tentu memuat transaksi
 * yang masuk belakangan — tutup buku di lapangan tidak selesai pada pukul
 * 23.59. Karena itu baris seperti itu ditarik sekali lagi dua hari setelah
 * bulannya berakhir, dan sesudah itu tidak pernah disentuh lagi.
 */
function masihSegar(r: NetBulanan, periode: string, syncedAt: string): boolean {
  const akhir = akhirTerpakai(periode);
  if (akhir === null || r.sampai < akhir) return false;

  const hariIni = hariIniWib();
  const bulanSudahLewat = hariIni > akhir;
  // Bulan berjalan masih bertambah sepanjang hari, jadi tanggalnya saja tidak
  // cukup: yang menentukan seberapa lama angkanya sudah tersimpan.
  if (!bulanSudahLewat) return Date.now() - Date.parse(syncedAt) < UMUR_SEGAR_MS;

  const final = new Date(Date.parse(`${akhir}T00:00:00Z`) + JEDA_FINAL_HARI * 86_400_000)
    .toISOString()
    .slice(0, 10);
  // Ditarik sebelum tenggat itu berarti belum tentu memuat susulan; sekali lagi.
  return syncedAt.slice(0, 10) >= final || hariIni < final;
}

export interface HasilBulanan {
  ditarik: number;
  sisa: number;
  error?: string;
}

/**
 * Menarik angka bulanan yang belum ada / sudah tertinggal, sampai anggaran habis.
 *
 * Dikerjakan berurutan satu per satu: ESB melayani satu sesi per akun, dan
 * menembakkan puluhan permintaan sekaligus bukan mempercepat melainkan membuat
 * sebagiannya gagal tanpa pesan yang jelas.
 */
export async function syncNetBulanan(
  cabang: string[],
  bulan: string[],
  budgetMs = 45_000,
): Promise<HasilBulanan> {
  if (!dbEnabled || !esbConfigured()) return { ditarik: 0, sisa: 0 };

  const perlu: { cabang: string; periode: string }[] = [];
  for (const p of bulan) {
    const akhir = akhirTerpakai(p);
    if (!akhir) continue; // bulan yang belum datang
    const ada = await netBulananPerCabang(p);
    for (const c of cabang) {
      const r = ada.get(c);
      if (!r || !masihSegar(r, p, r.syncedAt)) perlu.push({ cabang: c, periode: p });
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
    const akhir = akhirTerpakai(t.periode);
    if (!akhir) continue;
    try {
      const h = await esbFetchHighlight(`${t.periode}-01`, akhir, t.cabang);
      const up = await db().from("esb_net_bulanan").upsert({
        branch: t.cabang,
        periode: t.periode,
        net: h.net,
        bills: h.bills,
        pax: h.pax,
        sampai: akhir,
        synced_at: new Date().toISOString(),
      });
      if (up.error) throw new Error(up.error.message);
      ditarik += 1;
      gagal = 0;
    } catch (e) {
      // ESB menolak sebentar setelah puluhan permintaan beruntun — terlihat
      // sebagai "respons tidak terbaca", bukan sebagai pesan yang jelas. Yang
      // benar bukan menyerah, melainkan menunggu sejenak: tanpa jeda, lima
      // kegagalan berturut-turut datang dalam dua detik dan seluruh sisa
      // anggaran waktu terbuang percuma.
      error = e instanceof Error ? e.message : "Gagal memuat data ESB.";
      gagal += 1;
      if (gagal >= 5) break;
      await new Promise((r) => setTimeout(r, gagal * 1_500));
    }
  }
  return { ditarik, sisa: perlu.length - ditarik, error };
}

/** Cabang ESB yang benar-benar dipakai outlet aktif — itu saja yang perlu ditarik. */
export async function cabangTerpasang(): Promise<string[]> {
  if (!dbEnabled) return [];
  const { data } = await db().from("outlets").select("esb_branch_id").not("esb_branch_id", "is", null);
  const set = new Set<string>();
  for (const r of ((data ?? []) as { esb_branch_id: string | null }[])) if (r.esb_branch_id) set.add(r.esb_branch_id);
  return [...set].sort();
}

/** Bulan yang dipakai KPI: bulan berjalan plus `mundur` bulan sebelumnya. */
export function bulanTerakhir(mundur = 3, dari = hariIniWib().slice(0, 7)): string[] {
  const out: string[] = [];
  let [th, bl] = dari.split("-").map(Number);
  for (let i = 0; i <= mundur; i += 1) {
    out.push(`${th}-${pad(bl)}`);
    bl -= 1;
    if (bl === 0) { bl = 12; th -= 1; }
  }
  return out;
}
