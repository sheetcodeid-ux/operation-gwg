import "server-only";

import { db, dbEnabled } from "./db";
import { getOutlets } from "./store";
import { jumlahHari } from "@/lib/ops/harian";

/**
 * BERAPA BANYAK ANGKA DAILY YANG BELUM DITARIK.
 *
 * Daily membaca `seasonal_daily` — satu baris per cabang per tanggal, diisi
 * cron yang memanggil ESB satu kali untuk tiap pasangan itu. Selama pasangannya
 * belum ada, harinya kosong di layar dan ikut terhitung nol jualan ke dalam
 * "Bulan Ini" dan "Kurang".
 *
 * Berkas ini menjawab satu pertanyaan yang sebelumnya tidak bisa dijawab dari
 * mana pun di aplikasi: berapa yang kurang, dan karenanya seberapa jauh angka
 * di layar boleh dipercaya. Tanpa angka ini, satu-satunya cara mengetahuinya
 * adalah membuka basis data langsung.
 */

export interface KelengkapanDaily {
  /** Pasangan cabang×tanggal yang seharusnya ada sejak 1 Januari sampai hari ini. */
  wajib: number;
  /** Yang sudah ada. */
  ada: number;
  /** Yang belum — inilah sisa pekerjaan penarikan. */
  kurang: number;
  /** Persen lengkap, 0–100. */
  persen: number;
  /** Berapa cabang yang dihitung. */
  cabang: number;
  /** Bulan mana saja yang masih berlubang, terparah dulu. */
  bulan: { periode: string; ada: number; wajib: number }[];
}

const ymdWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Tiap bulan dari Januari sampai bulan berjalan, beserta jumlah harinya
 *  yang sudah lewat. */
function bulanSampaiKini(hariIni: string): { periode: string; hari: number }[] {
  const [th, bl, tg] = hariIni.split("-").map(Number);
  return Array.from({ length: bl }, (_, i) => {
    const periode = `${th}-${String(i + 1).padStart(2, "0")}`;
    return { periode, hari: i + 1 === bl ? tg : jumlahHari(periode) };
  });
}

export async function kelengkapanDaily(): Promise<KelengkapanDaily> {
  const hariIni = ymdWib();
  const cabang = [
    ...new Set(
      getOutlets()
        .filter((o) => o.active && !!o.esbBranchId)
        .map((o) => o.esbBranchId as string),
    ),
  ];
  const bulan = bulanSampaiKini(hariIni);
  const kosong: KelengkapanDaily = {
    wajib: 0, ada: 0, kurang: 0, persen: 100, cabang: cabang.length, bulan: [],
  };
  if (!dbEnabled || cabang.length === 0) return kosong;

  // DIHITUNG DI BASIS DATA, bukan ditarik lalu dihitung di sini: barisnya
  // belasan ribu, dan menariknya cuma untuk dihitung membuat halaman admin
  // memindahkan beberapa megabyte tiap kali dibuka.
  const perBulan = await Promise.all(
    bulan.map(async (b) => {
      const awal = `${b.periode}-01`;
      const akhir = `${b.periode}-${String(b.hari).padStart(2, "0")}`;
      const { count } = await db()
        .from("seasonal_daily")
        .select("day", { count: "exact", head: true })
        .in("branch", cabang)
        .gte("day", awal)
        .lte("day", akhir);
      return { periode: b.periode, ada: count ?? 0, wajib: cabang.length * b.hari };
    }),
  ).catch(() => null);
  if (!perBulan) return kosong;

  const wajib = perBulan.reduce((n, b) => n + b.wajib, 0);
  const ada = perBulan.reduce((n, b) => n + b.ada, 0);
  return {
    wajib,
    ada,
    kurang: Math.max(0, wajib - ada),
    persen: wajib > 0 ? (ada / wajib) * 100 : 100,
    cabang: cabang.length,
    // Terparah dulu — itu bulan yang paling perlu dikejar, dan biasanya bukan
    // bulan berjalan melainkan bulan-bulan lama yang tidak pernah tersentuh.
    bulan: perBulan
      .filter((b) => b.ada < b.wajib)
      .sort((x, y) => x.ada / x.wajib - y.ada / y.wajib),
  };
}
