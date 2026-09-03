"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { dbEnabled } from "@/lib/data/db";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import {
  hapusEntri,
  hapusMenuPasar,
  periodeDikunci,
  simpanActual,
  simpanEfisiensi,
  simpanEntri,
  simpanFee,
  simpanMenuPasar,
  simpanPengaturan,
} from "@/lib/data/kpi";
import { MENU_POSISI, bolehAturKpi } from "@/lib/kpi/akses";
import { indikatorPosisi } from "@/lib/kpi/indikator";
import type { JenisEntri } from "@/lib/kpi/indikator";
import { posisiDari, type KodePosisi } from "@/lib/kpi/struktur";
import type { UserProfile } from "@/lib/types";

/**
 * Penulisan angka KPI.
 *
 * TIGA PENJAGA, DAN KETIGANYA DI SERVER. Tombol yang disembunyikan di layar
 * tidak menjaga apa pun — siapa pun yang bisa memanggil aksinya bisa menulis
 * angka atas nama posisi mana pun.
 *
 *   1. Orangnya memang boleh membuka posisi itu.
 *   2. Indikator yang ditulis memang milik posisi itu — bukan kunci karangan.
 *   3. Bulannya belum dikunci.
 *
 * Yang ketiga paling mudah terlupa dan paling merugikan: bulan yang sudah
 * ditutup lalu berubah angkanya membuat seluruh laporan yang sudah dibagikan
 * jadi salah, tanpa ada yang tahu kapan berubahnya.
 */

const RUTE = (posisi: string) => `/kpi/${posisi}`;

async function gerbang(posisi: string, periode: string): Promise<{ user: UserProfile } | { error: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };

  const p = posisiDari(posisi);
  const menu = MENU_POSISI[posisi as KodePosisi];
  if (!p || !menu) return { error: "Posisi tidak dikenali." };
  if (!canReachMenu(user, menu as MenuKey)) return { error: "Tidak punya akses ke KPI posisi ini." };
  if (!/^\d{4}-\d{2}$/.test(periode)) return { error: "Bulannya tidak dikenali." };
  if (await periodeDikunci(periode, posisi)) return { error: "Bulan ini sudah dikunci — angkanya tidak bisa diubah lagi." };

  return { user };
}

const punyaIndikator = (posisi: string, indikator: string) =>
  indikatorPosisi(posisi as KodePosisi).some((i) => i.key === indikator);

/** Angka yang diketik: metrik sosial media, capaian Marcomm, penilaian atasan. */
export async function simpanActualAction(input: {
  posisi: string;
  periode: string;
  indikator: string;
  /** Kosong = bukan angka per brand. */
  brand?: string;
  nilai: number;
  catatan?: string;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, input.indikator)) return { error: "Indikator itu bukan milik posisi ini." };
  if (!Number.isFinite(input.nilai) || input.nilai < 0) return { error: "Angkanya tidak masuk akal." };

  const res = await simpanActual({
    periode: input.periode,
    posisi: input.posisi,
    indikator: input.indikator,
    brand: (input.brand ?? "").slice(0, 40),
    nilai: input.nilai,
    catatan: input.catatan ?? "",
    olehId: g.user.id,
    olehNama: g.user.name,
  });
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

