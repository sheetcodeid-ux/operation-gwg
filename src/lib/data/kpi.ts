import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { getOutlets, getUser, getUsers } from "./store";
import { listHcRequests } from "./hc-requests";
import { netBulananPerCabang } from "./esb-bulanan";
import { WORK_BRANDS } from "@/lib/constants";
import {
  actualLulus,
  actualPengurang,
  barisEfisiensi,
  barisKpi,
  hitungTarget,
  keberhasilanPasar,
  ringkasEfisiensi,
  ringkasKpi,
  type BarisEfisiensi,
  type BarisKpi,
  type RingkasKpi,
} from "@/lib/kpi/hitung";
import { indikatorPosisi, type Indikator, type JenisEntri } from "@/lib/kpi/indikator";
import { posisiDari, type KodePosisi } from "@/lib/kpi/struktur";
import { SEMUA_PIC } from "@/lib/kpi/semua-pic";

/**
 * Penyusun angka KPI satu posisi pada satu bulan.
 *
 * SATU TEMPAT UNTUK SEMUA POSISI. Yang membedakan posisi hanya daftar
 * indikatornya; cara mengambil target dan actual-nya sama persis. Halaman
 * layar tinggal menerima hasilnya — tidak ada satu pun perhitungan yang
 * dikerjakan di peramban, supaya angka yang dilihat orang yang dinilai sama
 * dengan angka yang dilihat atasannya.
 */

export interface EntriKpi {
  id: string;
  jenis: JenisEntri;
  periode: string;
  posisi: string;
  tanggal: string;
  picNama: string;
  outletId: string | null;
  judul: string;
  deskripsi: string;
  nominal: number | null;
  nominalSeharusnya: number | null;
  tenggat: string | null;
  gagal: boolean;
  lampiran: { path: string; name: string }[];
  dibuatNama: string;
}

export interface PengaturanIndikator {
  bobot: number | null;
  target: number | null;
  pertumbuhan: number | null;
}

export interface DetailPasar {
  baris: { menu: string; penjualan: number; bagian: number }[];
  omset: number;
  total: number;
  bagianTotal: number | null;
}

export interface DetailFee {
  outletId: string;
  outletNama: string;
  netSales: number | null;
  feeSeharusnya: number | null;
  sesuai: boolean;
  /** Kenapa net sales-nya kosong — supaya yang membacanya tahu apa yang harus
   *  dikerjakan, bukan sekadar melihat tanda pisah. */
  alasan?: string;
}

export interface LaporanKpi {
  posisi: KodePosisi;
  periode: string;
  /** Kosong = dinilai sebagai satu tim. */
  pic: string;
  baris: BarisKpi[];
  ringkas: RingkasKpi;
  dikunci: boolean;
  /** Panel tambahan — hanya terisi untuk posisi yang memakainya. */
  efisiensi: { baris: BarisEfisiensi[]; ringkas: ReturnType<typeof ringkasEfisiensi> } | null;
  pasar: DetailPasar | null;
  fee: DetailFee[] | null;
  entri: EntriKpi[];
  /** Angka dan daftar outlet Coordinator Area. Null untuk posisi lain. */
  ca: AngkaCa | null;
}

