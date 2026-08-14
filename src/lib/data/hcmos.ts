import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getAreas, getOutlets, getUsers, userName } from "./store";
import { scopeOutlets } from "../rbac";
import {
  brandOutlet,
  bulanKeluar,
  periodeKey,
  statusKontrak,
  type Brand,
  type JenisKontrak,
  type PrioritasRenewal,
  type StatusKontrak,
} from "@/lib/hcmos/kontrak";
import type { UserProfile } from "@/lib/types";

/**
 * Lapisan data HC-MOS.
 *
 * Dua sumber, dan keduanya sudah ada — tidak ada daftar karyawan baru yang
 * ditulis tangan di sini:
 *
 *  • Manajemen (GWG) — dari User Management (tabel `users`). Itulah satu-satunya
 *    daftar orang di sistem ini; menyalinnya ke tabel HC sendiri berarti dua
 *    daftar yang akan mulai berbeda begitu ada satu penambahan yang lupa
 *    dikerjakan di salah satunya.
 *  • Outlet — dari `outlets` (nama, area, supervisor) digabung `hc_contracts`
 *    (karyawan & kontraknya).
 *
 * Semua kueri disaring memakai outlet yang boleh dilihat pengguna. Supervisor
 * hanya melihat outletnya sendiri tanpa perlu portal login terpisah — ia sudah
 * masuk sebagai dirinya.
 */

export interface KontrakRow {
  id: string;
  outletId: string;
  outletName: string;
  outletCode: string;
  brand: Brand | null;
  nip: string | null;
  nama: string;
  jabatan: string | null;
  noKontrak: string | null;
  jenis: JenisKontrak | null;
  tglMulai: string | null;
  tglBerakhir: string | null;
  kontrakKe: number;
  prioritasRenewal: PrioritasRenewal;
  linkKontrak: string | null;
  linkKtp: string | null;
  linkFoto: string | null;
  catatan: string | null;
  tglMasukPertama: string | null;
  tglResign: string | null;
  kategoriTurnover: string | null;
  alasanKeluar: string | null;
  /** Dihitung, tidak disimpan. */
  status: StatusKontrak;
  /** Sudah keluar — dikeluarkan dari hitungan karyawan aktif. */
  keluar: boolean;
}

export interface UpdateBulanan {
  outletId: string;
  periode: string;
  jumlahKaryawan: number;
  catatan: string | null;
  olehNama: string | null;
  updatedAt: string;
}

const KOLOM_KONTRAK =
  "id,outlet_id,nip,nama,jabatan,no_kontrak,jenis,tgl_mulai,tgl_berakhir,kontrak_ke,prioritas_renewal,link_kontrak,link_ktp,link_foto,catatan,tgl_masuk_pertama,tgl_resign,kategori_turnover,alasan_keluar";

/** Outlet yang boleh dilihat pengguna ini, sudah membawa brand & supervisornya. */
export function outletsForUser(user: UserProfile) {
  const areas = new Map(getAreas().map((a) => [a.id, a.name]));
  return scopeOutlets(user, getOutlets()).map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    areaName: areas.get(o.areaId) ?? "—",
    brand: brandOutlet(o.name),
    supervisorId: o.supervisorId,
    supervisorName: o.supervisorId ? userName(o.supervisorId) : "—",
    active: o.active,
  }));
}

