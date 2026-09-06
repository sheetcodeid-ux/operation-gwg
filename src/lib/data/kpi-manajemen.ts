import "server-only";

import { db, dbEnabled } from "./db";
import { getOutlets } from "./store";
import { netBulananPerCabang } from "./esb-bulanan";
import { bulanMulaiBerjalan, bulanSebelum, grossDiketik, laporanKpi } from "./kpi";
import { POSISI } from "@/lib/kpi/struktur";
import { SEMUA_PIC } from "@/lib/kpi/semua-pic";
import { hitungManajemen, type DivisiKpi, type OutletManajemen, type SkorManajemen } from "@/lib/kpi/manajemen";
import type { LaluIndikator } from "@/components/kpi/kpi-charts";

/**
 * Bahan Kalkulator KPI Manajemen untuk satu bulan.
 *
 * PRD-nya menggambarkan alat hitung yang seluruh angkanya diketik tangan —
 * memang begitu bentuk aslinya, sebuah halaman lepas tanpa basis data. Di sini
 * tiga dari empat komponennya SUDAH punya sumbernya: omzet korporat dan
 * penjualan tiap outlet datang dari ESB, laba bersih dari isian bulanan
 * Coordinator Area. Menyuruh orang mengetik ulang angka yang sudah ada di
 * basis data yang sama bukan cuma membuang waktu; ia menciptakan versi kedua
 * dari angka yang sama, dan versi kedua itu selalu yang berbeda.
 *
 * Yang tetap diketik hanya nilai KPI tiap divisi — sebagian divisi belum punya
 * modul KPI-nya sendiri, jadi angkanya memang tidak ada di mana pun.
 */

export interface DetailManajemen {
  periode: string;
  skor: SkorManajemen;
  /** Bulan pembanding komponen A, urut dari yang paling lama. */
  bulanA: [string, string, string];
  /** Omzet korporat tiga bulan itu, urut sama dengan `bulanA`. */
  omzetLalu: [number, number, number];
  /** Divisi yang nilainya datang dari modul KPI, bukan diketik. */
  divisiOtomatis: string[];
  labaBersih: number;
  salesManual: number | null;
  catatan: string;
  /** Outlet yang umurnya belum diketahui — tidak bisa dinilai same store. */
  tanpaUmur: string[];
  /** Capaian bulan lalu per komponen — bahan grafik pembanding. */
  lalu: Record<string, LaluIndikator>;
}

const angka = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

/** Tiga bulan sebelum `periode`, urut dari yang paling lama. */
function tigaBulan(periode: string): [string, string, string] {
  const a = bulanSebelum(periode);
  const b = bulanSebelum(a);
  return [bulanSebelum(b), b, a];
}

/**
 * Umur outlet dalam bulan pada akhir `periode`.
 *
 * Dihitung dari bulan pertama outlet benar-benar berjalan — aturan tanggal 15
 * yang sama dengan KPI Coordinator Area, supaya satu outlet tidak pernah
 * dianggap "sudah tiga bulan" di satu halaman dan "belum" di halaman lain.
 * Null bila tanggal bukanya belum diisi; menebaknya akan memasukkan outlet
 * baru ke same-store atau mengeluarkan outlet lama, dan dua-duanya salah tanpa
 * terlihat salah.
 */
export function umurBulan(bukaTanggal: string | null, periode: string): number | null {
  const mulai = bulanMulaiBerjalan(bukaTanggal);
  if (!mulai) return null;
  const [tm, bm] = mulai.split("-").map(Number);
  const [tp, bp] = periode.split("-").map(Number);
  return (tp - tm) * 12 + (bp - bm);
}

interface BarisManajemen {
  divisi: DivisiKpi[];
  labaBersih: number | null;
  salesManual: number | null;
  catatan: string;
}

