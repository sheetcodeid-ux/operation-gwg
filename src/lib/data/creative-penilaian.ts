import "server-only";

import { db, dbEnabled } from "@/lib/data/db";
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
 * Seluruh bahan dashboard, dalam dua kueri.
 *
 * Permintaan design diambil apa adanya lalu digabung dengan penilaiannya di
 * memori. Bergabung lewat SQL akan lebih rapi, tapi `hc_requests` dibaca
 * lewat penghidrasi yang sama dengan seluruh modul lain — memotong jalannya di
 * sini berarti satu tempat lagi yang harus ikut diperbaiki setiap kali bentuk
 * barisnya berubah.
 */
export async function dashboardPenilaian(sejak?: string): Promise<DashboardPenilaian> {
  const kosong: DashboardPenilaian = { baris: [], perPemohon: [], perOutlet: [], belumDinilai: 0 };
  if (!dbEnabled) return kosong;

  // Permintaan design saja, dan hanya kolom yang dipakai. Seluruh riwayat
  // design masih ratusan baris, jauh di bawah batas satu halaman Supabase —
  // kalau suatu saat menembusnya, di sinilah pagingnya ditambahkan.
  const [reqRes, nilaiRows] = await Promise.all([
    db()
      .from("hc_requests")
      .select("id,title,requester_id,requester_name,outlet_id,outlet_name,planned_date,created_at,status")
      .eq("kind", "design")
      .order("created_at", { ascending: false })
      .limit(1000),
    db().from("design_request_penilaian").select("*"),
  ]);
  const reqRows = (reqRes.data ?? []) as Record<string, unknown>[];

  const nilai = new Map<string, Record<string, unknown>>();
  for (const r of ((nilaiRows.data ?? []) as Record<string, unknown>[])) nilai.set(String(r.request_id), r);

  // Hanya permintaan yang sudah SELESAI yang masuk hitungan. Yang masih
  // berjalan belum punya penilaian, dan memasukkannya sebagai nol akan
  // menuduh orang atas pekerjaan yang belum kelar.
  const selesai = reqRows.filter((r) => String(r.status ?? "") === "terlaksana");
  const dalamRentang = sejak ? selesai.filter((r) => String(r.created_at ?? "") >= sejak) : selesai;

  const baris: BarisDashboard[] = [];
  let belum = 0;
  for (const r of dalamRentang) {
    const id = String(r.id);
    const n = nilai.get(id);
    if (!n) {
      belum += 1;
      continue;
    }
    const ceklis = ceklisDari(n);
    const dibuat = String(r.created_at ?? "");
    const deadline = (r.planned_date as string | null) ?? null;
    const hasil = nilaiPermintaan(dibuat, deadline, ceklis);
    baris.push({
      requestId: id,
      judul: String(r.title ?? ""),
      dibuat,
      deadline,
      pemohonId: String(r.requester_id ?? ""),
      pemohonNama: String(r.requester_name ?? "—"),
      outletId: (r.outlet_id as string | null) ?? null,
      outletNama: (r.outlet_name as string | null) ?? null,
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