function toRow(r: Record<string, unknown>, outlet: { name: string; code: string; brand: Brand | null }): KontrakRow {
  const jenis = (r.jenis as JenisKontrak | null) ?? null;
  const tglMulai = (r.tgl_mulai as string | null) ?? null;
  const tglBerakhir = (r.tgl_berakhir as string | null) ?? null;
  const tglResign = (r.tgl_resign as string | null) ?? null;
  return {
    id: String(r.id),
    outletId: String(r.outlet_id),
    outletName: outlet.name,
    outletCode: outlet.code,
    brand: outlet.brand,
    nip: (r.nip as string | null) ?? null,
    nama: String(r.nama ?? ""),
    jabatan: (r.jabatan as string | null) ?? null,
    noKontrak: (r.no_kontrak as string | null) ?? null,
    jenis,
    tglMulai,
    tglBerakhir,
    kontrakKe: Number(r.kontrak_ke ?? 1),
    prioritasRenewal: ((r.prioritas_renewal as PrioritasRenewal) ?? "normal") as PrioritasRenewal,
    linkKontrak: (r.link_kontrak as string | null) ?? null,
    linkKtp: (r.link_ktp as string | null) ?? null,
    linkFoto: (r.link_foto as string | null) ?? null,
    catatan: (r.catatan as string | null) ?? null,
    tglMasukPertama: (r.tgl_masuk_pertama as string | null) ?? null,
    tglResign,
    kategoriTurnover: (r.kategori_turnover as string | null) ?? null,
    alasanKeluar: (r.alasan_keluar as string | null) ?? null,
    status: statusKontrak({ jenis, tglMulai, tglBerakhir, tglResign }),
    keluar: !!tglResign,
  };
}

/** Seluruh karyawan kontrak pada outlet yang boleh dilihat pengguna. */
export async function listKontrak(user: UserProfile): Promise<KontrakRow[]> {
  const outlets = outletsForUser(user);
  if (outlets.length === 0) return [];
  if (!dbEnabled) return [];

  const byId = new Map(outlets.map((o) => [o.id, o]));
  const ids = outlets.map((o) => o.id);
  const rows = await selectAll<Record<string, unknown>>("hc_contracts", (from, to) =>
    db().from("hc_contracts").select(KOLOM_KONTRAK).in("outlet_id", ids).order("nama").range(from, to),
  );
  return rows
    .map((r) => {
      const o = byId.get(String(r.outlet_id));
      return o ? toRow(r, o) : null;
    })
    .filter((r): r is KontrakRow => r !== null);
}

/** Update Bulanan satu periode untuk outlet yang boleh dilihat pengguna. */
export async function listUpdateBulanan(user: UserProfile, periode: string): Promise<UpdateBulanan[]> {
  const ids = outletsForUser(user).map((o) => o.id);
  if (ids.length === 0 || !dbEnabled) return [];
  const rows = await selectAll<Record<string, unknown>>("hc_monthly_updates", (from, to) =>
    db()
      .from("hc_monthly_updates")
      .select("outlet_id,periode,jumlah_karyawan,catatan,dilaporkan_oleh_nama,updated_at")
      .eq("periode", periode)
      .in("outlet_id", ids)
      // Urutan wajib ada: tanpa itu halaman kedua bisa mengulang atau
      // melewatkan baris yang sudah terbaca di halaman pertama.
      .order("outlet_id")
      .range(from, to),
  );
  return rows.map((r) => ({
    outletId: String(r.outlet_id),
    periode: String(r.periode),
    jumlahKaryawan: Number(r.jumlah_karyawan ?? 0),
    catatan: (r.catatan as string | null) ?? null,
    olehNama: (r.dilaporkan_oleh_nama as string | null) ?? null,
    updatedAt: String(r.updated_at ?? ""),
  }));
}

/** Riwayat Update Bulanan satu outlet, terbaru dulu. */
export async function riwayatUpdateBulanan(outletId: string, batas = 12): Promise<UpdateBulanan[]> {
  if (!dbEnabled) return [];
  const { data, error } = await db()
    .from("hc_monthly_updates")
    .select("outlet_id,periode,jumlah_karyawan,catatan,dilaporkan_oleh_nama,updated_at")
    .eq("outlet_id", outletId)
    .order("periode", { ascending: false })
    .limit(batas);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    outletId: String(r.outlet_id),
    periode: String(r.periode),
    jumlahKaryawan: Number(r.jumlah_karyawan ?? 0),
    catatan: (r.catatan as string | null) ?? null,
    olehNama: (r.dilaporkan_oleh_nama as string | null) ?? null,
    updatedAt: String(r.updated_at ?? ""),
  }));
}