async function isianManajemen(periode: string): Promise<BarisManajemen> {
  const kosong: BarisManajemen = { divisi: [], labaBersih: null, salesManual: null, catatan: "" };
  if (!dbEnabled) return kosong;
  const { data } = await db()
    .from("kpi_manajemen")
    .select("divisi,laba_bersih,sales_manual,catatan")
    .eq("periode", periode)
    .maybeSingle();
  if (!data) return kosong;
  return {
    divisi: ((data.divisi as DivisiKpi[]) ?? []).map((d) => ({ nama: String(d.nama ?? ""), nilai: angka(d.nilai) })),
    labaBersih: data.laba_bersih === null || data.laba_bersih === undefined ? null : angka(data.laba_bersih),
    salesManual: data.sales_manual === null || data.sales_manual === undefined ? null : angka(data.sales_manual),
    catatan: String(data.catatan ?? ""),
  };
}

/** Laba bersih seluruh outlet yang ikut same store, dari isian bulanan. */
async function labaBersihOutlet(periode: string, outletIds: string[]): Promise<number | null> {
  if (!dbEnabled || outletIds.length === 0) return null;
  const { data } = await db()
    .from("kpi_outlet_bulanan")
    .select("outlet_id,net_profit")
    .eq("periode", periode)
    .in("outlet_id", outletIds);
  const rows = (data ?? []).filter((r) => r.net_profit !== null && r.net_profit !== undefined);
  // Tidak ada satu pun yang diisi BUKAN berarti labanya nol.
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + angka(r.net_profit), 0);
}

/**
 * Nilai KPI tiap posisi yang modulnya sudah ada, sebagai bahan komponen D.
 *
 * Yang dipakai `skorSetara` — skor yang diskalakan ke 100 dengan hanya
 * menghitung indikator yang ada datanya. Memakai skor mentah membuat posisi
 * yang satu indikatornya belum terukur selalu tampak lebih buruk daripada yang
 * lengkap, dan rata-rata seluruh divisi ikut tertarik turun tiap bulan.
 */
async function skorPosisi(periode: string): Promise<Map<string, number>> {
  const hasil = new Map<string, number>();
  // Satu posisi yang gagal dibaca TIDAK boleh menjatuhkan seluruh halaman —
  // tiga komponen lainnya tetap bisa dihitung tanpa dia.
  const laporan = await Promise.all(
    POSISI.map((p) => laporanKpi(p.kode, periode, p.perPic ? SEMUA_PIC : "").catch(() => null)),
  );
  laporan.forEach((l, i) => {
    const nilai = l?.ringkas.skorSetara ?? null;
    if (nilai !== null) hasil.set(POSISI[i].nama, Math.round(nilai * 100) / 100);
  });
  return hasil;
}

/**
 * Capaian bulan lalu, untuk grafik pembanding.
 *
 * Dihitung TANPA memanggil ulang KPI tiap posisi — komponen D bulan lalu
 * diambil dari isian yang tersimpan saja. Menghitung ulang sebelas laporan
 * posisi hanya demi satu garis pembanding membuat halaman ini menunggu dua
 * kali lebih lama setiap dibuka.
 */
async function capaianLalu(periode: string): Promise<Record<string, LaluIndikator>> {
  const d = await detailManajemen(bulanSebelum(periode), { ringan: true }).catch(() => null);
  if (!d) return {};
  const { skor } = d;
  return {
    a: { persen: skor.a.capaian * 100, actual: skor.a.actual },
    b: { persen: skor.b.capaian * 100, actual: skor.b.actual },
    c: { persen: skor.c.capaian * 100, actual: skor.c.margin },
    d: { persen: skor.d.rata, actual: skor.d.rata },
  };
}

