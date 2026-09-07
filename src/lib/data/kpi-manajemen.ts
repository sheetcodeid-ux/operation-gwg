import "server-only";

import { db, dbEnabled } from "./db";
import { getOutlets } from "./store";
import { netBulananPerCabang } from "./esb-bulanan";
import { bulanMulaiBerjalan, bulanSebelum, grossDiketik, grossKetikBulan, laporanKpi } from "./kpi";
import { DEPARTEMEN, POSISI, posisiDari } from "@/lib/kpi/struktur";
import { SEMUA_PIC } from "@/lib/kpi/semua-pic";
import {
  SETELAN_BAWAAN,
  departemenKpi,
  hitungManajemen,
  type DepartemenKpi,
  type OutletManajemen,
  type PosisiKpi,
  type SetelanManajemen,
  type SkorManajemen,
} from "@/lib/kpi/manajemen";
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
 * Komponen keempat pun kini otomatis: nilai tiap departemen dirata-ratakan dari
 * modul KPI posisi-posisinya. Posisi yang modulnya menyusul tinggal didaftarkan
 * di `POSISI` dan langsung ikut terhitung, tanpa ada yang perlu mengetik apa
 * pun — persis supaya tidak ada bulan yang terlewat hanya karena tidak ada yang
 * ingat mengisinya.
 */

/** Omzet satu tanggal, bulan berjalan berdampingan dengan bulan sebelumnya. */
export interface HariOmzet {
  tanggal: number;
  ini: number | null;
  lalu: number | null;
}

/** Satu outlet same store dengan laba bersih dan penjualannya. */
export interface BarisEbitda {
  outletId: string;
  nama: string;
  kode: string;
  sales: number;
  labaBersih: number | null;
  /** Laba bersih bulan sebelumnya — pembanding, boleh kosong. */
  labaLalu: number | null;
  /** Margin dalam persen; null bila laba bersihnya belum diisi. */
  margin: number | null;
}

