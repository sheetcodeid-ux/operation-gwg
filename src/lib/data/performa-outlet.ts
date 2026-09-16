import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getOutlets, getUsers } from "./store";
import { targetBulananOutlet } from "./kpi";
import { barisHarian, totalHarian, urutHarian, type BarisHarian } from "@/lib/ops/harian";
import { jendela, jendelaSebelum, type Jendela, type Skala } from "@/lib/ops/periode";
import type { DetailHarian } from "./daily-outlet";

/**
 * Penjualan per outlet pada SEMBARANG skala — Weekly, Monthly, Quarterly,
 * Yearly.
 *
 * Bentuk hasilnya sama persis dengan Daily (`DetailHarian`), dan itu disengaja:
 * tabelnya satu, jadi kelima halaman tidak bisa diam-diam berbeda tampilan atau
 * perhitungan. Yang membedakan cuma pengelompokan kolomnya, dan itu seluruhnya
 * diputuskan `src/lib/ops/periode.ts`.
 *
 * DAILY TIDAK MEMAKAI BERKAS INI. Halaman Daily tetap berjalan di atas
 * `harianOutlet` yang sudah terbukti; yang menjaga keduanya tidak menyimpang
 * adalah satu uji yang membandingkan hasil keduanya pada skala harian
 * (`performa-outlet.test.ts`), bukan janji bahwa keduanya mirip.
 */

interface Row {
  branch: string;
  day: string;
  net: number | string | null;
}

/** Net per cabang per tanggal pada satu rentang: "cabang|YYYY-MM-DD" → net. */
async function netRentang(dari: string, sampai: string, cabang: string[]): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  if (!dbEnabled || cabang.length === 0) return peta;
  const rows = await selectAll<Row>("seasonal_daily", (a, b) =>
    db()
      .from("seasonal_daily")
      .select("branch,day,net")
      .in("branch", cabang)
      .gte("day", dari)
      .lte("day", sampai)
      .order("day")
      .order("branch")
      .range(a, b),
  ).catch(() => [] as Row[]);
  for (const r of rows) peta.set(`${r.branch}|${r.day}`, Number(r.net) || 0);
  return peta;
}

/**
 * Jumlah tiap ember untuk satu cabang.
 *
 * NULL BUKAN NOL, dan pembedaan itu yang paling menentukan di sini. Satu ember
 * baru punya angka kalau SETIDAKNYA SATU harinya sudah ditarik; ember yang
 * seluruh harinya belum ditarik dibiarkan kosong. Menjumlahkannya jadi nol
 * membuat minggu yang datanya belum masuk terbaca sebagai minggu tanpa jualan —
 * dan di kolom Kurang, itu selisih puluhan juta yang tidak pernah terjadi.
 */
function jumlahEmber(j: Jendela, cabang: string, net: Map<string, number>): (number | null)[] {
  return j.ember.map((e) => {
    let total = 0;
    let ada = false;
    for (const hari of hariAntara(e.dari, e.sampai)) {
      const v = net.get(`${cabang}|${hari}`);
      if (v === undefined) continue;
      total += v;
      ada = true;
    }
    return ada ? total : null;
  });
}

/** Setiap "YYYY-MM-DD" dari `dari` sampai `sampai`, termasuk keduanya. */
function hariAntara(dari: string, sampai: string): string[] {
  const out: string[] = [];
  const d = new Date(`${dari}T00:00:00Z`);
  const akhir = new Date(`${sampai}T00:00:00Z`);
  while (d <= akhir && out.length < 2_000) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Target seluruh jendela: jumlah target bulanan tiap bulan di dalamnya.
 *
 * Target di GWG ditetapkan PER BULAN — rata-rata tiga bulan terakhir ditambah
 * pertumbuhan. Tidak ada target mingguan, kuartalan, atau tahunan yang berdiri
 * sendiri, jadi yang benar bukan mengarang rumus baru melainkan menjumlahkan
 * yang sudah ada. Dengan begitu satu outlet tidak pernah terbaca tercapai di
 * halaman Quarterly tapi gagal di tiga halaman Monthly yang menyusunnya.
 *
 * Outlet yang belum genap tiga bulan tidak punya target pada bulan itu, dan
 * bulan tanpa target dilewati — bukan dihitung nol.
 */
async function targetJendela(bulan: readonly string[]): Promise<Map<string, number>> {
  const tiap = await Promise.all(bulan.map((b) => targetBulananOutlet(b)));
  const out = new Map<string, number>();
  for (const peta of tiap) {
    for (const [id, v] of peta) out.set(id, (out.get(id) ?? 0) + v);
  }
  return out;
}

export async function performaOutlet(
  skala: Skala,
  acuan: string,
  outletIds?: readonly string[],
): Promise<DetailHarian> {
  const j = jendela(skala, acuan);
  const lalu = jendelaSebelum(j);
  const boleh = outletIds ? new Set(outletIds) : null;

  const pemegang = new Map<string, string>();
  for (const u of getUsers()) {
    if (u.role !== "area_coordinator" || u.active === false) continue;
    for (const id of u.outletIds ?? []) pemegang.set(id, u.name);
  }

  const outlet = getOutlets().filter((o) => o.active && (!boleh || boleh.has(o.id)));
  const tanpaCabang = outlet.filter((o) => !o.esbBranchId).map((o) => o.name);
  const dipakai = outlet.filter((o) => !!o.esbBranchId);
  const cabang = [...new Set(dipakai.map((o) => o.esbBranchId as string))];

  const [netIni, netLalu, target] = await Promise.all([
    netRentang(j.dari, j.sampai, cabang),
    netRentang(lalu.dari, lalu.sampai, cabang),
    targetJendela(j.bulan),
  ]);

  const baris: BarisHarian[] = urutHarian(
    dipakai.map((o) => {
      const c = o.esbBranchId as string;
      const emberLalu = jumlahEmber(lalu, c, netLalu);
      return barisHarian({
        outletId: o.id,
        nama: o.name,
        area: pemegang.get(o.id) ?? "belum ditugaskan",
        hari: jumlahEmber(j, c, netIni),
        // Jendela sebelumnya bisa punya kolom lebih sedikit (Februari cuma
        // empat minggu penuh). Kolom yang tidak ada di sana memang tidak ada.
        hariLalu: j.ember.map((_, i) => emberLalu[i] ?? null),
        akhirBulanLalu: emberLalu.length ? (emberLalu[emberLalu.length - 1] ?? null) : null,
        targetBulan: target.get(o.id) ?? null,
        hariBerjalan: j.berjalan,
      });
    }),
  );

  return {
    periode: j.acuan,
    kolom: j.ember.map((e) => e.kolom),
    baris,
    total: totalHarian(baris),
    hariBerjalan: j.berjalan,
    lubang: baris.reduce((n, b) => n + b.lubang, 0),
    lubangDari: baris.length * Math.min(j.berjalan, j.ember.length),
    tanpaCabang,
    tanpaTarget: baris.filter((b) => (b.targetBulan ?? null) === null).map((b) => b.nama),
  };
}