const bulanSebelum = (periode: string): string => {
  const [th, bl] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(th, bl - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const angka = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

const entriDari = (r: Record<string, unknown>): EntriKpi => ({
  id: String(r.id),
  jenis: String(r.jenis) as JenisEntri,
  periode: String(r.periode),
  posisi: String(r.posisi),
  tanggal: String(r.tanggal ?? ""),
  picNama: String(r.pic_nama ?? "—"),
  outletId: (r.outlet_id as string | null) ?? null,
  judul: String(r.judul ?? ""),
  deskripsi: String(r.deskripsi ?? ""),
  nominal: angka(r.nominal),
  nominalSeharusnya: angka(r.nominal_seharusnya),
  tenggat: (r.tenggat as string | null) ?? null,
  gagal: !!r.gagal,
  lampiran: (Array.isArray(r.lampiran) ? r.lampiran : []) as { path: string; name: string }[],
  dibuatNama: String(r.dibuat_nama ?? ""),
});

/* ─────────────────────────── pengaturan bobot ─────────────────────────── */

export async function pengaturanPosisi(posisi: string): Promise<Map<string, PengaturanIndikator>> {
  const peta = new Map<string, PengaturanIndikator>();
  if (!dbEnabled) return peta;
  const { data } = await db().from("kpi_pengaturan").select("*").eq("posisi", posisi);
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    peta.set(String(r.indikator), {
      bobot: angka(r.bobot),
      target: angka(r.target),
      pertumbuhan: angka(r.pertumbuhan),
    });
  }
  return peta;
}

export async function simpanPengaturan(input: {
  posisi: string;
  indikator: string;
  bobot: number | null;
  target: number | null;
  pertumbuhan: number | null;
  olehId: string;
  olehNama: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_pengaturan").upsert({
    posisi: input.posisi,
    indikator: input.indikator,
    bobot: input.bobot,
    target: input.target,
    pertumbuhan: input.pertumbuhan,
    diubah_oleh: input.olehId,
    diubah_nama: input.olehNama,
    diubah_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

/* ──────────────────────────── angka manual ──────────────────────────── */

export async function simpanActual(input: {
  periode: string;
  posisi: string;
  pic?: string;
  indikator: string;
  brand: string;
  nilai: number;
  catatan: string;
  olehId: string;
  olehNama: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_actual").upsert({
    periode: input.periode,
    posisi: input.posisi,
    pic: input.pic ?? "",
    indikator: input.indikator,
    brand: input.brand,
    nilai: input.nilai,
    catatan: input.catatan.slice(0, 500) || null,
    diisi_oleh: input.olehId,
    diisi_nama: input.olehNama,
    diisi_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

/** Angka manual yang sudah tersimpan — pengisi awal formnya. */
export async function actualTersimpan(periode: string, posisi: string): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  if (!dbEnabled) return out;
  const { data } = await db().from("kpi_actual").select("indikator,brand,nilai").eq("periode", periode).eq("posisi", posisi);
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    const k = String(r.indikator);
    out[k] = out[k] ?? {};
    out[k][String(r.brand ?? "")] = Number(r.nilai) || 0;
  }
  return out;
}

/* ──────────────────────── efisiensi, fee, menu ──────────────────────── */

export async function simpanEfisiensi(input: {
  periode: string;
  posisi: string;
  pic?: string;
  outletId: string;
  actualWh: number | null;
  actualNonWh: number | null;
  olehId: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_efisiensi").upsert({
    periode: input.periode,
    posisi: input.posisi,
    pic: input.pic ?? "",
    outlet_id: input.outletId,
    actual_wh: input.actualWh,
    actual_non_wh: input.actualNonWh,
    diisi_oleh: input.olehId,
    diisi_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

export async function simpanFee(input: {
  periode: string;
  outletId: string;
  sesuai: boolean;
  catatan: string;
  olehId: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_fee").upsert({
    periode: input.periode,
    outlet_id: input.outletId,
    sesuai: input.sesuai,
    catatan: input.catatan.slice(0, 300) || null,
    diisi_oleh: input.olehId,
    diisi_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

export async function simpanMenuPasar(input: {
  periode: string;
  posisi: string;
  pic?: string;
  menu: string;
  penjualan: number;
  omset: number;
  olehId: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_menu_pasar").upsert({
    periode: input.periode,
    posisi: input.posisi,
    pic: input.pic ?? "",
    menu: input.menu.slice(0, 160),
    penjualan: input.penjualan,
    omset: input.omset,
    dipilih_oleh: input.olehId,
    dipilih_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

export async function hapusMenuPasar(periode: string, posisi: string, menu: string, pic = ""): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db()
    .from("kpi_menu_pasar")
    .delete()
    .eq("periode", periode)
    .eq("posisi", posisi)
    .eq("pic", pic)
    .eq("menu", menu);
  return error ? { error: error.message } : {};
}

/** Apakah bulan itu sudah dikunci untuk posisi ini. */
export async function periodeDikunci(periode: string, posisi: string, pic = ""): Promise<boolean> {
  if (!dbEnabled) return false;
  const { data } = await db()
    .from("kpi_periode")
    .select("dikunci")
    .eq("periode", periode)
    .eq("posisi", posisi)
    .eq("pic", pic)
    .maybeSingle();
  return !!(data as { dikunci?: boolean } | null)?.dikunci;
}

/* ───────────────────────────────── entri ───────────────────────────────── */

export async function simpanEntri(
  input: Omit<EntriKpi, "id" | "dibuatNama"> & { id?: string; pic?: string; olehId: string; olehNama: string },
): Promise<{ id?: string; error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const id = input.id ?? `kpe_${randomUUID()}`;
  const { error } = await db().from("kpi_entri").upsert({
    id,
    jenis: input.jenis,
    periode: input.periode,
    posisi: input.posisi,
    pic: input.pic ?? "",
    tanggal: input.tanggal,
    pic_nama: input.picNama,
    outlet_id: input.outletId,
    judul: input.judul,
    deskripsi: input.deskripsi,
    nominal: input.nominal,
    nominal_seharusnya: input.nominalSeharusnya,
    tenggat: input.tenggat,
    gagal: input.gagal,
    lampiran: input.lampiran,
    dibuat_oleh: input.olehId,
    dibuat_nama: input.olehNama,
  });
  return error ? { error: error.message } : { id };
}

export async function hapusEntri(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_entri").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

/* ──────────────────────────── sumber otomatis ──────────────────────────── */

/**
 * Permintaan desain yang masuk dan yang selesai bulan itu.
 *
 * Target = yang masuk, actual = yang terlaksana. Selesai semua berarti 100%,
 * dan tidak ada yang perlu diketik siapa pun.
 */
async function designRequest(periode: string): Promise<{ masuk: number; selesai: number }> {
  const rows = await listHcRequests({ kind: "design", semua: true });
  const bulan = rows.filter((r) => r.createdAt.slice(0, 7) === periode);
  return { masuk: bulan.length, selesai: bulan.filter((r) => r.status === "terlaksana").length };
}

/* ─────────────── angka bulanan per outlet yang diisi tangan ─────────────── */

export interface OutletBulanan {
  outletId: string;
  gross: number | null;
  netProfit: number | null;
  hpp: number | null;
}

/** Isian tangan seluruh outlet pada satu bulan. */
async function outletBulanan(periode: string): Promise<Map<string, OutletBulanan>> {
  const peta = new Map<string, OutletBulanan>();
  if (!dbEnabled) return peta;
  const { data } = await db().from("kpi_outlet_bulanan").select("outlet_id,gross,net_profit,hpp").eq("periode", periode);
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    peta.set(String(r.outlet_id), {
      outletId: String(r.outlet_id),
      gross: angka(r.gross),
      netProfit: angka(r.net_profit),
      hpp: angka(r.hpp),
    });
  }
  return peta;
}

export async function simpanOutletBulanan(input: {
  outletId: string;
  periode: string;
  gross: number | null;
  netProfit: number | null;
  hpp: number | null;
  olehId: string;
  olehNama: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const { error } = await db().from("kpi_outlet_bulanan").upsert({
    outlet_id: input.outletId,
    periode: input.periode,
    gross: input.gross,
    net_profit: input.netProfit,
    hpp: input.hpp,
    diubah_oleh: input.olehId,
    diubah_nama: input.olehNama,
    diubah_pada: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

/* ─────────────────────── angka se-area Coordinator Area ─────────────────────── */

/** Outlet yang dinilai, beserta cabang ESB-nya. */
interface OutletCa {
  id: string;
  nama: string;
  branch: string | null;
}

/**
 * SATU nilai gross sales outlet pada satu bulan.
 *
 * ESB lebih dulu, isian tangan hanya sebagai cadangan — angka yang bisa
 * diperdebatkan tidak boleh mengalahkan angka yang tidak bisa. Cadangannya ada
 * karena tiga outlet (Nordu Siantan dan dua Ayam Goreng Busari) pindah dari POS
 * Majoo dan riwayatnya tidak ikut terbawa; tanpa isian itu ketiganya terbaca
 * seperti outlet yang baru buka.
 */
function grossOutlet(o: OutletCa, esb: Map<string, { net: number }>, tangan: Map<string, OutletBulanan>): number | null {
  // NOL DARI ESB BUKAN "penjualannya nol", melainkan "cabang ini belum ada di
  // bulan itu". ESB tetap membalas untuk cabang yang belum buka, dan balasannya
  // nol — jadi barisnya selalu tersimpan. Kalau nol dianggap angka yang sah,
  // outlet yang belum buka lolos aturan tiga bulan dengan penjualan nol dan
  // menyeret rata-rata seluruh area ke bawah; sekaligus menutup jalan isian
  // tangan untuk tiga outlet pindahan Majoo, yang justru nol karena riwayatnya
  // tidak ikut terbawa.
  const dariEsb = o.branch ? esb.get(o.branch)?.net : undefined;
  if (dariEsb !== undefined && dariEsb > 0) return dariEsb;
  const manual = tangan.get(o.id)?.gross ?? null;
  if (manual !== null && manual > 0) return manual;
  return dariEsb !== undefined ? 0 : null;
}

/** Bulan itu benar-benar berjalan bagi outlet ini — bukan sekadar ada barisnya. */
const berjalan = (nilai: number | null): boolean => nilai !== null && nilai > 0;

/** Tiga bulan sebelum `periode`, terbaru dulu. */
function tigaBulanSebelum(periode: string): string[] {
  const a = bulanSebelum(periode);
  const b = bulanSebelum(a);
  return [a, b, bulanSebelum(b)];
}

export interface DetailOutletCa {
  outletId: string;
  outletNama: string;
  /** Gross sales bulan ini; null = belum ada dari mana pun. */
  gross: number | null;
  /** Angkanya dari ESB — kalau ya, isian tangan tidak dipakai dan tidak perlu. */
  dariEsb: boolean;
  netProfit: number | null;
  hpp: number | null;
  /** Sudah berjalan tiga bulan penuh; yang belum tidak ikut dinilai. */
  ikut: boolean;
}

export interface AngkaCa {
  /** Outlet yang IKUT dinilai — sudah berjalan tiga bulan penuh. */
  outlet: OutletCa[];
  /** Seluruh outlet di area itu beserta angkanya — bahan tabel isian. */
  detail: DetailOutletCa[];
  /** Outlet yang belum genap tiga bulan datanya, jadi tidak ikut dihitung. */
  belumTigaBulan: OutletCa[];
  /** Bulan pembanding yang angkanya belum ditarik dari ESB sama sekali. */
  bulanKosong: string[];
  grossSales: number | null;
  rataTiga: number | null;
  komplain: number | null;
  netProfit: number | null;
  hpp: number | null;
  /** Berapa Coordinator Area yang tercakup — pengali target per orang. */
  jumlahPic: number;
}

/**
 * Seluruh angka Coordinator Area untuk satu bulan.
 *
 * ATURAN TIGA BULAN. Outlet yang belum genap tiga bulan berjalan tidak ikut
 * dinilai sama sekali — bukan hanya pada Gross Sales, melainkan pada seluruh
 * indikator. Outlet baru selalu menyeret rata-rata ke bawah dan komplain awal
 * yang wajar terhitung sebagai kegagalan; menilainya berarti menghukum orang
 * atas outlet yang memang belum jalan.
 *
 * Yang menentukan "sudah tiga bulan" adalah ADA-TIDAKNYA angka penjualan tiga
 * bulan sebelumnya, bukan tanggal buka yang diketik seseorang — tanggal buka
 * tidak pernah ada di basis data ini, dan yang diketik belakangan hampir selalu
 * tanggal yang diingat, bukan tanggal yang benar.
 */
async function angkaCa(periode: string, areaIds: string[], jumlahPic: number): Promise<AngkaCa> {
  const semua: OutletCa[] = getOutlets()
    .filter((o) => o.active && areaIds.includes(o.areaId ?? ""))
    .map((o) => ({ id: o.id, nama: o.name, branch: o.esbBranchId ?? null }));

  const bulanLalu = tigaBulanSebelum(periode);
  const [esbIni, tanganIni, ...riwayat] = await Promise.all([
    netBulananPerCabang(periode),
    outletBulanan(periode),
    ...bulanLalu.map((b) => Promise.all([netBulananPerCabang(b), outletBulanan(b)])),
  ]);

  const nilaiBulan = (o: OutletCa, n: number): number | null =>
    grossOutlet(o, riwayat[n][0], riwayat[n][1]);

  // Bulan yang TIDAK PUNYA SATU BARIS PUN berarti angkanya belum ditarik dari
  // ESB — bukan berarti seluruh outlet baru buka. Dibedakan supaya pesannya
  // tidak mengirim orang mencari masalah yang tidak ada.
  const bulanKosong = bulanLalu.filter(
    (_, n) => [...riwayat[n][0].values()].every((v) => v.net <= 0) && riwayat[n][1].size === 0,
  );

  const lolos: OutletCa[] = [];
  const belum: OutletCa[] = [];
  const rata = new Map<string, number>();
  for (const o of semua) {
    const tiga = [0, 1, 2].map((n) => nilaiBulan(o, n));
    if (!tiga.every(berjalan)) {
      belum.push(o);
      continue;
    }
    lolos.push(o);
    rata.set(o.id, (tiga as number[]).reduce((a, b) => a + b, 0) / 3);
  }

  // Gross sales bulan ini. Satu outlet yang lolos tapi angkanya belum ada
  // membuat totalnya BELUM UTUH — ditahan, bukan ditampilkan kurang.
  const grossPerOutlet = lolos.map((o) => grossOutlet(o, esbIni, tanganIni));
  const grossSales = grossPerOutlet.some((v) => v === null)
    ? null
    : grossPerOutlet.reduce((a: number, b) => a + (b ?? 0), 0);

  const rataTiga = lolos.length === 0 ? null : lolos.reduce((a, o) => a + (rata.get(o.id) ?? 0), 0);

  const netProfitPer = lolos.map((o) => tanganIni.get(o.id)?.netProfit ?? null);
  const netProfit = netProfitPer.every((v) => v === null) ? null : netProfitPer.reduce((a: number, b) => a + (b ?? 0), 0);

  // HPP se-area adalah RASIO, jadi ditimbang penjualannya — merata-ratakan
  // persen begitu saja membuat outlet kecil sama beratnya dengan outlet
  // terbesar, dan angkanya tidak pernah cocok dengan laporan keuangan.
  let bobotHpp = 0;
  let jumlahHpp = 0;
  lolos.forEach((o, n) => {
    const h = tanganIni.get(o.id)?.hpp;
    const g = grossPerOutlet[n];
    if (h === null || h === undefined || g === null) return;
    bobotHpp += g;
    jumlahHpp += h * g;
  });
  const hpp = bobotHpp > 0 ? jumlahHpp / bobotHpp : null;

  const komplain = await komplainOutlet(periode, lolos.map((o) => o.id));

  const detail: DetailOutletCa[] = semua.map((o) => {
    // "Dari ESB" berarti ESB punya angka yang BUKAN nol. Nol berarti cabangnya
    // belum ada di sana, dan justru itulah yang perlu diisi tangan.
    const dariEsb = !!(o.branch && (esbIni.get(o.branch)?.net ?? 0) > 0);
    return {
      outletId: o.id,
      outletNama: o.nama,
      gross: grossOutlet(o, esbIni, tanganIni),
      dariEsb,
      netProfit: tanganIni.get(o.id)?.netProfit ?? null,
      hpp: tanganIni.get(o.id)?.hpp ?? null,
      ikut: lolos.some((l) => l.id === o.id),
    };
  });

  return { outlet: lolos, detail, belumTigaBulan: belum, bulanKosong, grossSales, rataTiga, komplain, netProfit, hpp, jumlahPic };
}

/**
 * Komplain outlet-outlet itu pada satu bulan, DI LUAR kategori kualitas makanan.
 *
 * Kualitas makanan sudah dinilai di tempat lain (Review Customer milik PDQ);
 * menghitungnya lagi di sini berarti satu kejadian menghukum dua departemen.
 */
async function komplainOutlet(periode: string, outletIds: string[]): Promise<number | null> {
  if (!dbEnabled) return null;
  if (outletIds.length === 0) return 0;
  const { data } = await db()
    .from("complaints")
    .select("id")
    .in("outlet_id", outletIds)
    .neq("category", "food_quality")
    .gte("review_date", `${periode}-01`)
    .lt("review_date", `${bulanSetelah(periode)}-01`);
  return (data ?? []).length;
}

/** Komplain kategori Food Quality bulan itu — bahan indikator Review Customer. */
async function komplainFoodQuality(periode: string): Promise<number> {
  if (!dbEnabled) return 0;
  // Dihitung dari TANGGAL KOMPLAINNYA (`review_date`), bukan tanggal barisnya
  // dibuat. Komplain bulan lalu yang baru sempat dimasukkan hari ini adalah
  // komplain bulan lalu — memasukkannya ke bulan ini menghukum orang atas
  // sesuatu yang terjadi di periode yang sudah ditutup.
  const { data } = await db()
    .from("complaints")
    .select("id,review_date,category")
    .eq("category", "food_quality")
    .gte("review_date", `${periode}-01`)
    .lt("review_date", `${bulanSetelah(periode)}-01`);
  return (data ?? []).length;
}

const bulanSetelah = (periode: string): string => {
  const [th, bl] = periode.split("-").map(Number);
  const d = new Date(Date.UTC(th, bl, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * Net sales SELURUH perusahaan untuk satu rentang bulan.
 *
 * Barisnya bercabang KOSONG — itu cara `seasonal_daily` menyimpan angka
 * gabungan seluruh outlet, langsung dari ESB. Dipakai Marketing Communication
 * (Net Sales Achievement) dan sebagai omset pembanding Keberhasilan Pasar.
 */
async function netSalesPerusahaan(dariPeriode: string, sampaiPeriode = dariPeriode): Promise<number | null> {
  if (!dbEnabled) return null;
  const { data } = await db()
    .from("seasonal_daily")
    .select("net")
    .eq("branch", "")
    .gte("day", `${dariPeriode}-01`)
    .lt("day", `${bulanSetelah(sampaiPeriode)}-01`);
  const rows = (data ?? []) as { net: number | string }[];
  // Tidak ada barisnya sama sekali berarti bulannya belum disinkron — itu BEDA
  // dengan penjualan nol, dan menyamakannya akan menuduh tim gagal total atas
  // bulan yang bahkan belum ditarik datanya.
  if (rows.length === 0) return null;
  return rows.reduce((a, r) => a + (Number(r.net) || 0), 0);
}

/**
 * Average Transaction seluruh perusahaan untuk satu bulan.
 *
 * Total net sales dibagi TOTAL JUMLAH STRUK sebulan — bukan rata-rata dari
 * angka rata-rata harian. Merata-ratakan yang sudah rata-rata memberi bobot
 * sama kepada hari sepi dan hari ramai, dan hasilnya selalu meleset dari angka
 * yang terbaca di Sales Dashboard ESB.
 *
 * Hari yang jumlah struknya belum pernah ditarik (`bills` NULL) dibuang
 * beserta net sales hari itu. Ikut menghitung net sales-nya tanpa struknya
 * akan menaikkan hasilnya tanpa batas — dan itu jenis kesalahan yang tidak
 * pernah kelihatan salah.
 */
interface AverageTrx {
  nilai: number;
  /** Hari yang jumlah struknya sudah ada, dan hari yang seharusnya ada. */
  hariAda: number;
  hariHarus: number;
}

/** Hari terakhir bulan itu yang sudah lewat menurut waktu Indonesia Barat. */
function hariBerjalan(periode: string): number {
  const hariIni = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const [th, bl] = periode.split("-").map(Number);
  const akhir = new Date(Date.UTC(th, bl, 0)).getUTCDate();
  if (hariIni.slice(0, 7) > periode) return akhir; // bulan sudah lewat seluruhnya
  if (hariIni.slice(0, 7) < periode) return 0; // bulan yang belum datang
  return Number(hariIni.slice(8, 10));
}

async function averageTransaksi(periode: string): Promise<AverageTrx | null> {
  if (!dbEnabled) return null;
  const { data } = await db()
    .from("seasonal_daily")
    .select("net,bills")
    .eq("branch", "")
    .not("bills", "is", null)
    .gte("day", `${periode}-01`)
    .lt("day", `${bulanSetelah(periode)}-01`);
  const rows = (data ?? []) as { net: number | string; bills: number | string }[];
  const struk = rows.reduce((a, r) => a + (Number(r.bills) || 0), 0);
  if (struk === 0) return null;
  const net = rows.reduce((a, r) => a + (Number(r.net) || 0), 0);
  return { nilai: net / struk, hariAda: rows.length, hariHarus: hariBerjalan(periode) };
}

/**
 * Net sales per CABANG ESB untuk satu bulan, dari data harian yang disinkron.
 *
 * Kuncinya id cabang ESB ("18-fnb_nord"), bukan nama outlet. Sempat dicocokkan
 * dengan nama, dan hasilnya nol dari 58 outlet: `seasonal_daily.branch`
 * menyimpan id ESB, sementara `outlets.name` menyimpan nama panjang cabangnya.
 * Tabel Efisiensi dan Management Fee karena itu tampil kosong seluruhnya —
 * tanpa satu pun pesan galat, karena memang tidak ada yang gagal; yang
 * dicocokkan saja tidak pernah bisa bertemu.
 */
/**
 * Net sales sebulan per cabang ESB — diambil UTUH dari ESB, bukan dijumlahkan.
 *
 * Sempat dijumlahkan dari data harian per cabang, dan hasilnya kurang separuh:
 * penarikan harian per cabang berjalan bertahap dan pernah baru terisi 14 dari
 * 31 hari Agustus. Dari angka itulah Management Fee 5% dan budget Efisiensi
 * dihitung — keduanya terlihat wajar, keduanya salah, dan tidak ada satu pun
 * pesan yang menandainya.
 *
 * Sekarang satu panggilan ESB per cabang per bulan memberi angkanya utuh.
 * Barisnya ada berarti bulannya utuh; tidak ada lagi keadaan "baru separuh".
 */
async function netSalesLengkap(periode: string): Promise<Map<string, number>> {
  const peta = await netBulananPerCabang(periode);
  const out = new Map<string, number>();
  for (const [cabang, v] of peta) out.set(cabang, v.net);
  return out;
}

/**
 * Rata-rata net sales tiga bulan terakhir per cabang ESB — dasar budget efisiensi.
 *
 * Hanya bulan yang datanya LENGKAP yang ikut. Bulan separuh akan menurunkan
 * rata-ratanya, budgetnya ikut turun, dan outletnya selalu terlihat boros atas
 * kesalahan yang bukan miliknya.
 */
async function averageTigaBulan(periode: string): Promise<Map<string, number>> {
  const bulan = [periode, bulanSebelum(periode), bulanSebelum(bulanSebelum(periode))];
  const petaBulan = await Promise.all(bulan.map(netSalesLengkap));
  const total = new Map<string, { jumlah: number; bulan: number }>();
  for (const p of petaBulan) {
    for (const [nama, nilai] of p) {
      const t = total.get(nama) ?? { jumlah: 0, bulan: 0 };
      total.set(nama, { jumlah: t.jumlah + nilai, bulan: t.bulan + 1 });
    }
  }
  const out = new Map<string, number>();
  // Dibagi jumlah bulan yang BENAR-BENAR ada datanya. Outlet baru yang baru
  // buka sebulan tidak boleh rata-ratanya dibagi tiga — budgetnya akan
  // sepertiga dari yang seharusnya, dan ia selalu terlihat boros.
  for (const [nama, t] of total) out.set(nama, t.jumlah / Math.max(1, t.bulan));
  return out;
}

/**
 * Kenapa angka ESB satu outlet kosong.
 *
 * Dua sebab yang berbeda jauh, dan sebelumnya keduanya tampil sebagai kalimat
 * yang sama ("belum tersambung ke ESB"). Setelah seluruh outlet dipasangkan,
 * kalimat itu justru menyesatkan: yang kurang bukan pemasangannya, melainkan
 * penarikan hariannya yang memang berjalan bertahap.
 */
/**
 * Kenapa angka se-area kosong.
 *
 * Dua sebab yang berbeda jauh dan butuh tindakan yang berbeda pula: areanya
 * memang belum ditentukan untuk orang itu, atau areanya ada tapi sebagian
 * cabangnya belum ditarik dari ESB. Menuliskan satu kalimat untuk keduanya
 * mengirim orang membetulkan hal yang tidak salah.
 */
const areaKosong = (ca: AngkaCa | null): string => {
  if (ca === null) return "Areanya belum ditentukan untuk orang ini.";
  if (ca.bulanKosong.length > 0) {
    return `Angka ESB ${ca.bulanKosong.map(labelBulanSingkat).join(", ")} belum ditarik — pembanding tiga bulannya belum lengkap.`;
  }
  return "Angka ESB sebagian outlet di area ini belum ditarik — angkanya ditahan supaya tidak tampil kurang.";
};

const NAMA_BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const labelBulanSingkat = (periode: string): string => {
  const [th, bl] = periode.split("-");
  return `${NAMA_BULAN_SINGKAT[Number(bl) - 1] ?? bl} ${th}`;
};

const alasanKosong = (esbBranchId: string | null | undefined): string =>
  esbBranchId ? "angka ESB bulan ini belum ditarik" : "outlet belum dipasangkan ke cabang ESB";

/* ──────────────────────────────── laporan ──────────────────────────────── */

const PAKAI_EFISIENSI: KodePosisi[] = ["pdq_food", "pdq_beverage"];
const PAKAI_PASAR: KodePosisi[] = ["pdq_food", "pdq_beverage", "pdq_head_food", "pdq_head_pdq"];

/**
 * `pic` kosong berarti posisi itu dinilai sebagai satu tim. Untuk posisi yang
 * dinilai per orang, seluruh isian tersimpan di bawah nama orangnya — dan
 * membaca tanpa menyebut namanya akan menampilkan laporan kosong, bukan
 * gabungan. Itu disengaja: gabungan capaian tiga orang bukan capaian siapa pun.
 */
export async function laporanKpi(posisi: KodePosisi, periode: string, pic = ""): Promise<LaporanKpi> {
  const daftar = indikatorPosisi(posisi);
  const outletAktif = getOutlets().filter((o) => o.active);

  const [pengaturan, entriRows, actualRows, kunciRow] = await Promise.all([
    pengaturanPosisi(posisi),
    dbEnabled ? db().from("kpi_entri").select("*").eq("posisi", posisi).eq("periode", periode).eq("pic", pic) : Promise.resolve({ data: [] }),
    dbEnabled ? db().from("kpi_actual").select("*").eq("posisi", posisi).eq("periode", periode).eq("pic", pic) : Promise.resolve({ data: [] }),
    dbEnabled
      ? db().from("kpi_periode").select("dikunci").eq("posisi", posisi).eq("periode", periode).eq("pic", pic).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const entri = ((entriRows.data ?? []) as Record<string, unknown>[]).map(entriDari);
  const jumlahEntri = (jenis: JenisEntri) => entri.filter((e) => e.jenis === jenis).length;
  const jumlahGagal = (jenis: JenisEntri) => entri.filter((e) => e.jenis === jenis && e.gagal).length;

  // Angka manual: dijumlah lintas brand, karena indikator per brand disimpan
  // satu baris per brand.
  const manual = new Map<string, number>();
  for (const r of ((actualRows.data ?? []) as Record<string, unknown>[])) {
    const key = String(r.indikator);
    manual.set(key, (manual.get(key) ?? 0) + (Number(r.nilai) || 0));
  }

  // Capaian bulan lalu untuk indikator pertumbuhan — dibaca dari angka manual
  // bulan sebelumnya, bukan dari targetnya. Target yang tidak tercapai tidak
  // boleh jadi dasar target berikutnya.
  const perluNetPerusahaan = daftar.some((i) => i.key === "net_sales") || PAKAI_PASAR.includes(posisi);
  const perluAverage = daftar.some((i) => i.key === "average_transaction");
  // Coordinator Area dinilai atas AREA yang dipegangnya, dan area itu menempel
  // pada orangnya — bukan pada posisinya. Tanpa PIC terpilih tidak ada area,
  // dan tanpa area tidak ada satu pun angka yang bisa dihitung.
  const perluArea = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "gross_sales_area");
  // "Semua" mencakup SELURUH area yang dipegang Coordinator Area — dihitung
  // sekali per area, bukan per orang. Tiga orang yang memegang satu area yang
  // sama akan menjumlahkan penjualan area itu tiga kali kalau dihitung per
  // orang, dan totalnya tidak pernah cocok dengan angka perusahaan.
  const semuaPic = picDinamis(posisi);
  const capAllArea = pic === SEMUA_PIC;
  const areaIds = !perluArea
    ? []
    : capAllArea
      ? [...new Set(semuaPic.map((o) => getUser(o.value)?.areaId ?? "").filter(Boolean))]
      : [getUser(pic)?.areaId ?? ""].filter(Boolean);
  const jumlahPic = capAllArea ? Math.max(1, semuaPic.length) : 1;

  const lalu = new Map<string, number>();
  if (perluAverage) {
    // Dasar targetnya average transaction bulan lalu yang SEBENARNYA — dari
    // ESB, bukan dari angka yang pernah diketik. Bulan lalu yang datanya belum
    // lengkap TIDAK dipakai: targetnya akan berdiri di atas angka separuh
    // bulan, dan tidak ada yang akan menyadarinya setelah datanya lengkap.
    const a = await averageTransaksi(bulanSebelum(periode));
    if (a !== null && a.hariAda >= a.hariHarus) lalu.set("average_transaction", a.nilai);
  }
  if (perluNetPerusahaan) {
    // Dasar target Net Sales adalah penjualan bulan lalu yang SEBENARNYA, bukan
    // yang pernah diketik — keduanya bisa berbeda, dan yang dari ESB tidak bisa
    // diperdebatkan.
    const n = await netSalesPerusahaan(bulanSebelum(periode));
    if (n !== null) lalu.set("net_sales", n);
  }
  if (dbEnabled) {
    const { data } = await db()
      .from("kpi_actual")
      .select("indikator,nilai")
      .eq("posisi", posisi)
      .eq("periode", bulanSebelum(periode))
      .eq("pic", pic);
    for (const r of ((data ?? []) as Record<string, unknown>[])) {
      const key = String(r.indikator);
      lalu.set(key, (lalu.get(key) ?? 0) + (Number(r.nilai) || 0));
    }
  }

  const perluDesign = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "design_request");
  const perluKomplain = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "komplain_food_quality");
  const perluFee = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "management_fee");

  const [design, komplain, netBulan, average, netPerusahaan, omsetTigaBulan, averageTrx] = await Promise.all([
    perluDesign ? designRequest(periode) : Promise.resolve(null),
    perluKomplain ? komplainFoodQuality(periode) : Promise.resolve(null),
    perluFee ? netSalesLengkap(periode) : Promise.resolve(null),
    PAKAI_EFISIENSI.includes(posisi) ? averageTigaBulan(periode) : Promise.resolve(null),
    perluNetPerusahaan ? netSalesPerusahaan(periode) : Promise.resolve(null),
    // Omset pembanding Keberhasilan Pasar memakai rentang yang SAMA dengan
    // penjualan menunya: tiga bulan. Membandingkan penjualan tiga bulan dengan
    // omset satu bulan melipatgandakan hasilnya tiga kali tanpa ada yang tahu.
    PAKAI_PASAR.includes(posisi)
      ? netSalesPerusahaan(bulanSebelum(bulanSebelum(periode)), periode)
      : Promise.resolve(null),
    perluAverage ? averageTransaksi(periode) : Promise.resolve(null),
  ]);

  /* --- angka se-area (Coordinator Area) --- */
  const ca = perluArea ? await angkaCa(periode, areaIds, jumlahPic) : null;

  /* --- panel efisiensi --- */
  let efisiensi: LaporanKpi["efisiensi"] = null;
  if (average) {
    const { data } = dbEnabled
      ? await db().from("kpi_efisiensi").select("*").eq("posisi", posisi).eq("periode", periode).eq("pic", pic)
      : { data: [] };
    const isian = new Map<string, { wh: number | null; nonWh: number | null }>();
    for (const r of ((data ?? []) as Record<string, unknown>[])) {
      isian.set(String(r.outlet_id), { wh: angka(r.actual_wh), nonWh: angka(r.actual_non_wh) });
    }
    const baris = outletAktif.map((o) => {
      const avg = (o.esbBranchId ? average.get(o.esbBranchId) : undefined) ?? null;
      return {
        ...barisEfisiensi({
          outletId: o.id,
          outletNama: o.name,
          average: avg,
          actualWh: isian.get(o.id)?.wh ?? null,
          actualNonWh: isian.get(o.id)?.nonWh ?? null,
        }),
        alasan: avg === null ? alasanKosong(o.esbBranchId) : undefined,
      };
    });
    efisiensi = { baris, ringkas: ringkasEfisiensi(baris) };
  }

  /* --- panel keberhasilan pasar --- */
  let pasar: DetailPasar | null = null;
  if (PAKAI_PASAR.includes(posisi)) {
    // Menunya dipilih manual; penjualannya menyusul saat sambungan menu ESB
    // dipasang. Sampai saat itu daftarnya tetap tampil dengan nilai nol,
    // supaya pilihannya sudah bisa disiapkan lebih dulu.
    const { data } = dbEnabled
      ? await db().from("kpi_menu_pasar").select("menu,penjualan,omset").eq("posisi", posisi).eq("periode", periode).eq("pic", pic)
      : { data: [] };
    const rows = (data ?? []) as Record<string, unknown>[];
    const menu = rows.map((m) => ({ menu: String(m.menu), penjualan: Number(m.penjualan) || 0 }));
    // Omsetnya dicatat sekali per bulan; baris mana pun membawanya, jadi yang
    // dipakai baris pertama yang benar-benar terisi.
    // Omset diambil otomatis dari ESB; yang tersimpan di baris menu hanya
    // dipakai bila ESB-nya memang belum punya angkanya.
    const omset = omsetTigaBulan ?? rows.map((m) => Number(m.omset) || 0).find((v) => v > 0) ?? 0;
    const hasil = keberhasilanPasar(menu, omset, 1.5);
    pasar = { baris: hasil.baris, omset: hasil.omset, total: hasil.total, bagianTotal: hasil.bagianTotal };
  }

  /* --- panel management fee --- */
  let fee: DetailFee[] | null = null;
  if (netBulan) {
    const { data } = dbEnabled ? await db().from("kpi_fee").select("*").eq("periode", periode) : { data: [] };
    const ceklis = new Map<string, boolean>();
    for (const r of ((data ?? []) as Record<string, unknown>[])) ceklis.set(String(r.outlet_id), !!r.sesuai);
    fee = outletAktif.map((o) => {
      const net = (o.esbBranchId ? netBulan.get(o.esbBranchId) : undefined) ?? null;
      return {
        outletId: o.id,
        outletNama: o.name,
        netSales: net,
        feeSeharusnya: net === null ? null : net * 0.05,
        sesuai: ceklis.get(o.id) ?? false,
        alasan: net === null ? alasanKosong(o.esbBranchId) : undefined,
      };
    });
  }

  /* --- baris indikator --- */
  const baris = daftar.map((i) => susunBaris(i, {
    pengaturan: pengaturan.get(i.key),
    manual: manual.get(i.key) ?? null,
    lalu: lalu.get(i.key) ?? null,
    jumlahEntri,
    jumlahGagal,
    jumlahBrand: WORK_BRANDS.length,
    jumlahOutlet: outletAktif.length,
    design,
    komplain,
    efisiensi,
    fee,
    pasar,
    netPerusahaan,
    averageTrx,
    ca,
  }));

  return {
    posisi,
    periode,
    pic,
    baris,
    ringkas: ringkasKpi(baris),
    dikunci: !!(kunciRow.data as { dikunci?: boolean } | null)?.dikunci,
    efisiensi,
    pasar,
    fee,
    entri,
    ca,
  };
}

interface KonteksBaris {
  pengaturan?: PengaturanIndikator;
  manual: number | null;
  lalu: number | null;
  jumlahEntri: (j: JenisEntri) => number;
  jumlahGagal: (j: JenisEntri) => number;
  jumlahBrand: number;
  jumlahOutlet: number;
  design: { masuk: number; selesai: number } | null;
  komplain: number | null;
  efisiensi: LaporanKpi["efisiensi"];
  fee: DetailFee[] | null;
  pasar: DetailPasar | null;
  netPerusahaan: number | null;
  averageTrx: AverageTrx | null;
  /** Angka se-area untuk Coordinator Area. Null untuk posisi lain. */
  ca: AngkaCa | null;
}

/**
 * Satu indikator menjadi satu baris tabel.
 *
 * Dipisah dari `laporanKpi` supaya bisa dibaca utuh: seluruh keputusan "target
 * dari mana, actual dari mana" ada di satu tempat, bukan tersebar di antara
 * pemanggilan basis data.
 */
function susunBaris(i: Indikator, k: KonteksBaris): BarisKpi {
  const bobot = k.pengaturan?.bobot ?? i.bobot;

  // Target: pengaturan menimpa bawaan, kecuali untuk target yang memang
  // dihitung (tumbuh, pekerjaan, outlet) — di situ yang bisa disetting adalah
  // persentase pertumbuhannya, bukan angka jadinya.
  const jenis = i.target.jenis === "tumbuh" && k.pengaturan?.pertumbuhan != null
    ? { jenis: "tumbuh" as const, pertumbuhan: k.pengaturan.pertumbuhan }
    : i.target.jenis === "tetap" && k.pengaturan?.target != null
      ? { jenis: "tetap" as const, nilai: k.pengaturan.target, perBrand: i.target.perBrand }
      : i.target.jenis === "rasio" && k.pengaturan?.target != null
        ? { jenis: "rasio" as const, nilai: k.pengaturan.target }
        : i.target;

  // Efisiensi actual-nya sudah berupa capaian 0–100, jadi targetnya 100:
  // "belanja tepat sesuai budget". Keberhasilan Pasar TIDAK begitu — actual-nya
  // bagian penjualan menu terhadap omset (mis. 0,19%) dan targetnya rasio yang
  // ditetapkan (1,50%), persis seperti hitungan di spreadsheet.
  const sudahCapaian = i.actual.sumber === "otomatis" && i.actual.kode === "efisiensi_operasional";

  // Target yang berlaku PER ORANG (40 audit, batas 20 komplain) dikalikan
  // jumlah orang yang tercakup saat "Semua" dipilih. Tanpa ini, gabungan
  // delapan Coordinator Area dibandingkan dengan target satu orang — dan
  // hasilnya selalu terlihat jauh melampaui atau jauh gagal.
  const perOrang = i.key === "hygiene_cctv" || i.key === "komplain_area";
  const pengali = perOrang ? (k.ca?.jumlahPic ?? 1) : 1;

  const target = sudahCapaian ? 100 : hitungTarget(jenis, {
    jumlahBrand: k.jumlahBrand,
    jumlahOutlet: k.jumlahOutlet,
    actualBulanLalu: k.lalu,
    jumlahPekerjaan: i.actual.sumber === "otomatis" && i.actual.kode === "design_request" ? (k.design?.masuk ?? null) : null,
    rataTigaBulan: k.ca?.rataTiga ?? null,
    // Target Net Profit berdiri di atas Gross Sales yang BENAR-BENAR tercapai.
    dasarPorsi: k.ca?.grossSales ?? null,
  });
  const targetAkhir = target === null ? null : target * pengali;

  let actual: number | null = null;
  let alasan: string | undefined;

  // Net Sales Achievement diambil dari ESB, bukan diketik — angkanya sudah ada
  // dan mengetik ulang cuma menambah cara untuk salah.
  if (i.key === "net_sales" && k.netPerusahaan !== null && k.netPerusahaan !== undefined) {
    return barisKpi({
      indikator: i,
      bobot,
      target,
      actual: k.netPerusahaan,
      alasan: target === null ? "Belum ada net sales bulan lalu sebagai dasar target." : undefined,
    });
  }

  switch (i.actual.sumber) {
    case "manual":
    case "manual_brand":
      actual = k.manual;
      if (actual === null) alasan = "Angkanya belum diisi untuk bulan ini.";
      break;
    case "entri":
      actual = k.jumlahEntri(i.actual.entri);
      break;
    case "pengurang":
      actual = actualPengurang(target, k.jumlahGagal(i.actual.entri));
      break;
    case "lulus":
      actual = actualLulus(target, k.jumlahGagal(i.actual.entri));
      break;
    case "otomatis":
      switch (i.actual.kode) {
        case "design_request":
          actual = k.design?.selesai ?? null;
          break;
        case "komplain_food_quality":
          actual = actualPengurang(target, k.komplain ?? 0);
          break;
        case "efisiensi_operasional":
          actual = k.efisiensi?.ringkas.capaian ?? null;
          if (actual === null) alasan = "Realisasi beban operasional belum diisi untuk satu outlet pun.";
          break;
        case "keberhasilan_pasar":
          actual = k.pasar?.bagianTotal ?? null;
          if (actual === null) {
            alasan = "Pilih menu yang dinilai dan isi omset bulan ini lewat tombol Input.";
          }
          break;
        case "management_fee":
          actual = k.fee ? k.fee.filter((f) => f.sesuai).length : null;
          break;
        case "gross_sales_area":
          actual = k.ca?.grossSales ?? null;
          if (actual === null) {
            alasan = areaKosong(k.ca);
          }
          break;
        case "komplain_area":
          actual = k.ca?.komplain ?? null;
          if (actual === null) alasan = "Areanya belum ditentukan untuk orang ini.";
          break;
        case "net_profit_area":
          actual = k.ca?.netProfit ?? null;
          if (actual === null) alasan = "Laba bersih outlet belum diisi lewat Catat Kegiatan.";
          break;
        case "hpp_area":
          actual = k.ca?.hpp ?? null;
          if (actual === null) alasan = "Harga pokok penjualan belum diisi lewat Catat Kegiatan.";
          break;
        case "average_transaction":
          // Bulan yang datanya belum lengkap TIDAK ditampilkan angkanya.
          // Rata-rata dari separuh bulan tetap terlihat seperti angka yang
          // sah — tidak ada yang mencurigainya, dan tidak ada yang akan
          // memeriksanya lagi setelah sisanya masuk.
          if (k.averageTrx === null) {
            alasan = "Jumlah struk bulan ini belum ditarik dari ESB.";
          } else if (k.averageTrx.hariAda < k.averageTrx.hariHarus) {
            alasan = `Baru ${k.averageTrx.hariAda} dari ${k.averageTrx.hariHarus} hari yang tertarik dari ESB — angkanya menunggu lengkap.`;
          } else {
            actual = k.averageTrx.nilai;
          }
          break;
      }
      break;
  }

  if (target === null && !alasan) {
    alasan = i.target.jenis === "tumbuh" ? "Belum ada capaian bulan lalu sebagai dasar target." : "Targetnya belum ditetapkan.";
  }

  return barisKpi({ indikator: i, bobot, target: targetAkhir, actual, alasan });
}

/** Bulan-bulan yang sudah punya jejak, terbaru dulu — pengisi pemilih periode. */
export function daftarPeriodeKpi(sekarang: string, jumlah = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  let p = sekarang;
  for (let i = 0; i < jumlah; i += 1) {
    out.push({ value: p, label: p });
    p = bulanSebelum(p);
  }
  return out;
}

/**
 * Daftar PIC untuk posisi yang PIC-nya datang dari basis data.
 *
 * Coordinator Area berganti jauh lebih sering daripada posisi lain, dan yang
 * disimpan pada tiap angka adalah ID orangnya — bukan namanya. Nama berubah
 * (menikah, salah ketik dibetulkan) dan seluruh riwayat angkanya akan terputus
 * tanpa ada yang menyadarinya; ID tidak pernah berubah.
 */
export { SEMUA_PIC } from "@/lib/kpi/semua-pic";

/**
 * Outlet yang boleh diisi angkanya oleh satu Coordinator Area.
 *
 * Diperiksa DI SERVER saat menyimpan, bukan hanya dibatasi daftarnya di layar:
 * yang dikirim peramban bisa diubah siapa saja, dan satu id outlet yang
 * ditukar berarti laba bersih area orang lain ikut tertimpa.
 */
export function outletMilikPic(pic: string): Set<string> {
  const areaId = getUser(pic)?.areaId ?? "";
  if (!areaId) return new Set();
  return new Set(getOutlets().filter((o) => o.active && o.areaId === areaId).map((o) => o.id));
}

export function picDinamis(posisi: KodePosisi): { value: string; label: string }[] {
  const p = posisiDari(posisi);
  if (p?.picDinamis !== "area_coordinator") return [];
  return getUsers()
    .filter((u) => u.role === "area_coordinator" && u.active !== false)
    .map((u) => ({ value: u.id, label: u.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

export const periodeSekarang = (): string => new Date().toISOString().slice(0, 7);
export { bulanSebelum, posisiDari };
