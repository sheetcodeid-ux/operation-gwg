import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getOutlets, getUsers } from "./store";
import { targetBulananOutlet } from "./kpi";
import { barisHarian, jumlahHari, kolomHari, totalHarian, urutHarian, type BarisHarian, type HariKolom } from "@/lib/ops/harian";

/**
 * Penjualan harian per outlet — sumber tabel Daily.
 *
 * Angkanya BUKAN ditarik di sini. `seasonal_daily` sudah diisi cron ESB hari
 * demi hari per cabang; halaman ini membacanya. Menariknya sendiri saat halaman
 * dibuka berarti satu orang yang membuka tabel memicu enam puluh panggilan ESB
 * sekaligus — dan ESB melayani satu sesi per akun, jadi yang terjadi bukan
 * halaman yang lambat melainkan seluruh penarikan lain ikut gagal.
 *
 * Hari yang belum ditarik dibiarkan kosong, bukan nol. Lihat `barisHarian`.
 */

export interface DetailHarian {
  periode: string;
  kolom: HariKolom[];
  baris: BarisHarian[];
  /** Baris gabungan seluruh outlet yang ikut. Null bila tidak ada satu pun. */
  total: BarisHarian | null;
  /** Outlet yang belum dipasangkan ke cabang ESB — disebut, tidak didiamkan. */
  tanpaCabang: string[];
  /** Outlet yang belum genap tiga bulan, jadi belum punya target. */
  tanpaTarget: string[];
  /** Berapa hari bulan ini yang sudah lewat — pembagi kelengkapan data. */
  hariBerjalan: number;
  /**
   * Berapa pasangan outlet×tanggal yang sudah lewat tapi angkanya belum ada.
   *
   * Dipakai memberi tahu pembacanya bahwa angka di layar MASIH KURANG, bukan
   * sudah final. Selama ini lebih dari nol, "Bulan Ini" dan "Kurang" tiap
   * outlet menghitung hari yang belum ditarik sebagai nol jualan.
   */
  lubang: number;
  /** Berapa pasangan yang seharusnya ada. Nol kalau tidak ada outlet. */
  lubangDari: number;
}

/** Coordinator Area yang bisa dipilih — pengisi dropdown di halaman Daily. */
export interface PilihanArea {
  value: string;
  label: string;
  /** Berapa outlet yang dipegangnya — supaya yang memilih tahu isinya. */
  outlet: number;
}

/**
 * Seluruh Coordinator Area beserta jumlah outletnya.
 *
 * Yang belum dititipi satu outlet pun tetap ditampilkan, dengan angka nol di
 * sebelahnya: menyembunyikannya membuat penugasan yang terlupa tidak pernah
 * ketahuan dari mana pun.
 */