export async function detailManajemen(
  periode: string,
  opsi: { ringan?: boolean } = {},
): Promise<DetailManajemen> {
  const bulanA = tigaBulan(periode);
  const [esbIni, ...esbLalu] = await Promise.all([
    netBulananPerCabang(periode),
    ...bulanA.map((b) => netBulananPerCabang(b)),
  ]);

  const outletAktif = getOutlets().filter((o) => o.active);
  const jual = (peta: Map<string, { net: number }>, branch: string | null | undefined) =>
    branch ? (peta.get(branch)?.net ?? 0) : 0;

  // Omzet korporat = jumlah SELURUH cabang, termasuk outlet baru. Same store
  // punya aturannya sendiri di komponen B; mencampurnya di sini membuat
  // pertumbuhan korporat ikut menghukum pembukaan outlet baru.
  const korporat = (peta: Map<string, { net: number }>) =>
    outletAktif.reduce((s, o) => s + jual(peta, o.esbBranchId), 0);

  const outlet: OutletManajemen[] = outletAktif.map((o) => {
    const dasar = { esbMulai: o.esbMulai ?? null, esbAbaikan: o.esbAbaikan ?? [] };
    // Bulan yang angka ESB-nya sedang dinyatakan salah tidak dipakai apa
    // adanya di sini juga — kalau tidak, angka yang sudah ditolak di satu
    // halaman masuk lewat pintu belakang di halaman lain.
    const nilai = (peta: Map<string, { net: number }>, bulan: string) =>
      grossDiketik(dasar, bulan) ? 0 : jual(peta, o.esbBranchId);
    return {
      id: o.id,
      nama: o.name,
      umur: umurBulan(o.bukaTanggal ?? null, periode),
      bulanLalu: [nilai(esbLalu[0], bulanA[0]), nilai(esbLalu[1], bulanA[1]), nilai(esbLalu[2], bulanA[2])],
      actual: nilai(esbIni, periode),
    };
  });

  const isian = await isianManajemen(periode);
  const sementara = hitungManajemen({
    a: { bulanLalu: [0, 0, 0], actual: 0 },
    outlet,
    labaBersih: 0,
    salesManual: null,
    divisi: [],
  });
  const idIkut = sementara.b.baris.filter((b) => b.ikut).map((b) => b.id);

  const [labaOtomatis, skorModul] = await Promise.all([
    labaBersihOutlet(periode, idIkut),
    opsi.ringan ? Promise.resolve(new Map<string, number>()) : skorPosisi(periode),
  ]);
  const labaBersih = isian.labaBersih ?? labaOtomatis ?? 0;

  // Divisi yang modulnya sudah ada dipakai nilainya; sisanya dari isian tangan.
  // Yang sudah diketik MENANG — kalau tidak, angka yang sengaja dikoreksi orang
  // akan tertimpa lagi setiap halaman dimuat ulang.
  const diketik = new Map(isian.divisi.map((d) => [d.nama, d.nilai]));
  const divisi: DivisiKpi[] = [
    ...[...skorModul.entries()].map(([nama, nilai]) => ({ nama, nilai: diketik.get(nama) ?? nilai })),
    ...isian.divisi.filter((d) => !skorModul.has(d.nama)),
  ];

  const omzetLalu: [number, number, number] = [korporat(esbLalu[0]), korporat(esbLalu[1]), korporat(esbLalu[2])];
  const lalu = opsi.ringan ? {} : await capaianLalu(periode);

  return {
    lalu,
    periode,
    omzetLalu,
    skor: hitungManajemen({
      a: { bulanLalu: omzetLalu, actual: korporat(esbIni) },
      outlet,
      labaBersih,
      salesManual: isian.salesManual,
      divisi,
    }),
    bulanA,
    divisiOtomatis: [...skorModul.keys()].filter((n) => !diketik.has(n)),
    labaBersih,
    salesManual: isian.salesManual,
    catatan: isian.catatan,
    tanpaUmur: outlet.filter((o) => o.umur === null).map((o) => o.nama),
  };
}

export async function simpanManajemen(input: {
  periode: string;
  divisi: DivisiKpi[];
  labaBersih: number | null;
  salesManual: number | null;
  catatan: string;
  olehId: string;
  olehNama: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_manajemen").upsert({
    periode: input.periode,
    divisi: input.divisi,
    laba_bersih: input.labaBersih,
    sales_manual: input.salesManual,
    catatan: input.catatan,
    diubah_oleh: input.olehId,
    diubah_nama: input.olehNama,
    diubah_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}
