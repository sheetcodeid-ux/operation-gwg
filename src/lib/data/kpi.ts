import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { getOutlets, getUser, getUsers, semuaTugas } from "./store";
import { listHcRequests } from "./hc-requests";
import { netBulananPerCabang } from "./esb-bulanan";
import { nilaiKetepatanDesign } from "./design-rapor";
import { rincianMinggu, type DetailMinggu } from "./minggu-outlet";
import { hariBulan } from "@/lib/kpi/minggu";
import { WORK_BRANDS } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";
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
  /** Catatan ini berlaku untuk seluruh outlet sekaligus. */
  semuaOutlet: boolean;
  /** Kategori pekerjaannya; kosong untuk jenis catatan yang tidak berkategori. */
  kategori: string;
  judul: string;
  deskripsi: string;
  nominal: number | null;
  nominalSeharusnya: number | null;
  tenggat: string | null;
  /** Tanggal selesai — hanya terisi pada catatan yang punya rentang pengerjaan. */
  selesai: string | null;
  /** Berapa hari pengerjaannya melewati targetnya. */
  hariLewat: number | null;
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
  semuaOutlet: !!r.semua_outlet,
  kategori: String(r.kategori ?? ""),
  judul: String(r.judul ?? ""),
  deskripsi: String(r.deskripsi ?? ""),
  nominal: angka(r.nominal),
  nominalSeharusnya: angka(r.nominal_seharusnya),
  tenggat: (r.tenggat as string | null) ?? null,
  selesai: (r.selesai as string | null) ?? null,
  hariLewat: angka(r.hari_lewat),
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
  // Disimpan sebagai PEMBELIAN OUTLET, bukan sebagai isian milik satu PIC.
  //
  // `posisi` dan `pic` sengaja tidak ikut tersimpan: pembelian warehouse satu
  // outlet tidak berubah tergantung siapa yang dinilai atasnya. Dulu kuncinya
  // (bulan, posisi, pic, outlet) — satu angka harus diketik empat kali supaya
  // Adam, Abil, dan rekannya melihat hal yang sama, dan empat salinan itu bisa
  // berbeda diam-diam.
  const outlet = getOutlets().find((o) => o.id === input.outletId);
  if (!outlet) return { error: "Outlet tidak dikenali." };
  if (!outlet.code?.trim()) return { error: `Outlet "${outlet.name}" belum punya kode — lengkapi dulu di Master Outlet.` };

  const { error } = await db().from("op_purchases").upsert(
    {
      month: input.periode,
      outlet_code: outlet.code,
      outlet_name: outlet.name,
      warehouse: input.actualWh ?? 0,
      non_warehouse: input.actualNonWh ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "month,outlet_code" },
  );
  return error ? { error: error.message } : {};
}

/**
 * Pembelian per outlet satu bulan, berkunci ID OUTLET.
 *
 * Tabelnya berkunci kode outlet — itu yang dipakai halaman Operation dan
 * lembar Excel-nya, karena kode yang bisa dibaca orang jauh lebih berguna di
 * dalam berkas daripada id acak. Pemetaannya dikerjakan di sini, satu kali,
 * supaya sisi KPI tetap bicara dalam id seperti seluruh bagian lain.
 */
export async function pembelianPerOutlet(periode: string): Promise<Map<string, { wh: number | null; nonWh: number | null }>> {
  const peta = new Map<string, { wh: number | null; nonWh: number | null }>();
  if (!dbEnabled) return peta;
  const { data } = await db().from("op_purchases").select("outlet_code,warehouse,non_warehouse").eq("month", periode);
  const idDariKode = new Map(
    getOutlets()
      .filter((o) => o.code?.trim())
      .map((o) => [o.code.trim().toLowerCase(), o.id]),
  );
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    const id = idDariKode.get(String(r.outlet_code ?? "").trim().toLowerCase());
    if (!id) continue; // outlet sudah tidak aktif atau kodenya berubah
    peta.set(id, { wh: angka(r.warehouse), nonWh: angka(r.non_warehouse) });
  }
  return peta;
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
    semua_outlet: input.semuaOutlet,
    kategori: input.kategori,
    judul: input.judul,
    deskripsi: input.deskripsi,
    nominal: input.nominal,
    nominal_seharusnya: input.nominalSeharusnya,
    tenggat: input.tenggat,
    selesai: input.selesai,
    hari_lewat: input.hariLewat,
    gagal: input.gagal,
    lampiran: input.lampiran,
    dibuat_oleh: input.olehId,
    dibuat_nama: input.olehNama,
  });
  return error ? { error: error.message } : { id };
}

/**
 * Satu catatan KPI beserta lampirannya — dipakai rute pembuka berkas.
 *
 * Yang diambil hanya sebatas yang dibutuhkan untuk memeriksa hak akses:
 * posisinya, PIC-nya, dan daftar lampirannya. Rute itu tidak boleh percaya
 * pada jalur berkas yang dikirim peramban; ia harus mencocokkannya dengan
 * lampiran yang benar-benar tercatat pada catatan ini.
 */
