import "server-only";

import { db, dbEnabled } from "@/lib/data/db";
import { listHcRequests } from "@/lib/data/hc-requests";
import {
  nilaiPermintaan,
  rekapPerOutlet,
  rekapPerPemohon,
  type BarisNilai,
  type CeklisBrief,
  type HasilPenilaian,
  type RekapPemohon,
} from "@/lib/creative/penilaian-request";

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

export interface DashboardPenilaian {
  baris: BarisDashboard[];
  perPemohon: RekapPemohon[];
  perOutlet: RekapPemohon[];
  /** Permintaan design selesai yang BELUM dinilai — sisa pekerjaan penilainya. */
  belumDinilai: number;
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
 * Satu-satunya tempat yang tahu bentuk baris `hc_requests` tetap satu, dan
 * di sinilah alasannya kelihatan.
 */
export async function dashboardPenilaian(sejak?: string): Promise<DashboardPenilaian> {
  const kosong: DashboardPenilaian = { baris: [], perPemohon: [], perOutlet: [], belumDinilai: 0 };
  if (!dbEnabled) return kosong;

  const [permintaan, nilaiRows] = await Promise.all([
    listHcRequests({ kind: "design" }),
    db().from("design_request_penilaian").select("*"),
  ]);

  const nilai = new Map<string, Record<string, unknown>>();
  for (const r of ((nilaiRows.data ?? []) as Record<string, unknown>[])) nilai.set(String(r.request_id), r);

  // Hanya permintaan yang sudah SELESAI yang masuk hitungan. Yang masih
  // berjalan belum punya penilaian, dan memasukkannya sebagai nol akan
  // menuduh orang atas pekerjaan yang belum kelar.
  const selesai = permintaan.filter((r) => r.status === "terlaksana");
  const dalamRentang = sejak ? selesai.filter((r) => r.createdAt >= sejak) : selesai;

  const baris: BarisDashboard[] = [];
  let belum = 0;
  for (const r of dalamRentang) {
    const n = nilai.get(r.id);
    if (!n) {
      belum += 1;
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
      outletId: r.outletId,
      outletNama: r.outletName,
      skor: hasil.skor,
      hari: hasil.hari,
      waktu: hasil.waktu,
      dinilaiNama: String(n.dinilai_nama ?? ""),
      catatan: String(n.catatan ?? ""),
      ceklis,
      hasil,
    });
  }

  return {
    baris,
    perPemohon: rekapPerPemohon(baris),
    perOutlet: rekapPerOutlet(baris),
    belumDinilai: belum,
  };
}
