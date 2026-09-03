import "server-only";

import { db, dbEnabled } from "@/lib/data/db";
import { listHcRequests } from "@/lib/data/hc-requests";
import { getArea, getOutlet, getOutlets, getUser } from "@/lib/data/store";
import { areaMilik, asalArea, type AsalArea, type CariOutlet } from "@/lib/creative/area-pemohon";
import {
  nilaiPermintaan,
  periodeDari,
  type BarisNilai,
  type CeklisBrief,
  type HasilPenilaian,
} from "@/lib/creative/penilaian-request";
import type { HcRequest } from "@/lib/hc-request";
import type { UserProfile } from "@/lib/types";

/**
 * Pembacaan dan penyimpanan penilaian pemohon design.
 *
 * Yang tersimpan hanya ceklis faktanya. Selisih hari — bagian terbesar
 * skornya — dihitung ULANG dari `hc_requests` setiap kali dibaca, tidak pernah
 * disimpan. Alasannya sederhana dan mahal kalau dilanggar: angka yang disimpan
 * bisa berbeda dari sumbernya begitu tanggalnya diperbaiki, dan angka yang
 * tidak cocok dengan sumbernya justru jadi bahan perdebatan baru — persis yang
 * hendak dihentikan dashboard ini.
 */

export interface PenilaianTersimpan extends CeklisBrief {
  requestId: string;
  catatan: string;
  dinilaiNama: string;
  dinilaiPada: string;
}

export interface BarisDashboard extends BarisNilai {
  requestId: string;
  judul: string;
  dibuat: string;
  deadline: string | null;
  dinilaiNama: string;
  catatan: string;
  ceklis: CeklisBrief;
  hasil: HasilPenilaian;
}

/** Permintaan selesai yang BELUM dinilai — sisa pekerjaan penilainya. */
export interface BarisBelum {
  requestId: string;
  judul: string;
  pemohonNama: string;
  areaNama: string;
  periode: string;
}

export interface DashboardPenilaian {
  baris: BarisDashboard[];
  belum: BarisBelum[];
}

const ceklisDari = (r: Record<string, unknown>): CeklisBrief => ({
  tujuanJelas: !!r.tujuan_jelas,
  ukuranMedia: !!r.ukuran_media,
  materiLengkap: !!r.materi_lengkap,
  tanggalTayang: !!r.tanggal_tayang,
});

export async function penilaianRequest(requestId: string): Promise<PenilaianTersimpan | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("design_request_penilaian").select("*").eq("request_id", requestId).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    requestId,
    ...ceklisDari(r),
    catatan: String(r.catatan ?? ""),
    dinilaiNama: String(r.dinilai_nama ?? ""),
    dinilaiPada: String(r.dinilai_pada ?? ""),
  };
}