export function daftarArea(): PilihanArea[] {
  return getUsers()
    .filter((u) => u.role === "area_coordinator" && u.active !== false)
    .map((u) => ({ value: u.id, label: u.name, outlet: (u.outletIds ?? []).length }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/**
 * Berapa hari dari `periode` yang sudah lewat menurut jam Jakarta.
 *
 * Bulan yang sudah selesai: seluruh harinya. Bulan yang belum datang: nol.
 * Bulan berjalan: tanggal hari ini. Dipakai menghitung sisa hari mengejar
 * target — dan itu harus hari yang belum lewat, bukan hari yang datanya belum
 * masuk.
 */
function hariBerjalan(periode: string): number {
  const kini = new Date(Date.now() + 7 * 3_600_000);
  const sekarang = `${kini.getUTCFullYear()}-${String(kini.getUTCMonth() + 1).padStart(2, "0")}`;
  if (periode < sekarang) return jumlahHari(periode);
  if (periode > sekarang) return 0;
  return kini.getUTCDate();
}

/** Bulan sebelum `periode` ("2026-09" → "2026-08"). */
const bulanSebelum = (periode: string): string => {
  const [th, bl] = periode.split("-").map(Number);
  return bl === 1 ? `${th - 1}-12` : `${th}-${String(bl - 1).padStart(2, "0")}`;
};

interface Row {
  branch: string;
  day: string;
  net: number | string | null;
}

/** Penjualan per cabang per tanggal untuk satu bulan: "cabang|tanggal" → net. */
async function netHarian(periode: string, cabang: string[]): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  if (!dbEnabled || cabang.length === 0) return peta;
  const akhir = `${periode}-${String(jumlahHari(periode)).padStart(2, "0")}`;
  const rows = await selectAll<Row>("seasonal_daily", (a, b) =>
    db()
      .from("seasonal_daily")
      .select("branch,day,net")
      .in("branch", cabang)
      .gte("day", `${periode}-01`)
      .lte("day", akhir)
      .order("day")
      .range(a, b),
  ).catch(() => [] as Row[]);
  for (const r of rows) {
    const tanggal = Number(r.day.slice(8, 10));
    if (!tanggal) continue;
    peta.set(`${r.branch}|${tanggal}`, Number(r.net) || 0);
  }
  return peta;
}

/**
 * Tabel harian satu bulan.
 *
 * `outletIds` membatasi barisnya — dipakai membatasi Coordinator Area ke
 * outletnya sendiri. Batasnya DI SINI, bukan di komponen: baris yang disaring
 * di layar tetap terkirim ke peramban, dan siapa pun bisa membacanya.
 */
export async function harianOutlet(periode: string, outletIds?: readonly string[]): Promise<DetailHarian> {
  const kolom = kolomHari(periode);
  const boleh = outletIds ? new Set(outletIds) : null;

  // Siapa yang memegang outlet — keterangan di bawah nama outletnya.
  const pemegang = new Map<string, string>();
  for (const u of getUsers()) {
    if (u.role !== "area_coordinator" || u.active === false) continue;
    for (const id of u.outletIds ?? []) pemegang.set(id, u.name);
  }

  const outlet = getOutlets().filter((o) => o.active && (!boleh || boleh.has(o.id)));
  const tanpaCabang = outlet.filter((o) => !o.esbBranchId).map((o) => o.name);
  const dipakai = outlet.filter((o) => !!o.esbBranchId);
  const cabang = [...new Set(dipakai.map((o) => o.esbBranchId as string))];

  const berjalan = hariBerjalan(periode);
  const sebelum = bulanSebelum(periode);
  const [ini, lalu, target] = await Promise.all([
    netHarian(periode, cabang),
    netHarian(sebelum, cabang),
    targetBulananOutlet(periode),
  ]);
  const hariLalu = jumlahHari(sebelum);

  const baris = urutHarian(
    dipakai.map((o) => {
      const c = o.esbBranchId as string;
      return barisHarian({
        outletId: o.id,
        nama: o.name,
        area: pemegang.get(o.id) ?? "belum ditugaskan",
        hari: kolom.map((h) => ini.get(`${c}|${h.tanggal}`) ?? null),
        // Bulan lalu bisa lebih pendek (Februari) — tanggal yang tidak ada di
        // sana memang tidak ada, bukan nol.
        hariLalu: kolom.map((h) => (h.tanggal > hariLalu ? null : (lalu.get(`${c}|${h.tanggal}`) ?? null))),
        akhirBulanLalu: lalu.get(`${c}|${hariLalu}`) ?? null,
        targetBulan: target.get(o.id) ?? null,
        hariBerjalan: berjalan,
      });
    }),
  );

  return {
    periode,
    kolom,
    baris,
    total: totalHarian(baris),
    hariBerjalan: berjalan,
    lubang: baris.reduce((n, b) => n + b.lubang, 0),
    lubangDari: baris.length * Math.min(berjalan, kolom.length),
    tanpaCabang,
    tanpaTarget: baris.filter((b) => (b.targetBulan ?? null) === null).map((b) => b.nama),
  };
}