export interface OutletKontrak {
  id: string;
  name: string;
  code: string;
  areaName: string;
  brand: Brand | null;
  supervisorId: string;
  supervisorName: string;
  /** Karyawan aktif (belum keluar). */
  aktif: number;
  /** Kontrak yang berakhir ≤60 hari lagi. */
  segera: number;
  /** Kontrak yang tanggalnya sudah lewat. */
  berakhir: number;
  /** Karyawan tanpa data kontrak sama sekali. */
  belumAdaKontrak: number;
  /** Sudah mengirim Update Bulanan periode berjalan. */
  sudahLapor: boolean;
  updateTerakhir: UpdateBulanan | null;
}

/**
 * Rekap per outlet — inti Dashboard Outlet.
 *
 * Outlet yang belum punya satu pun data karyawan tetap muncul dengan angka nol.
 * Menyembunyikannya akan membuat outlet yang paling perlu ditagih justru hilang
 * dari daftar.
 */
export async function rekapOutlet(user: UserProfile, periode = periodeKey()): Promise<OutletKontrak[]> {
  const outlets = outletsForUser(user);
  const [kontrak, updates] = await Promise.all([listKontrak(user), listUpdateBulanan(user, periode)]);
  const upd = new Map(updates.map((u) => [u.outletId, u]));

  return outlets
    .map((o) => {
      const punya = kontrak.filter((k) => k.outletId === o.id);
      const aktif = punya.filter((k) => !k.keluar);
      const u = upd.get(o.id) ?? null;
      return {
        id: o.id,
        name: o.name,
        code: o.code,
        areaName: o.areaName,
        brand: o.brand,
        supervisorId: o.supervisorId,
        supervisorName: o.supervisorName,
        aktif: aktif.length,
        segera: aktif.filter((k) => k.status === "segera_berakhir").length,
        berakhir: aktif.filter((k) => k.status === "berakhir").length,
        belumAdaKontrak: aktif.filter((k) => k.status === "belum_ada").length,
        sudahLapor: !!u,
        updateTerakhir: u,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export interface HcmosRingkas {
  /** Manajemen — dari User Management. */
  manajemenAktif: number;
  manajemenNonAktif: number;
  perDepartemen: { nama: string; jumlah: number }[];
  /** Outlet — dari Kontrak Tracker. */
  outletTotal: number;
  outletKaryawan: number;
  kontrakSegera: number;
  kontrakBerakhir: number;
  belumAdaKontrak: number;
  /** Update Bulanan periode berjalan. */
  periode: string;
  outletLapor: number;
  kepatuhanPersen: number;
  /** Turnover 12 bulan terakhir, dikelompokkan per bulan keluar. */
  turnoverPerBulan: { bulan: string; jumlah: number }[];
  turnoverPerKategori: { kategori: string; jumlah: number }[];
}

/** Angka ringkas untuk Dashboard HC-MOS — satu kali baca, dipakai semua kartunya. */
export async function ringkasHcmos(user: UserProfile, periode = periodeKey()): Promise<HcmosRingkas> {
  const [rekap, kontrak] = await Promise.all([rekapOutlet(user, periode), listKontrak(user)]);

  // Manajemen: daftar orang di User Management, bukan salinan tersendiri.
  const users = getUsers();
  const aktif = users.filter((u) => u.active);
  const perDep = new Map<string, number>();
  for (const u of aktif) {
    const dep = (u.department ?? "").trim() || "Tanpa Departemen";
    perDep.set(dep, (perDep.get(dep) ?? 0) + 1);
  }

  const keluar = kontrak.filter((k) => k.keluar);
  const perBulan = new Map<string, number>();
  const perKategori = new Map<string, number>();
  for (const k of keluar) {
    const b = bulanKeluar(k.tglResign);
    if (b) perBulan.set(b, (perBulan.get(b) ?? 0) + 1);
    const kat = (k.kategoriTurnover ?? "").trim() || "Tidak Dicatat";
    perKategori.set(kat, (perKategori.get(kat) ?? 0) + 1);
  }

  const lapor = rekap.filter((o) => o.sudahLapor).length;

  return {
    manajemenAktif: aktif.length,
    manajemenNonAktif: users.length - aktif.length,
    perDepartemen: [...perDep.entries()]
      .map(([nama, jumlah]) => ({ nama, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah),
    outletTotal: rekap.length,
    outletKaryawan: rekap.reduce((a, o) => a + o.aktif, 0),
    kontrakSegera: rekap.reduce((a, o) => a + o.segera, 0),
    kontrakBerakhir: rekap.reduce((a, o) => a + o.berakhir, 0),
    belumAdaKontrak: rekap.reduce((a, o) => a + o.belumAdaKontrak, 0),
    periode,
    outletLapor: lapor,
    kepatuhanPersen: rekap.length ? Math.round((lapor / rekap.length) * 100) : 0,
    turnoverPerBulan: [...perBulan.entries()].map(([bulan, jumlah]) => ({ bulan, jumlah })),
    turnoverPerKategori: [...perKategori.entries()]
      .map(([kategori, jumlah]) => ({ kategori, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah),
  };
}

/* ─────────────────────────────── penulisan ─────────────────────────────── */

export interface SimpanKontrakInput {
  id?: string;
  outletId: string;
  nip: string;
  nama: string;
  jabatan: string;
  noKontrak: string;
  jenis: JenisKontrak | null;
  tglMulai: string;
  tglBerakhir: string;
  kontrakKe: number;
  prioritasRenewal: PrioritasRenewal;
  linkKontrak: string;
  linkKtp: string;
  linkFoto: string;
  catatan: string;
  tglMasukPertama: string;
  tglResign: string;
  kategoriTurnover: string;
  alasanKeluar: string;
}

/** Kosong disimpan sebagai NULL — string kosong pada kolom tanggal ditolak Postgres. */
const nol = (v: string) => (v.trim() === "" ? null : v.trim());

export async function simpanKontrak(input: SimpanKontrakInput, olehId: string): Promise<{ id: string }> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const baris = {
    outlet_id: input.outletId,
    nip: nol(input.nip),
    nama: input.nama.trim(),
    jabatan: nol(input.jabatan),
    no_kontrak: nol(input.noKontrak),
    jenis: input.jenis,
    tgl_mulai: nol(input.tglMulai),
    tgl_berakhir: nol(input.tglBerakhir),
    kontrak_ke: input.kontrakKe > 0 ? input.kontrakKe : 1,
    prioritas_renewal: input.prioritasRenewal,
    link_kontrak: nol(input.linkKontrak),
    link_ktp: nol(input.linkKtp),
    link_foto: nol(input.linkFoto),
    catatan: nol(input.catatan),
    tgl_masuk_pertama: nol(input.tglMasukPertama),
    tgl_resign: nol(input.tglResign),
    kategori_turnover: nol(input.kategoriTurnover),
    alasan_keluar: nol(input.alasanKeluar),
    updated_at: new Date().toISOString(),
    updated_by: olehId,
  };

  if (input.id) {
    const { error } = await db().from("hc_contracts").update(baris).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await db().from("hc_contracts").insert(baris).select("id").single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function hapusKontrak(id: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const { error } = await db().from("hc_contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Outlet sebuah baris kontrak — dipakai memeriksa wewenang sebelum menulis. */
export async function outletDariKontrak(id: string): Promise<string | null> {
  if (!dbEnabled) return null;
  const { data, error } = await db().from("hc_contracts").select("outlet_id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String(data.outlet_id) : null;
}

export async function simpanUpdateBulanan(input: {
  outletId: string;
  periode: string;
  jumlahKaryawan: number;
  catatan: string;
  olehId: string;
  olehNama: string;
}): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const { error } = await db().from("hc_monthly_updates").upsert(
    {
      outlet_id: input.outletId,
      periode: input.periode,
      jumlah_karyawan: input.jumlahKaryawan,
      catatan: input.catatan.trim() || null,
      dilaporkan_oleh: input.olehId,
      dilaporkan_oleh_nama: input.olehNama,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "outlet_id,periode" },
  );
  if (error) throw new Error(error.message);
}