export async function entriBerkas(
  id: string,
): Promise<{ posisi: string; pic: string; lampiran: { path: string; name: string }[] } | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("kpi_entri").select("posisi,pic,lampiran").eq("id", id).maybeSingle();
  if (!data) return null;
  return {
    posisi: data.posisi as string,
    pic: (data.pic as string) ?? "",
    lampiran: (data.lampiran as { path: string; name: string }[]) ?? [],
  };
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
  /** Harga pokok penjualan dalam RUPIAH; persentasenya dihitung, bukan diketik. */
  hppNominal: number | null;
}

/** Isian tangan seluruh outlet pada satu bulan. */
async function outletBulanan(periode: string): Promise<Map<string, OutletBulanan>> {
  const peta = new Map<string, OutletBulanan>();
  if (!dbEnabled) return peta;
  const { data } = await db().from("kpi_outlet_bulanan").select("outlet_id,gross,net_profit,hpp_nominal").eq("periode", periode);
  for (const r of ((data ?? []) as Record<string, unknown>[])) {
    peta.set(String(r.outlet_id), {
      outletId: String(r.outlet_id),
      gross: angka(r.gross),
      netProfit: angka(r.net_profit),
      hppNominal: angka(r.hpp_nominal),
    });
  }
  return peta;
}

/**
 * Gross yang DIKETIK per outlet pada satu bulan.
 *
 * Dipakai halaman lain yang harus memakai angka yang sama begitu sebuah bulan
 * dinyatakan manual. Tanpa ini, satu bulan yang sama bisa bernilai lain di dua
 * halaman — dan yang membacanya tidak punya cara tahu mana yang benar.
 */
export async function grossKetikBulan(periode: string): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  for (const [id, r] of await outletBulanan(periode)) {
    if (r.gross !== null) peta.set(id, r.gross);
  }
  return peta;
}

/**
 * Menyimpan angka bulanan satu outlet — HANYA kolom yang benar-benar dikirim.
 *
 * Sebelumnya ketiga kolom selalu ditulis, dan yang tidak dikirim ikut ditulis
 * NULL. Akibatnya menyimpan Net Profit MENGHAPUS Harga Pokok dan Gross manual
 * yang sudah diisi sebelumnya — tanpa satu pun peringatan, dan baru ketahuan
 * saat formnya dibuka lagi dan isinya sudah berbeda.
 *
 * `undefined` berarti "jangan disentuh"; `null` berarti "kosongkan". Keduanya
 * harus bisa dibedakan, kalau tidak, mengosongkan satu angka menjadi mustahil.
 */