/** Satu baris kegiatan: kunjungan QC, riset menu, event, faktur, penyampaian, temuan. */
export async function simpanEntriAction(input: {
  posisi: string;
  periode: string;
  jenis: JenisEntri;
  tanggal: string;
  picNama?: string;
  outletId?: string | null;
  judul?: string;
  deskripsi?: string;
  nominal?: number | null;
  nominalSeharusnya?: number | null;
  tenggat?: string | null;
  gagal?: boolean;
  lampiran?: { path: string; name: string }[];
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) return { error: "Tanggalnya belum diisi." };
  // Tanggal di luar bulan yang sedang diisi hampir selalu salah ketik, dan
  // diam-diam menambah angka ke bulan yang sudah lewat.
  if (input.tanggal.slice(0, 7) !== input.periode) return { error: "Tanggalnya di luar bulan yang sedang diisi." };

  const res = await simpanEntri({
    jenis: input.jenis,
    periode: input.periode,
    posisi: input.posisi,
    tanggal: input.tanggal,
    picNama: (input.picNama ?? g.user.name).slice(0, 120),
    outletId: input.outletId ?? null,
    judul: (input.judul ?? "").slice(0, 200),
    deskripsi: (input.deskripsi ?? "").slice(0, 1000),
    nominal: input.nominal ?? null,
    nominalSeharusnya: input.nominalSeharusnya ?? null,
    tenggat: input.tenggat ?? null,
    gagal: !!input.gagal,
    lampiran: (input.lampiran ?? []).slice(0, 10),
    olehId: g.user.id,
    olehNama: g.user.name,
  });
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

export async function hapusEntriAction(input: { posisi: string; periode: string; id: string }): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  const res = await hapusEntri(input.id);
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

/** Realisasi beban operasional satu outlet. */
export async function simpanEfisiensiAction(input: {
  posisi: string;
  periode: string;
  outletId: string;
  actualWh: number | null;
  actualNonWh: number | null;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "efisiensi")) return { error: "Posisi ini tidak dinilai efisiensi beban operasional." };
  if (!input.outletId) return { error: "Pilih dulu outletnya." };

  const res = await simpanEfisiensi({ ...input, olehId: g.user.id });
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

/** Ceklis kesesuaian management fee satu outlet. */
export async function simpanFeeAction(input: {
  posisi: string;
  periode: string;
  outletId: string;
  sesuai: boolean;
  catatan?: string;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "management_fee")) return { error: "Posisi ini tidak menilai management fee." };
  if (!input.outletId) return { error: "Pilih dulu outletnya." };

  const res = await simpanFee({ ...input, catatan: input.catatan ?? "", olehId: g.user.id });
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

/** Satu menu yang dinilai pada Keberhasilan Pasar, beserta omset bulan itu. */
export async function simpanMenuPasarAction(input: {
  posisi: string;
  periode: string;
  menu: string;
  penjualan: number;
  omset: number;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "keberhasilan_pasar")) return { error: "Posisi ini tidak menilai keberhasilan pasar." };
  if (!input.menu.trim()) return { error: "Nama menunya belum diisi." };

  const res = await simpanMenuPasar({ ...input, menu: input.menu.trim(), olehId: g.user.id });
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

export async function hapusMenuPasarAction(input: { posisi: string; periode: string; menu: string }): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode);
  if ("error" in g) return { error: g.error };
  const res = await hapusMenuPasar(input.periode, input.posisi, input.menu);
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

/**
 * Bobot dan target.
 *
 * Lebih sempit daripada pengisian angka, dan sengaja: bobot adalah kebijakan
 * perusahaan. Kalau orang yang dinilai bisa mengubahnya sendiri, angkanya
 * berhenti berarti apa pun.
 */
export async function simpanPengaturanAction(input: {
  posisi: string;
  ubahan: { indikator: string; bobot: number | null; target: number | null; pertumbuhan: number | null }[];
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (!bolehAturKpi(user)) return { error: "Hanya super admin yang boleh mengubah bobot dan target." };
  if (!posisiDari(input.posisi)) return { error: "Posisi tidak dikenali." };

  for (const u of input.ubahan) {
    if (!punyaIndikator(input.posisi, u.indikator)) return { error: `Indikator ${u.indikator} bukan milik posisi ini.` };
    if (u.bobot !== null && (u.bobot < 0 || u.bobot > 100)) return { error: "Bobot harus antara 0 dan 100." };
    const res = await simpanPengaturan({
      posisi: input.posisi,
      indikator: u.indikator,
      bobot: u.bobot,
      target: u.target,
      pertumbuhan: u.pertumbuhan,
      olehId: user.id,
      olehNama: user.name,
    });
    if (res.error) return { error: res.error };
  }
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}