export async function simpanPenilaian(input: {
  requestId: string;
  ceklis: CeklisBrief;
  catatan: string;
  olehId: string;
  olehNama: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbEnabled) return { ok: false, error: "Penyimpanan belum aktif." };
  const { error } = await db()
    .from("design_request_penilaian")
    .upsert({
      request_id: input.requestId,
      tujuan_jelas: input.ceklis.tujuanJelas,
      ukuran_media: input.ceklis.ukuranMedia,
      materi_lengkap: input.ceklis.materiLengkap,
      tanggal_tayang: input.ceklis.tanggalTayang,
      catatan: input.catatan.slice(0, 500) || null,
      dinilai_oleh: input.olehId,
      dinilai_nama: input.olehNama,
      dinilai_pada: new Date().toISOString(),
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ───────────────────────────── area pemohon ───────────────────────────── */

/**
 * Cabang bisa disebut dengan id aplikasinya ATAU kode POS-nya.
 *
 * Penugasan cabang di User Management menyimpan salah satu dari keduanya, dan
 * yang mana tergantung kapan barisnya dibuat. Mencari dengan id saja membuat
 * separuh supervisor tampak tidak memegang cabang mana pun.
 */
const cariOutlet: CariOutlet = (idAtauKode) =>
  getOutlet(idAtauKode) ?? getOutlets().find((o) => o.code === idAtauKode);

const namaArea = (areaId: string) => getArea(areaId)?.name;

/** Aturannya ada di `@/lib/creative/area-pemohon`; di sini hanya penyambungnya. */
export function areaPermintaan(req: { outletId: string | null; requesterId: string }): AsalArea {
  return asalArea({
    outletId: req.outletId,
    pemohonOutletIds: getUser(req.requesterId)?.outletIds ?? [],
    cariOutlet,
    namaArea,
  });
}

/**
 * Area yang boleh dilihat seseorang.
 *
 * `null` berarti seluruh area — tim Creative yang menilai, dan manajemen yang
 * mengevaluasi, memang harus bisa membandingkan antar-wilayah. Coordinator Area
 * hanya melihat wilayahnya sendiri: rapor wilayah lain bukan bahan kerjanya,
 * dan membukanya untuk semua orang mengubah alat evaluasi jadi bahan gosip.
 */
export function areaTerlihat(user: UserProfile, semuaArea: boolean): string[] | null {
  if (semuaArea) return null;
  return areaMilik({ outletIds: user.outletIds ?? [], areaId: user.areaId, cariOutlet });
}

/* ────────────────────────────── dashboard ────────────────────────────── */

/**
 * Seluruh bahan dashboard.
 *
 * Permintaannya dibaca lewat `listHcRequests`, BUKAN kueri sendiri ke
 * `hc_requests`. Sempat ditulis sebagai kueri langsung supaya hemat satu
 * lapisan, dan hasilnya dashboard yang selalu kosong: nama pemohon dan nama
 * outlet tidak ada di tabelnya — keduanya disusun dari `requester_id` dan
 * `outlet_id` di `fromRow`. Memintanya sebagai kolom membuat seluruh kueri
 * gagal tanpa suara, dan yang terlihat di layar cuma "belum ada data".
 *
 * Rekapnya TIDAK dihitung di sini. Saringan bulan ada di layar dan mengubah
 * seluruh rata-rata; menghitungnya di server berarti satu perjalanan bolak-balik
 * setiap kali orang berpindah bulan, untuk data yang sudah ada di tangan.
 */
export async function dashboardPenilaian(areaIds?: string[] | null): Promise<DashboardPenilaian> {
  if (!dbEnabled) return { baris: [], belum: [] };

  const [permintaan, nilaiRows] = await Promise.all([
    listHcRequests({ kind: "design", semua: true }),
    db().from("design_request_penilaian").select("*"),
  ]);

  const nilai = new Map<string, Record<string, unknown>>();
  for (const r of ((nilaiRows.data ?? []) as Record<string, unknown>[])) nilai.set(String(r.request_id), r);

  // Hanya permintaan yang sudah SELESAI yang masuk hitungan. Yang masih
  // berjalan belum punya penilaian, dan memasukkannya sebagai nol akan
  // menuduh orang atas pekerjaan yang belum kelar.
  const selesai = permintaan.filter((r) => r.status === "terlaksana");

  const baris: BarisDashboard[] = [];
  const belum: BarisBelum[] = [];
  for (const r of selesai) {
    const area = areaPermintaan(r);
    if (areaIds && !areaIds.includes(area.areaId)) continue;

    const n = nilai.get(r.id);
    const periode = periodeDari(r.createdAt);
    if (!n) {
      belum.push({ requestId: r.id, judul: r.title, pemohonNama: r.requesterName, areaNama: area.areaNama, periode });
      continue;
    }
    const ceklis = ceklisDari(n);
    const hasil = nilaiPermintaan(r.createdAt, r.plannedDate, ceklis);
    baris.push({
      requestId: r.id,
      judul: r.title,
      dibuat: r.createdAt,
      deadline: r.plannedDate,
      pemohonId: r.requesterId,
      pemohonNama: r.requesterName,
      areaId: area.areaId,
      areaNama: area.areaNama,
      outletNama: area.outletNama,
      periode,
      skor: hasil.skor,
      hari: hasil.hari,
      waktu: hasil.waktu,
      dinilaiNama: String(n.dinilai_nama ?? ""),
      catatan: String(n.catatan ?? ""),
      ceklis,
      hasil,
    });
  }

  return { baris, belum };
}

/* ─────────────────────── penerima laporan (CA) ─────────────────────── */

export interface PenerimaLaporan {
  id: string;
  nama: string;
  areaNama: string;
  /** Area yang ia pegang — dipakai memilih siapa yang dicentang lebih dulu. */
  areaIds: string[];
}

/**
 * Coordinator Area beserta wilayah yang benar-benar dipegangnya.
 *
 * Diambil dari penugasan cabang di User Management, bukan dari kolom
 * `areas.coordinator_id`. Kolom itu peninggalan lama dan seluruh barisnya masih
 * menunjuk akun admin — mengirim laporan berdasarkan itu berarti seluruh
 * laporan mendarat di satu orang yang salah.
 */
export function penerimaLaporan(kandidat: UserProfile[]): PenerimaLaporan[] {
  return kandidat
    .filter((u) => u.active && u.role === "area_coordinator")
    .map((u) => {
      const ids = areaMilik({ outletIds: u.outletIds ?? [], areaId: u.areaId, cariOutlet });
      const nama = ids.map((id) => namaArea(id) ?? "—");
      return {
        id: u.id,
        nama: u.name,
        areaNama: nama.length ? nama.join(", ") : "Belum ada cabang",
        areaIds: ids,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/** Permintaan design yang dipakai laporan — dipanggil ulang di server saat kirim. */
export async function barisUntukLaporan(areaIds?: string[] | null): Promise<BarisDashboard[]> {
  const { baris } = await dashboardPenilaian(areaIds);
  return baris;
}

export type { HcRequest };