export async function simpanOutletBulanan(input: {
  outletId: string;
  periode: string;
  gross?: number | null;
  netProfit?: number | null;
  hppNominal?: number | null;
  olehId: string;
  olehNama: string;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Penyimpanan belum aktif." };
  const baris: Record<string, unknown> = {
    outlet_id: input.outletId,
    periode: input.periode,
    diubah_oleh: input.olehId,
    diubah_nama: input.olehNama,
    diubah_pada: new Date().toISOString(),
  };
  if (input.gross !== undefined) baris.gross = input.gross;
  if (input.netProfit !== undefined) baris.net_profit = input.netProfit;
  if (input.hppNominal !== undefined) baris.hpp_nominal = input.hppNominal;

  const { error } = await db().from("kpi_outlet_bulanan").upsert(baris);
  return error ? { error: error.message } : {};
}

/* ─────────────────────── angka se-area Coordinator Area ─────────────────────── */

/** Outlet yang dinilai, beserta cabang ESB-nya. */
interface OutletCa {
  id: string;
  nama: string;
  branch: string | null;
  /** Penjualannya diisi tangan — pindahan dari POS lain. */
  grossManual: boolean;
  /** Bulan pertama angka ESB-nya boleh dipercaya; sebelum itu diabaikan. */
  esbMulai: string | null;
  /** Tanggal outlet mulai berjalan, mis. "2026-05-31". Kosong = belum diketahui. */
  bukaTanggal: string | null;
  /** Bulan-bulan yang angka ESB-nya diabaikan; penjualannya diisi tangan. */
  esbAbaikan: string[];
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
/**
 * Bulan ini penjualannya HARUS diketik, bukan diambil dari ESB.
 *
 * Dua bentuk, karena dua keadaan yang berbeda:
 *
 *  • `esbMulai` — satu GARIS BATAS. Outlet pindahan POS Majoo tidak punya
 *    riwayat di ESB sebelum migrasinya, tapi ESB tetap memuat ratusan juta di
 *    bulan-bulan itu: bukan nol, bukan kosong, jadi tidak ada satu pun tanda
 *    bahwa angkanya salah. Seluruh bulan sebelum batas itu diketik.
 *
 *  • `esbAbaikan` — CELAH DI TENGAH. Nordu Landak angkanya wajar pada Mei dan
 *    Agustus tapi belasan juta pada Juni dan Juli. Menandainya dengan garis
 *    batas akan ikut membuang Mei beserta seluruh bulan sebelumnya yang benar,
 *    dan memaksa mengetik ulang bulan yang tidak pernah bermasalah.
 *
 * Bulan yang tidak disebut keduanya tetap otomatis.
 */
export function grossDiketik(o: { esbMulai: string | null; esbAbaikan: string[] }, periode: string): boolean {
  if (o.esbMulai && periode < o.esbMulai) return true;
  return o.esbAbaikan.includes(periode);
}

function grossOutlet(
  o: OutletCa,
  periode: string,
  esb: Map<string, { net: number }>,
  tangan: Map<string, OutletBulanan>,
): number | null {
  const manual = tangan.get(o.id)?.gross ?? null;

  // Bulan yang ditandai: HANYA angka ketikan yang dipakai. Kalau belum diisi,
  // hasilnya kosong — bukan angka ESB, karena angka itulah yang sedang
  // dinyatakan salah.
  if (grossDiketik(o, periode)) return manual;

  // NOL DARI ESB BUKAN "penjualannya nol", melainkan "cabang ini belum ada di
  // bulan itu". ESB tetap membalas untuk cabang yang belum buka, dan balasannya
  // nol — jadi barisnya selalu tersimpan. Kalau nol dianggap angka yang sah,
  // outlet yang belum buka lolos aturan tiga bulan dengan penjualan nol dan
  // menyeret rata-rata seluruh area ke bawah.
  const dariEsb = o.branch ? esb.get(o.branch)?.net : undefined;
  if (dariEsb !== undefined && dariEsb > 0) return dariEsb;
  // Angka ketikan tetap dipakai bila ESB tidak punya apa-apa untuk bulan itu.
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

/**
 * Tanggal paling akhir dalam sebulan yang masih membuat bulan itu terhitung
 * sebagai bulan berjalan.
 *
 * Outlet yang buka tanggal 31 berjalan SATU HARI di bulan itu. Menghitungnya
 * sebagai satu bulan penuh membuatnya dinilai sebulan lebih awal daripada
 * seharusnya — dan bulan pertama outlet baru adalah bulan yang paling tidak
 * mewakili apa pun. Batas di tengah bulan dipilih karena satu-satunya yang
 * bisa dijelaskan tanpa kalender: bulan itu terhitung kalau outletnya buka
 * setidaknya separuh bulan.
 */
const TANGGAL_BATAS_BUKA = 15;

/**
 * Bulan pertama yang terhitung sebagai bulan berjalan bagi satu outlet.
 *
 * Buka 12 Mei → Mei terhitung. Buka 31 Mei → Mei TIDAK terhitung, hitungannya
 * mulai Juni. Null bila tanggal bukanya belum diketahui.
 */
export function bulanMulaiBerjalan(bukaTanggal: string | null): string | null {
  if (!bukaTanggal) return null;
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(bukaTanggal);
  if (!cocok) return null;
  const [, th, bl, tg] = cocok;
  const bulan = `${th}-${bl}`;
  return Number(tg) <= TANGGAL_BATAS_BUKA ? bulan : bulanSetelah(bulan);
}

/**
 * Outlet ini sudah genap tiga bulan berjalan sebelum `periode`?
 *
 * DUA CARA, dan yang pertama menang bila datanya ada. Tanggal buka adalah
 * jawaban yang sebenarnya; ada-tidaknya penjualan hanyalah tebakan yang
 * dipakai selama tanggalnya belum diisi — dan tebakan itulah yang meloloskan
 * outlet yang buka di akhir bulan.
 */
function sudahTigaBulan(o: OutletCa, periode: string, nilaiTigaBulan: (number | null)[]): boolean {
  const mulai = bulanMulaiBerjalan(o.bukaTanggal);
  if (mulai) {
    // Tiga bulan penuh SEBELUM bulan yang dinilai: bulan mulainya harus sudah
    // lewat atau sama dengan bulan paling awal di antara ketiganya.
    return mulai <= tigaBulanSebelum(periode)[2];
  }
  return nilaiTigaBulan.every(berjalan);
}


/**
 * Laju pertumbuhan target Gross Sales Coordinator Area, DIBACA DARI
 * indikatornya sendiri — bukan angka 15 yang ditulis ulang di sini.
 *
 * Target mingguan harus memakai laju yang sama persis dengan target bulanan.
 * Ditulis ulang, keduanya akan berbeda begitu salah satunya diubah, dan satu
 * outlet terbaca gagal di tab mingguan tapi tercapai di indikator bulanannya —
 * tanpa satu pun tanda bahwa dua angka itu memang tidak sepakat.
 */
const tumbuhCa = (): number => {
  const t = indikatorPosisi("operational_ca").find((i) => i.key === "gross_sales")?.target;
  return t && t.jenis === "avg3" ? t.pertumbuhan : 0;
};

export interface DetailOutletCa {
  outletId: string;
  outletNama: string;
  /** Cabang ESB-nya; kosong berarti tidak punya rincian mingguan. */
  cabang: string | null;
  /** Gross sales bulan ini; null = belum ada dari mana pun. */
  gross: number | null;
  /** Angkanya dari ESB — kalau ya, isian tangan tidak dipakai dan tidak perlu. */
  dariEsb: boolean;
  /**
   * Penjualan yang BENAR-BENAR diketik untuk bulan ini, tanpa cadangan ESB.
   *
   * `gross` di atas adalah angka yang akhirnya dipakai — bisa datang dari ESB.
   * Kotak isian harus memakai yang ini: mengisinya dengan angka ESB membuat
   * angka yang tidak pernah diketik siapa pun ikut tersimpan sebagai isian
   * tangan pada penyimpanan pertama.
   */
  grossKetik: number | null;
  netProfit: number | null;
  /** Harga pokok penjualan dalam rupiah. */
  hppNominal: number | null;
  /** Penjualannya diisi tangan — hanya outlet inilah yang muncul di form gross manual. */
  grossManual: boolean;
  /**
   * Bulan INI penjualannya harus diketik.
   *
   * Berbeda dari `grossManual`, yang berlaku untuk outletnya secara
   * keseluruhan. Nordu Landak hanya perlu diketik pada Juni dan Juli; pada
   * Agustus angkanya sudah benar dan harus tetap otomatis.
   */
  grossTangan: boolean;
  /** Rata-rata gross sales tiga bulan SEBELUM bulan ini — dasar targetnya. */
  average: number | null;
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
  /** Outlet yang IKUT dinilai tapi penjualan bulan ini belum ada — merekalah
   *  yang menahan total se-area. Disebut namanya supaya bisa langsung diisi. */
  tanpaGross: string[];
  grossSales: number | null;
  rataTiga: number | null;
  komplain: number | null;
  netProfit: number | null;
  hpp: number | null;
  /** Harga pokok dalam RUPIAH, dan penjualan yang jadi pembaginya. Dipakai
   *  grafik mode Angka: "37,4%" tidak bisa dibandingkan dengan rupiah. */
  hppNominal: number | null;
  hppDasar: number | null;
  /**
   * Rincian minggu demi minggu outlet-outlet area ini.
   *
   * Persis bentuk yang dipakai KPI Manajemen, hanya outletnya yang dibatasi ke
   * area orang itu — pertanyaannya sama, dan yang memegang area justru paling
   * butuh tahu outlet mana yang tertinggal saat bulannya masih bisa dikejar.
   */
  minggu: DetailMinggu | null;
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
async function angkaCa(periode: string, picIds: string[], jumlahPic: number): Promise<AngkaCa> {
  const semua = outletCa(picIds);

  const bulanLalu = tigaBulanSebelum(periode);
  const [esbIni, tanganIni, ...riwayat] = await Promise.all([
    netBulananPerCabang(periode),
    outletBulanan(periode),
    ...bulanLalu.map((b) => Promise.all([netBulananPerCabang(b), outletBulanan(b)])),
  ]);

  const nilaiBulan = (o: OutletCa, n: number): number | null =>
    grossOutlet(o, bulanLalu[n], riwayat[n][0], riwayat[n][1]);

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
    if (!sudahTigaBulan(o, periode, tiga)) {
      belum.push(o);
      continue;
    }
    lolos.push(o);
    // Rata-ratanya tetap dari angka yang benar-benar ada. Outlet yang lolos
    // lewat tanggal buka tapi satu bulannya belum tertarik dari ESB dihitung
    // dari bulan yang ada saja — nol untuk bulan yang kosong akan menyeret
    // dasar targetnya turun sepertiga.
    const ada = tiga.filter((v): v is number => v !== null && v > 0);
    if (ada.length > 0) rata.set(o.id, ada.reduce((a, b) => a + b, 0) / ada.length);
  }

  // Gross sales bulan ini. Satu outlet yang lolos tapi angkanya belum ada
  // membuat totalnya BELUM UTUH — ditahan, bukan ditampilkan kurang.
  const grossPerOutlet = lolos.map((o) => grossOutlet(o, periode, esbIni, tanganIni));
  const tanpaGross = lolos.filter((_, n) => grossPerOutlet[n] === null).map((o) => o.nama);
  // Tanpa satu pun outlet yang lolos, hasilnya BUKAN nol melainkan belum ada.
  // Nol berarti "sudah dihitung, hasilnya nihil" — tuduhan yang berbeda dari
  // "belum ada outlet yang bisa dinilai", dan keduanya pernah tampil berbeda:
  // Gross Sales menulis Rp 0 sementara Net Profit menulis tanda pisah.
  const grossSales =
    lolos.length === 0 || grossPerOutlet.some((v) => v === null)
      ? null
      : grossPerOutlet.reduce((a: number, b) => a + (b ?? 0), 0);

  const rataTiga = lolos.length === 0 ? null : lolos.reduce((a, o) => a + (rata.get(o.id) ?? 0), 0);

  const netProfitPer = lolos.map((o) => tanganIni.get(o.id)?.netProfit ?? null);
  const netProfit =
    lolos.length === 0 || netProfitPer.every((v) => v === null)
      ? null
      : netProfitPer.reduce((a: number, b) => a + (b ?? 0), 0);

  // HPP se-area = TOTAL harga pokok dibagi TOTAL penjualan. Karena yang
  // disimpan nominal, ini rasio yang sebenarnya — bukan rata-rata persen, yang
  // membuat outlet terkecil sama beratnya dengan outlet terbesar dan tidak
  // pernah cocok dengan laporan keuangan.
  let totalHpp = 0;
  let totalGrossHpp = 0;
  let adaHpp = false;
  lolos.forEach((o, n) => {
    const h = tanganIni.get(o.id)?.hppNominal;
    const g = grossPerOutlet[n];
    if (h === null || h === undefined || g === null || g <= 0) return;
    adaHpp = true;
    totalHpp += h;
    totalGrossHpp += g;
  });
  const hpp = adaHpp && totalGrossHpp > 0 ? (totalHpp / totalGrossHpp) * 100 : null;
  const hppNominal = adaHpp ? totalHpp : null;
  const hppDasar = adaHpp && totalGrossHpp > 0 ? totalGrossHpp : null;

  const komplain = await komplainOutlet(periode, lolos.map((o) => o.id));

  const detail: DetailOutletCa[] = semua.map((o) => {
    // "Dari ESB" berarti ESB punya angka yang BUKAN nol. Nol berarti cabangnya
    // belum ada di sana, dan justru itulah yang perlu diisi tangan.
    const dariEsb = !!(o.branch && !grossDiketik(o, periode) && (esbIni.get(o.branch)?.net ?? 0) > 0);
    return {
      outletId: o.id,
      outletNama: o.nama,
      cabang: o.branch,
      gross: grossOutlet(o, periode, esbIni, tanganIni),
      dariEsb,
      grossKetik: tanganIni.get(o.id)?.gross ?? null,
      netProfit: tanganIni.get(o.id)?.netProfit ?? null,
      hppNominal: tanganIni.get(o.id)?.hppNominal ?? null,
      grossManual: o.grossManual,
      grossTangan: grossDiketik(o, periode),
      average: rata.get(o.id) ?? null,
      ikut: lolos.some((l) => l.id === o.id),
    };
  });

  // Rincian mingguan area ini. TARGETNYA TARGET OUTLET ITU SENDIRI — rata-rata
  // tiga bulannya + pertumbuhan yang sama dengan indikator Gross Sales, supaya
  // satu outlet tidak terlihat gagal di tab mingguan dan tercapai di indikator
  // bulanannya. Outlet yang belum genap tiga bulan tetap ditampilkan tapi tanpa
  // target: ia memang belum dinilai, dan memberinya target berarti menghukum
  // outlet yang baru buka.
  const minggu = await rincianMinggu(
    periode,
    detail.map((d) => ({
      id: d.outletId,
      nama: d.outletNama,
      cabang: d.cabang,
      targetBulan: d.ikut && d.average !== null ? d.average * (1 + tumbuhCa() / 100) : 0,
      manual: d.grossTangan,
    })),
    hariBulan(periode),
  );

  return { outlet: lolos, detail, belumTigaBulan: belum, bulanKosong, tanpaGross, grossSales, rataTiga, komplain, netProfit, hpp, hppNominal, hppDasar, jumlahPic, minggu };
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
  // TIGA BULAN SEBELUMNYA, bukan termasuk bulan yang sedang dinilai. Ikut
  // menghitung bulan berjalan membuat patokannya bergerak tiap hari — dan yang
  // dinilai mengejar angka yang berubah karena capaiannya sendiri. Aturannya
  // sama dengan Gross Sales Coordinator Area: untuk Juli, yang dipakai April,
  // Mei, Juni.
  const bulan = tigaBulanSebelum(periode);
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
  if (ca === null) return "Belum ada outlet yang ditugaskan ke orang ini.";
  if (ca.detail.length === 0) return "Belum ada outlet yang ditugaskan — atur di User Management.";
  if (ca.bulanKosong.length > 0) {
    return `Angka ESB ${ca.bulanKosong.map(labelBulanSingkat).join(", ")} belum ditarik — pembanding tiga bulannya belum lengkap.`;
  }
  if (ca.outlet.length === 0) {
    return `Belum ada outlet yang genap tiga bulan berjalan — ${ca.detail.length} outlet di area ini semuanya masih baru.`;
  }
  // OUTLETNYA DISEBUT NAMANYA. "Sebagian outlet belum ditarik" benar tapi tidak
  // bisa ditindaklanjuti: yang membacanya tidak punya cara tahu outlet mana,
  // dan total se-area berhenti muncul tanpa ada yang tahu apa yang harus diisi.
  if (ca.tanpaGross.length > 0) {
    const daftar = ca.tanpaGross.slice(0, 3).join(", ");
    const sisa = ca.tanpaGross.length > 3 ? ` dan ${ca.tanpaGross.length - 3} outlet lain` : "";
    return `Penjualan ${daftar}${sisa} bulan ini belum ada — totalnya ditahan supaya tidak tampil kurang.`;
  }
  return "Angka ESB sebagian outlet di area ini belum ditarik — angkanya ditahan supaya tidak tampil kurang.";
};

/**
 * Kenapa satu angka bulanan per outlet belum ada.
 *
 * Dibedakan tegas: TIDAK ADA outlet yang dinilai bukan hal yang sama dengan
 * angkanya belum diisi. Yang pertama tidak bisa diperbaiki dengan mengisi apa
 * pun, dan menyuruh orang mengisi sesuatu yang tidak akan mengubah apa-apa
 * adalah cara tercepat membuat pesan di layar berhenti dipercaya.
 */
const alasanAngkaOutlet = (ca: AngkaCa | null, apa: string): string =>
  ca === null || ca.outlet.length === 0 ? areaKosong(ca) : `${apa} belum diisi untuk satu outlet pun bulan ini.`;

const NAMA_BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const labelBulanSingkat = (periode: string): string => {
  const [th, bl] = periode.split("-");
  return `${NAMA_BULAN_SINGKAT[Number(bl) - 1] ?? bl} ${th}`;
};

const alasanKosong = (esbBranchId: string | null | undefined): string =>
  esbBranchId ? "angka ESB bulan ini belum ditarik" : "outlet belum dipasangkan ke cabang ESB";


/**
 * Tugas Work Tracker yang SELESAI pada bulan itu, milik PIC posisi ini.
 *
 * Dicocokkan lewat NAMA PIC yang terdaftar pada posisinya, bukan lewat peran.
 * Tidak ada peran tersendiri untuk Coordinator Software — ia dan tiga rekannya
 * sama-sama berperan `member` di departemen Operational — sehingga peran tidak
 * bisa membedakan pekerjaan siapa yang sedang dinilai. Nama PIC sudah menjadi
 * identitas yang dipakai seluruh modul KPI untuk posisi non-dinamis, jadi ini
 * bukan kelemahan baru melainkan kunci yang sama.
 *
 * Mengembalikan null bila nama PIC-nya tidak ketemu satu pun pengguna: nol
 * berarti "tidak ada yang diselesaikan", dan itu penilaian yang jauh berbeda
 * dari "namanya tidak cocok dengan siapa pun". Yang pertama menghukum orangnya,
 * yang kedua menyuruh admin membetulkan datanya.
 */
function tugasSelesai(posisi: KodePosisi, periode: string): number | null {
  const nama = (posisiDari(posisi)?.pic ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (nama.length === 0) return null;
  const orang = new Set(
    getUsers()
      .filter((u) => nama.includes((u.name ?? "").trim().toLowerCase()))
      .map((u) => u.id),
  );
  if (orang.size === 0) return null;
  return semuaTugas().filter((t) => {
    if (t.status !== "done") return false;
    if (!t.picIds.some((id) => orang.has(id))) return false;
    // Tanggal selesainya yang menentukan bulan. Baris lama yang belum punya
    // tanggal selesai memakai tenggatnya — perkiraan terbaik yang ada, dan
    // jauh lebih dekat daripada tanggal dibuatnya.
    const tanggal = t.completionDate || t.dueDate;
    return typeof tanggal === "string" && tanggal.slice(0, 7) === periode;
  }).length;
}

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
  // HARI yang tercatat, bukan jumlah barisnya. Monitoring yang dicatat dua kali
  // pada tanggal yang sama tetap satu hari yang termonitor — menghitungnya dua
  // kali membuat uptime tembus 100% tanpa satu hari tambahan pun dipantau.
  const hariTercatat = (jenis: JenisEntri) =>
    new Set(entri.filter((e) => e.jenis === jenis).map((e) => e.tanggal)).size;
  const problemSolver = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "problem_solver_data")
    ? tugasSelesai(posisi, periode)
    : null;

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
  const gabungan = pic === SEMUA_PIC;
  // Penugasan outlet tidak pernah bertumpuk — halaman User Management menyembunyikan
  // outlet yang sudah dipegang koordinator lain — jadi gabungannya cukup
  // disatukan tanpa takut terhitung dua kali.
  const picIds = !perluArea ? [] : gabungan ? semuaPic.map((o) => o.value) : [pic];
  // Yang dihitung hanya Coordinator Area yang benar-benar memegang outlet.
  // Menyertakan yang belum ditugaskan menaikkan target per orang tanpa
  // menambah satu pun outlet yang dinilai.
  const jumlahPic = gabungan
    ? Math.max(1, semuaPic.filter((o) => (getUser(o.value)?.outletIds ?? []).length > 0).length)
    : 1;

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
  const perluKetepatan = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "ketepatan_design");
  const perluKomplain = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "komplain_food_quality");
  const perluFee = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "management_fee");
  // Keenam angka Human Capital datang dari SATU perhitungan — menariknya enam
  // kali berarti enam kali membaca Kontrak Tracker untuk hasil yang sama.
  const perluHc = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode.startsWith("hc_"));

  const [design, ketepatan, komplain, netBulan, average, netPerusahaan, omsetTigaBulan, averageTrx, hc] = await Promise.all([
    perluDesign ? designRequest(periode) : Promise.resolve(null),
    // Ketepatan dinilai PER ORANG saat posisinya dinilai per orang: yang
    // dihitung pekerjaan yang ditugaskan kepadanya, bukan seluruh antrian.
    perluKetepatan ? nilaiKetepatanDesign(periode, pic && pic !== SEMUA_PIC ? pic : undefined) : Promise.resolve(null),
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
    perluHc ? angkaHc(periode) : Promise.resolve(null),
  ]);

  /* --- angka se-area (Coordinator Area) --- */
  const ca = perluArea ? await angkaCa(periode, picIds, jumlahPic) : null;

  /* --- panel efisiensi --- */
  let efisiensi: LaporanKpi["efisiensi"] = null;
  if (average) {
    // DIBACA DARI PEMBELIAN OPERATION, bukan dari salinan milik tiap PIC.
    //
    // Pembelian warehouse dan non-warehouse satu outlet adalah angka outlet
    // itu — sama bagi Adam, Abil, dan siapa pun di PDQ yang membutuhkannya.
    // Disimpan per PIC, satu angka harus diketik ulang untuk tiap orang, dan
    // empat salinan yang bisa berbeda diam-diam adalah cara paling pasti untuk
    // membuat dua staf dinilai atas angka yang berbeda untuk outlet yang sama.
    const isian = await pembelianPerOutlet(periode);
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
    hc,
    pengaturan: pengaturan.get(i.key),
    manual: manual.get(i.key) ?? null,
    lalu: lalu.get(i.key) ?? null,
    jumlahEntri,
    jumlahGagal,
    hariTercatat,
    hariBulan: hariBulan(periode),
    problemSolver,
    jumlahBrand: WORK_BRANDS.length,
    jumlahOutlet: outletAktif.length,
    design,
    ketepatan,
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
  /** Jumlah HARI berbeda yang punya catatan jenis itu. */
  hariTercatat: (j: JenisEntri) => number;
  /** Jumlah hari bulan yang sedang dihitung. */
  hariBulan: number;
  /** Tugas Work Tracker yang selesai bulan itu. Null = posisinya tidak menilainya. */
  problemSolver: number | null;
  jumlahBrand: number;
  jumlahOutlet: number;
  design: { masuk: number; selesai: number } | null;
  ketepatan: { nilai: number; dinilai: number } | null;
  komplain: number | null;
  efisiensi: LaporanKpi["efisiensi"];
  fee: DetailFee[] | null;
  pasar: DetailPasar | null;
  netPerusahaan: number | null;
  averageTrx: AverageTrx | null;
  /** Angka se-area untuk Coordinator Area. Null untuk posisi lain. */
  ca: AngkaCa | null;
  /** Keenam angka Human Capital, dikunci nama indikatornya. */
  hc: Map<string, number | null> | null;
}