export interface DetailManajemen {
  periode: string;
  skor: SkorManajemen;
  /** Bulan pembanding komponen A, urut dari yang paling lama. */
  bulanA: [string, string, string];
  /** Omzet korporat tiga bulan itu, urut sama dengan `bulanA`. */
  omzetLalu: [number, number, number];
  labaBersih: number;
  /** Laba bersih dan sales tiap outlet same store — bahan Detail EBITDA. */
  ebitda: BarisEbitda[];
  /** Omzet per tanggal, bulan ini dan bulan lalu — bahan grafik harian. */
  harian: HariOmzet[];
  /** Bobot dan target yang sedang berlaku. */
  setelan: SetelanManajemen;
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

/**
 * Bobot dan target yang sedang berlaku.
 *
 * Gagal membaca berarti memakai NILAI BAWAAN, bukan menggagalkan halamannya:
 * setelan adalah pelengkap, dan halaman yang menolak tampil karena satu baris
 * pengaturan tidak terbaca jauh lebih merugikan daripada bobot yang sesaat
 * kembali ke bawaannya.
 */
export async function setelanManajemen(): Promise<SetelanManajemen> {
  if (!dbEnabled) return SETELAN_BAWAAN;
  const { data } = await db()
    .from("kpi_manajemen_setelan")
    .select("bobot_a,bobot_b,bobot_c,bobot_d,pertumbuhan,target_margin,ambang_ebitda,umur_same_store")
    .eq("id", "global")
    .maybeSingle();
  if (!data) return SETELAN_BAWAAN;
  return {
    bobot: {
      a: angka(data.bobot_a) || SETELAN_BAWAAN.bobot.a,
      b: angka(data.bobot_b) || SETELAN_BAWAAN.bobot.b,
      c: angka(data.bobot_c) || SETELAN_BAWAAN.bobot.c,
      d: angka(data.bobot_d) || SETELAN_BAWAAN.bobot.d,
    },
    pertumbuhan: angka(data.pertumbuhan),
    targetMargin: angka(data.target_margin) || SETELAN_BAWAAN.targetMargin,
    ambangEbitda: angka(data.ambang_ebitda) || SETELAN_BAWAAN.ambangEbitda,
    umurSameStore: angka(data.umur_same_store),
  };
}

/** Menyimpan setelan — hanya dipanggil aksi yang sudah memeriksa izinnya. */
export async function simpanSetelanManajemen(input: {
  setelan: SetelanManajemen;
  olehId: string;
  olehNama: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { setelan: st } = input;
  const { error } = await db().from("kpi_manajemen_setelan").upsert({
    id: "global",
    bobot_a: st.bobot.a,
    bobot_b: st.bobot.b,
    bobot_c: st.bobot.c,
    bobot_d: st.bobot.d,
    pertumbuhan: st.pertumbuhan,
    target_margin: st.targetMargin,
    ambang_ebitda: st.ambangEbitda,
    umur_same_store: st.umurSameStore,
    diubah_oleh: input.olehId,
    diubah_nama: input.olehNama,
    diubah_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

/** Jumlah hari dalam satu periode "YYYY-MM". */
function jumlahHari(periode: string): number {
  const [th, bl] = periode.split("-").map(Number);
  return new Date(Date.UTC(th, bl, 0)).getUTCDate();
}

/**
 * Omzet harian seluruh outlet, bulan berjalan berdampingan dengan bulan lalu.
 *
 * SUMBERNYA `sales_daily`, yang menyimpan penjualan harian SELURUH perusahaan
 * tanpa rincian cabang — ESB memang ditarik per hari, tapi yang disimpan hanya
 * jumlahnya. Karena itu grafik harian tidak bisa dipisah per outlet, dan
 * angkanya juga tidak mengenal bulan yang ditandai manual. Ia dipakai untuk
 * melihat BENTUK bulan berjalan — hari mana yang ramai, hari mana yang jatuh —
 * bukan untuk mencocokkan totalnya dengan kartu Gross Sales di atasnya.
 */
async function omzetHarian(periode: string): Promise<HariOmzet[]> {
  const hari = jumlahHari(periode);
  const kosong = Array.from({ length: hari }, (_, i) => ({ tanggal: i + 1, ini: null, lalu: null }));
  if (!dbEnabled) return kosong;

  const lalu = bulanSebelum(periode);
  const { data } = await db()
    .from("sales_daily")
    .select("day,net_sales")
    .gte("day", `${lalu}-01`)
    .lte("day", `${periode}-${String(hari).padStart(2, "0")}`);

  const peta = new Map<string, number>();
  for (const r of data ?? []) peta.set(String(r.day).slice(0, 10), angka(r.net_sales));

  const ambil = (bulan: string, tgl: number) => peta.get(`${bulan}-${String(tgl).padStart(2, "0")}`) ?? null;
  return kosong.map(({ tanggal }) => ({ tanggal, ini: ambil(periode, tanggal), lalu: ambil(lalu, tanggal) }));
}

/** Laba bersih tiap outlet same store, dari isian bulanan Coordinator Area. */
async function labaOutlet(periode: string, outletIds: string[]): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  if (!dbEnabled || outletIds.length === 0) return peta;
  const { data } = await db()
    .from("kpi_outlet_bulanan")
    .select("outlet_id,net_profit")
    .eq("periode", periode)
    .in("outlet_id", outletIds);
  for (const r of data ?? []) {
    // Tidak diisi BUKAN berarti labanya nol — barisnya dilewati, bukan dinolkan.
    if (r.net_profit === null || r.net_profit === undefined) continue;
    peta.set(String(r.outlet_id), angka(r.net_profit));
  }
  return peta;
}

/**
 * Nilai KPI tiap posisi yang modulnya sudah ada, sebagai bahan komponen D.
 *
 * Yang dipakai `skorSetara` — skor yang diskalakan ke 100 dengan hanya
 * menghitung indikator yang ada datanya. Memakai skor mentah membuat posisi
 * yang satu indikatornya belum terukur selalu tampak lebih buruk daripada yang
 * lengkap, dan rata-rata seluruh divisi ikut tertarik turun tiap bulan.
 *
 * Berkunci KODE posisi, bukan namanya. Nama posisi boleh berubah kapan saja
 * tanpa mengubah apa pun; kalau ia jadi kunci, satu perubahan kata membuat
 * angka bulan lalu tidak lagi ketemu pasangannya dan seluruh perbandingan
 * berubah jadi "belum ada data" tanpa sebab yang terlihat.
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
    if (nilai !== null) hasil.set(POSISI[i].kode, Math.round(nilai * 100) / 100);
  });
  return hasil;
}

/**
 * Departemen beserta posisi-posisinya, bulan ini dan bulan lalu.
 *
 * Departemen yang belum punya satu pun posisi ber-modul TETAP DIDAFTAR dengan
 * nilai kosong. Menyembunyikannya membuat daftar departemen berubah-ubah tiap
 * bulan mengikuti kelengkapan data — dan yang membacanya akan mengira
 * departemennya dihapus, bukan bahwa modulnya belum ada.
 */
function susunDepartemen(ini: Map<string, number>, lalu: Map<string, number>): DepartemenKpi[] {
  return DEPARTEMEN.map((d) => {
    const posisi: PosisiKpi[] = d.posisi.map((kode) => ({
      kode,
      nama: posisiDari(kode)?.nama ?? kode,
      nilai: ini.get(kode) ?? null,
      lalu: lalu.get(kode) ?? null,
    }));
    return departemenKpi(d.kode, d.nama, d.singkat, posisi);
  });
}

/**
 * Capaian bulan lalu, untuk grafik pembanding.
 *
 * Dipanggil dalam bentuk RINGAN — tanpa membaca ulang KPI tiap posisi. Komponen
 * D bulan lalu tidak diambil dari sini melainkan dari nilai per posisi yang
 * sudah ditarik untuk tabel departemen, jadi dua belas laporan posisi cukup
 * dibaca sekali saja.
 */
async function capaianLalu(periode: string, rataD: number): Promise<Record<string, LaluIndikator>> {
  const d = await detailManajemen(bulanSebelum(periode), { ringan: true }).catch(() => null);
  if (!d) return {};
  const { skor } = d;
  return {
    a: { persen: skor.a.capaian * 100, actual: skor.a.actual },
    b: { persen: skor.b.capaian * 100, actual: skor.b.actual },
    c: { persen: skor.c.capaian * 100, actual: skor.c.margin },
    d: { persen: rataD, actual: rataD },
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
  const [ketikIni, ...ketikLalu] = await Promise.all([
    grossKetikBulan(periode),
    ...bulanA.map((b) => grossKetikBulan(b)),
  ]);

  const setelan = await setelanManajemen();
  const outletAktif = getOutlets().filter((o) => o.active);
  const jual = (peta: Map<string, { net: number }>, branch: string | null | undefined) =>
    branch ? (peta.get(branch)?.net ?? 0) : 0;

  /**
   * Omzet satu outlet pada satu bulan.
   *
   * Bulan yang dinyatakan manual memakai ANGKA KETIKAN, bukan ESB dan bukan
   * nol. Angka ESB-nya sudah dinyatakan salah — itu sebabnya bulannya ditandai
   * — sementara nol berarti outletnya seolah tidak berjualan sama sekali, yang
   * sama-sama tidak benar dan diam-diam menurunkan omzet korporat serta
   * mencoret outletnya dari same store. Aturan yang sama dipakai Coordinator
   * Area, jadi satu bulan bernilai sama di kedua halaman.
   */
  const omzet = (
    o: (typeof outletAktif)[number],
    esb: Map<string, { net: number }>,
    ketik: Map<string, number>,
    bulan: string,
  ) =>
    grossDiketik({ esbMulai: o.esbMulai ?? null, esbAbaikan: o.esbAbaikan ?? [] }, bulan)
      ? (ketik.get(o.id) ?? 0)
      : jual(esb, o.esbBranchId);

  // Omzet korporat = jumlah SELURUH cabang, termasuk outlet baru. Same store
  // punya aturannya sendiri di komponen B; mencampurnya di sini membuat
  // pertumbuhan korporat ikut menghukum pembukaan outlet baru.
  const korporat = (esb: Map<string, { net: number }>, ketik: Map<string, number>, bulan: string) =>
    outletAktif.reduce((s, o) => s + omzet(o, esb, ketik, bulan), 0);

  const outlet: OutletManajemen[] = outletAktif.map((o) => ({
    id: o.id,
    nama: o.name,
    kode: o.code ?? o.id,
    umur: umurBulan(o.bukaTanggal ?? null, periode),
    bulanLalu: [
      omzet(o, esbLalu[0], ketikLalu[0], bulanA[0]),
      omzet(o, esbLalu[1], ketikLalu[1], bulanA[1]),
      omzet(o, esbLalu[2], ketikLalu[2], bulanA[2]),
    ],
    actual: omzet(o, esbIni, ketikIni, periode),
  }));

  const sementara = hitungManajemen({
    a: { bulanLalu: [0, 0, 0], actual: 0 },
    outlet,
    labaBersih: 0,
    departemen: [],
    setelan,
  });
  const ikut = sementara.b.baris.filter((b) => b.ikut);
  const idIkut = ikut.map((b) => b.id);

  // Dua bulan sekaligus: bulan berjalan untuk nilainya, bulan sebelumnya untuk
  // pembandingnya. Keduanya ditarik bersamaan supaya halaman tidak menunggu
  // dua putaran berurutan.
  const [laba, labaLalu, harian, skorIni, skorLalu] = await Promise.all([
    labaOutlet(periode, idIkut),
    labaOutlet(bulanSebelum(periode), idIkut),
    opsi.ringan ? Promise.resolve([] as HariOmzet[]) : omzetHarian(periode),
    opsi.ringan ? Promise.resolve(new Map<string, number>()) : skorPosisi(periode),
    opsi.ringan ? Promise.resolve(new Map<string, number>()) : skorPosisi(bulanSebelum(periode)),
  ]);

  const ebitda: BarisEbitda[] = ikut.map((b) => {
    const nilai = laba.get(b.id) ?? null;
    return {
      outletId: b.id,
      nama: b.nama,
      kode: b.kode,
      sales: b.actual,
      labaBersih: nilai,
      labaLalu: labaLalu.get(b.id) ?? null,
      margin: nilai !== null && b.actual > 0 ? (nilai / b.actual) * 100 : null,
    };
  });
  // Outlet yang belum diisi labanya dilewati saat menjumlah laba, TAPI
  // penjualannya tetap ikut di penyebut — itulah definisi marginnya: laba
  // seluruh same store dibagi penjualan seluruh same store. Akibatnya margin
  // tampak rendah selama isian Coordinator Area belum lengkap, jadi jumlah
  // outlet yang belum diisi disebutkan di bawah tabelnya, bukan disembunyikan.
  const labaBersih = ebitda.reduce((s, b) => s + (b.labaBersih ?? 0), 0);

  const departemen = susunDepartemen(skorIni, skorLalu);

  const omzetLalu: [number, number, number] = [
    korporat(esbLalu[0], ketikLalu[0], bulanA[0]),
    korporat(esbLalu[1], ketikLalu[1], bulanA[1]),
    korporat(esbLalu[2], ketikLalu[2], bulanA[2]),
  ];
  const rataDLalu =
    departemen.map((d) => d.lalu).filter((n): n is number => n !== null).reduce((s, n, _, a) => s + n / a.length, 0);
  const lalu = opsi.ringan ? {} : await capaianLalu(periode, rataDLalu);

  return {
    lalu,
    periode,
    omzetLalu,
    skor: hitungManajemen({
      a: { bulanLalu: omzetLalu, actual: korporat(esbIni, ketikIni, periode) },
      outlet,
      labaBersih,
      departemen,
      setelan,
    }),
    bulanA,
    labaBersih,
    ebitda,
    harian,
    setelan,
  };
}