/**
 * Keenam angka KPI Human Capital, DIBACA DARI PERHITUNGAN YANG SUDAH ADA.
 *
 * Bukan dihitung ulang di sini. Rumusnya tinggal di modul HC-MOS bersama data
 * yang dibacanya, dan halaman KPI hanya meminjam hasilnya — kalau dihitung dua
 * kali, dua halaman akan menyebut skor berbeda untuk departemen yang sama dan
 * tidak ada cara tahu mana yang benar.
 *
 * Dilihat sebagai SUPER ADMIN, bukan sebagai yang membuka halamannya. Kepatuhan
 * kontrak dan turnover dihitung dari seluruh outlet; kalau dibatasi outlet
 * milik pembacanya, dua orang HC akan melihat skor departemen yang berbeda.
 */
async function angkaHc(periode: string): Promise<Map<string, number | null>> {
  const peta = new Map<string, number | null>();
  try {
    const { hitungKpiHc } = await import("./hcmos-kpi");
    const hasil = await hitungKpiHc({ role: "super_admin" } as UserProfile, periode);
    for (const b of hasil.baris) peta.set(`hc_${b.key}`, b.realisasi);
  } catch (e) {
    console.error("[kpi] gagal membaca angka Human Capital:", e);
  }
  return peta;
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

  switch (i.actual.sumber) {
    case "manual":
    case "manual_brand":
      actual = k.manual;
      if (actual === null) {
        // INDIKATOR YANG MENGHITUNG KEJADIAN BURUK: tidak ada catatan berarti
        // tidak ada kejadian — bukan belum diukur.
        //
        // Tidak seorang pun mengetik "0 komplain"; bulan yang bersih justru
        // bulan yang kotaknya dibiarkan kosong. Diperlakukan sebagai belum
        // terukur, bulan tanpa satu pun komplain akan mengeluarkan indikator
        // itu dari skor — dan yang bekerja paling bersih kehilangan bobotnya
        // sendiri. Dikenali dari cara penilaiannya, bukan dari daftar nama
        // indikator: `kurang_linear` berarti targetnya titik nol dan tiap
        // kejadian mengurangi, jadi kosong memang berarti nol.
        if (i.penilaian === "kurang_linear") actual = 0;
        else alasan = "Angkanya belum diisi untuk bulan ini.";
      }
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
    case "harian":
      // Porsi hari, bukan jumlah baris: satu hari pada bulan 31 hari bernilai
      // 3,23% dan pada Februari bernilai 3,57%. Ditulis sebagai angka tetap,
      // bulan pendek akan selalu terlihat gagal dan bulan panjang akan
      // menembus seratus persen tanpa ada yang bekerja lebih keras.
      actual = k.hariBulan === 0 ? null : (k.hariTercatat(i.actual.entri) / k.hariBulan) * 100;
      break;
    case "otomatis":
      switch (i.actual.kode) {
        case "design_request":
          actual = k.design?.selesai ?? null;
          break;
        case "komplain_food_quality":
          actual = actualPengurang(target, k.komplain ?? 0);
          break;
        case "problem_solver_data":
          actual = k.problemSolver;
          if (actual === null) alasan = "Nama PIC posisi ini belum cocok dengan pengguna mana pun di User Management.";
          break;
        case "hc_pemenuhan_rekrutmen":
        case "hc_kecepatan_rekrutmen":
        case "hc_kepatuhan_kontrak":
        case "hc_kepatuhan_laporan":
        case "hc_penyelesaian_onboarding":
        case "hc_turnover": {
          // `undefined` berarti perhitungannya gagal dibaca; `null` berarti
          // datanya memang belum ada. Keduanya sama-sama kosong di layar, tapi
          // hanya yang kedua yang punya kalimat penjelas — yang pertama sudah
          // tercatat di log server sebagai kesalahan.
          const nilai = k.hc?.get(i.actual.kode);
          actual = nilai ?? null;
          if (actual === null) alasan = "Datanya belum ada di modul Human Capital untuk bulan ini.";
          break;
        }
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
          if (actual === null) alasan = "Belum ada outlet yang ditugaskan ke orang ini.";
          break;
        case "net_profit_area":
          actual = k.ca?.netProfit ?? null;
          if (actual === null) alasan = alasanAngkaOutlet(k.ca, "Laba bersih");
          break;
        case "hpp_area":
          actual = k.ca?.hpp ?? null;
          if (actual === null) alasan = alasanAngkaOutlet(k.ca, "Harga pokok penjualan");
          break;
        case "ketepatan_design": {
          // Skala 0–100 dari nilai rata-rata tiap permintaan. Nol berarti
          // "seimbang": tidak ada yang terlambat pada tenggat longgar, dan
          // tidak ada nilai tambah dari tenggat mendesak yang ditepati.
          // Rentangnya −3 sampai +3, jadi titik tengahnya 50.
          if (!k.ketepatan) {
            alasan = "Belum ada permintaan desain yang selesai atau lewat tenggat bulan ini.";
            break;
          }
          const rata = k.ketepatan.nilai / k.ketepatan.dinilai;
          actual = Math.max(0, Math.min(100, 50 + (rata / 3) * 50));
          break;
        }
        case "net_sales_korporat":
          // Net Sales Achievement diambil dari ESB, bukan diketik — angkanya
          // sudah ada dan mengetik ulang cuma menambah cara untuk salah.
          actual = k.netPerusahaan ?? null;
          if (actual === null) alasan = "Net sales bulan ini belum ditarik dari ESB.";
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

  // Harga Pokok Penjualan dinilai dalam persen, tapi yang diisi orang dan yang
  // tertulis di laporan keuangan adalah rupiahnya — dibawa serta supaya grafik
  // mode Angka punya angka yang benar-benar angka.
  const nominal =
    i.key === "hpp" && k.ca
      ? {
          actualNominal: k.ca.hppNominal,
          targetNominal:
            k.ca.hppDasar === null || targetAkhir === null ? null : (k.ca.hppDasar * targetAkhir) / 100,
        }
      : {};

  return barisKpi({ indikator: i, bobot, target: targetAkhir, actual, alasan, ...nominal });
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
  return new Set(outletCa([pic]).map((o) => o.id));
}

/** Seluruh outlet yang dipegang Coordinator Area mana pun — untuk pilihan "Semua". */
export function outletSeluruhPic(posisi: string): Set<string> {
  return new Set(outletCa(picDinamis(posisi as KodePosisi).map((o) => o.value)).map((o) => o.id));
}

/**
 * Outlet yang dipegang Coordinator Area — dari PENUGASANNYA, bukan dari area.
 *
 * SUMBERNYA `users.outlet_ids`, yang diisi di halaman User Management
 * ("Wilayah / Outlet Ditugaskan"). Sempat diambil dari `outlets.area_id`, dan
 * hasilnya salah untuk hampir semua orang: Wika mendapat sepuluh outlet
 * "Belum Ditentukan" alih-alih sebelas outlet yang benar-benar dipegangnya,
 * dan Reynaldi mendapat sebelas outlet Area Poetri padahal ditugaskan dua.
 *
 * Yang membuatnya berbahaya: daftarnya tetap masuk akal di layar — berisi nama
 * outlet sungguhan, dengan angka penjualan sungguhan. Tidak ada satu pun tanda
 * bahwa yang dinilai bukan outlet orang itu.
 *
 * `outlets.area_id` dibiarkan untuk modul lain yang memakainya; yang berubah
 * hanya dari mana KPI mengambilnya.
 */
function outletCa(picIds: string[]): OutletCa[] {
  const ditugaskan = new Set<string>();
  for (const p of picIds) for (const id of getUser(p)?.outletIds ?? []) ditugaskan.add(id);
  return getOutlets()
    .filter((o) => o.active && ditugaskan.has(o.id))
    .map((o) => ({
      id: o.id,
      nama: o.name,
      branch: o.esbBranchId ?? null,
      grossManual: !!o.grossManual,
      esbMulai: o.esbMulai ?? null,
      bukaTanggal: o.bukaTanggal ?? null,
      esbAbaikan: o.esbAbaikan ?? [],
    }));
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
