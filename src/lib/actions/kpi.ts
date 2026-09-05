"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "@/lib/data/db";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import {
  hapusEntri,
  hapusMenuPasar,
  outletMilikPic,
  outletSeluruhPic,
  periodeDikunci,
  picDinamis,
  simpanOutletBulanan,
  SEMUA_PIC,
  simpanActual,
  simpanEfisiensi,
  simpanEntri,
  simpanFee,
  simpanMenuPasar,
  simpanPengaturan,
} from "@/lib/data/kpi";
import { MENU_POSISI, bolehAngkaOutlet, bolehAturKpi, picTerkunci } from "@/lib/kpi/akses";
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

async function gerbang(
  posisi: string,
  periode: string,
  pic = "",
  opsi: { izinkanGabungan?: boolean } = {},
): Promise<{ user: UserProfile } | { error: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };

  const p = posisiDari(posisi);
  const menu = MENU_POSISI[posisi as KodePosisi];
  if (!p || !menu) return { error: "Posisi tidak dikenali." };
  if (!canReachMenu(user, menu as MenuKey)) return { error: "Tidak punya akses ke KPI posisi ini." };
  if (!/^\d{4}-\d{2}$/.test(periode)) return { error: "Bulannya tidak dikenali." };
  if (await periodeDikunci(periode, posisi, pic)) return { error: "Bulan ini sudah dikunci — angkanya tidak bisa diubah lagi." };

  // Posisi yang dinilai per orang WAJIB menyebut orangnya, dan namanya harus
  // benar-benar terdaftar. Tanpa ini, satu salah ketik menyimpan angka ke
  // "orang" yang tidak pernah ada — dan capaiannya hilang tanpa jejak.
  // Yang terkunci ke dirinya sendiri tidak bisa menulis atas nama orang lain,
  // apa pun yang dikirim peramban. Memangkas daftarnya di layar hanya
  // menyembunyikan tombol.
  const kunci = picTerkunci(user);
  if (kunci && pic !== kunci) return { error: "Anda hanya bisa mengisi KPI area Anda sendiri." };

  if (p.perPic && !opsi.izinkanGabungan) {
    if (!pic) return { error: "Pilih dulu PIC-nya." };
    // "Semua" hanya untuk MEMBACA gabungan. Menyimpan atasnya berarti angkanya
    // tidak menempel pada siapa pun, dan tidak akan pernah bisa ditelusuri.
    if (pic === SEMUA_PIC) return { error: "Pilih dulu satu Coordinator Area — \"Semua\" hanya untuk melihat gabungannya." };
    // Posisi yang daftarnya datang dari basis data diperiksa ke daftar itu,
    // bukan ke daftar di berkas — kalau tidak, satu-satunya PIC yang diterima
    // adalah daftar kosong dan tidak ada satu pun angka yang bisa disimpan.
    const sah = p.picDinamis ? picDinamis(p.kode).some((o) => o.value === pic) : p.pic.includes(pic);
    if (!sah) return { error: "Orang itu bukan PIC posisi ini." };
  } else if (pic) {
    return { error: "Posisi ini dinilai sebagai satu tim, bukan per orang." };
  }

  return { user };
}

const punyaIndikator = (posisi: string, indikator: string) =>
  indikatorPosisi(posisi as KodePosisi).some((i) => i.key === indikator);

/** Angka yang diketik: metrik sosial media, capaian Marcomm, penilaian atasan. */
export async function simpanActualAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  indikator: string;
  /** Kosong = bukan angka per brand. */
  brand?: string;
  nilai: number;
  catatan?: string;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, input.indikator)) return { error: "Indikator itu bukan milik posisi ini." };
  if (!Number.isFinite(input.nilai) || input.nilai < 0) return { error: "Angkanya tidak masuk akal." };

  const res = await simpanActual({
    periode: input.periode,
    posisi: input.posisi,
    pic: input.pic ?? "",
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
/**
 * Jenis entri yang WAJIB berbukti.
 *
 * Hygiene Audit / CCTV Monitoring dinilai dari jumlah barisnya, dan baris tanpa
 * bukti adalah angka yang tidak bisa diperiksa siapa pun — cukup mengetik 40
 * baris kosong untuk mendapat nilai penuh. Diminta tegas: "wajib menghasilkan
 * bukti hasil submit".
 */
const WAJIB_BUKTI: JenisEntri[] = ["hygiene_cctv"];

/** Batas satu berkas bukti — sama dengan janji modul lain. */
const MAKS_BUKTI = 10 * 1024 * 1024;

/**
 * Jalur cadangan unggah bukti, dipakai hanya saat R2 tidak aktif.
 *
 * Jalur utamanya langsung dari peramban ke penyimpanan (`uploadMany`); yang ini
 * menempuh fungsi serverless, jadi batasnya diperiksa lebih dulu — berkas yang
 * terlalu besar ditolak SEBELUM platform memutusnya dengan pesan yang tidak
 * menjelaskan apa pun.
 */
export async function uploadKpiBuktiAction(formData: FormData): Promise<{ path?: string; name?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (!canReachMenu(user, "kpi_op_ca" as MenuKey)) return { error: "Tidak punya akses." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  if (file.size > MAKS_BUKTI) return { error: `Berkas "${file.name}" melebihi 10 MB.` };
  if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
    return { error: `"${file.name}" harus berupa gambar atau PDF.` };
  }

  const aman = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const nama = `kpi/bukti/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${aman}`;
  const { error } = await db().storage.from("system-attachments").upload(nama, file, { contentType: file.type });
  if (error) return { error: `Unggah gagal: ${error.message}` };
  return { path: nama, name: file.name };
}

export async function simpanEntriAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
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
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) return { error: "Tanggalnya belum diisi." };
  // Tanggal di luar bulan yang sedang diisi hampir selalu salah ketik, dan
  // diam-diam menambah angka ke bulan yang sudah lewat.
  if (input.tanggal.slice(0, 7) !== input.periode) return { error: "Tanggalnya di luar bulan yang sedang diisi." };
  // Dijaga DI SERVER, bukan cuma tombolnya disembunyikan di layar.
  if (WAJIB_BUKTI.includes(input.jenis) && (input.lampiran ?? []).length === 0) {
    return { error: "Lampirkan dulu buktinya — foto atau tangkapan layar hasil submit." };
  }

  const res = await simpanEntri({
    jenis: input.jenis,
    periode: input.periode,
    posisi: input.posisi,
    pic: input.pic ?? "",
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

/**
 * Banyak baris kegiatan sekaligus — event, kunjungan QC, riset menu.
 *
 * Bentuk satu-per-satu memaksa buka-isi-simpan berulang untuk pekerjaan yang
 * datang berombongan: tiga puluh event sebulan berarti tiga puluh putaran.
 */
export async function simpanEntriMassalAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  jenis: JenisEntri;
  baris: {
    tanggal: string;
    picNama?: string;
    outletId?: string | null;
    judul?: string;
    deskripsi?: string;
    lampiran?: { path: string; name: string }[];
  }[];
}): Promise<{ ok?: true; tersimpan?: number; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  let n = 0;
  for (const b of input.baris) {
    if (!b.tanggal && !b.judul) continue; // baris kosong yang tidak jadi diisi
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal)) return { error: "Ada baris yang tanggalnya belum diisi." };
    if (b.tanggal.slice(0, 7) !== input.periode) return { error: "Ada tanggal di luar bulan yang sedang diisi." };
    // Buktinya diperiksa PER BARIS. Memeriksanya sekali untuk seluruh tabel
    // berarti satu lampiran cukup untuk empat puluh baris.
    if (WAJIB_BUKTI.includes(input.jenis) && (b.lampiran ?? []).length === 0) {
      return { error: "Ada baris tanpa bukti — tiap catatan wajib berlampiran." };
    }

    const res = await simpanEntri({
      jenis: input.jenis,
      periode: input.periode,
      posisi: input.posisi,
      pic: input.pic ?? "",
      tanggal: b.tanggal,
      picNama: (b.picNama ?? g.user.name).slice(0, 120),
      outletId: b.outletId ?? null,
      judul: (b.judul ?? "").slice(0, 200),
      deskripsi: (b.deskripsi ?? "").slice(0, 1000),
      nominal: null,
      nominalSeharusnya: null,
      tenggat: null,
      gagal: false,
      lampiran: (b.lampiran ?? []).slice(0, 10),
      olehId: g.user.id,
      olehNama: g.user.name,
    });
    if (res.error) return { error: res.error };
    n += 1;
  }
  if (n === 0) return { error: "Belum ada baris yang diisi." };
  revalidatePath(RUTE(input.posisi));
  return { ok: true, tersimpan: n };
}

/**
 * Menu Keberhasilan Pasar sekaligus — dipilih dari katalog ESB.
 *
 * Nama menunya tidak diketik: salah ketik satu huruf membuat penjualannya tidak
 * pernah bisa dicocokkan dengan ESB nanti, dan salah ketik itu baru ketahuan
 * berbulan-bulan kemudian.
 */
export async function simpanMenuPasarMassalAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  baris: { menu: string; penjualan: number }[];
}): Promise<{ ok?: true; tersimpan?: number; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "keberhasilan_pasar")) return { error: "Posisi ini tidak menilai keberhasilan pasar." };

  let n = 0;
  for (const b of input.baris) {
    if (!b.menu.trim()) continue;
    const res = await simpanMenuPasar({
      periode: input.periode,
      posisi: input.posisi,
      pic: input.pic ?? "",
      menu: b.menu.trim(),
      penjualan: b.penjualan,
      // Omsetnya tidak lagi diketik: diambil dari net sales ESB pada rentang
      // yang sama. Nol di sini berarti "pakai yang dari ESB".
      omset: 0,
      olehId: g.user.id,
    });
    if (res.error) return { error: res.error };
    n += 1;
  }
  if (n === 0) return { error: "Belum ada menu yang dipilih." };
  revalidatePath(RUTE(input.posisi));
  return { ok: true, tersimpan: n };
}

/**
 * Angka bulanan BANYAK OUTLET sekaligus — laba bersih, HPP, dan gross manual.
 *
 * Bentuknya tabel karena satu area berisi belasan outlet: memilih outlet lalu
 * menyimpan satu per satu berarti belasan putaran tiap bulan, dan pekerjaan
 * sebanyak itu tidak pernah selesai dikerjakan sampai habis.
 *
 * Gross manual hanya diterima untuk outlet yang ESB-nya memang tidak punya
 * angkanya. Menerimanya untuk yang lain membuka jalan menimpa angka ESB dengan
 * angka yang diketik — dan tidak akan ada yang tahu mana yang sedang dibaca.
 */
export async function simpanOutletBulananAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  baris: { outletId: string; gross?: number | null; netProfit?: number | null; hppNominal?: number | null }[];
}): Promise<{ ok?: true; tersimpan?: number; error?: string }> {
  // Angka per outlet menempel pada OUTLET dan BULAN, bukan pada orangnya — jadi
  // menyimpannya sambil melihat gabungan seluruh Coordinator Area tidak
  // menimbulkan angka yang tak bisa ditelusuri. Yang tetap dijaga: outletnya
  // harus benar-benar dipegang seseorang.
  const gabungan = (input.pic ?? "") === SEMUA_PIC;
  const g = await gerbang(input.posisi, input.periode, gabungan ? "" : input.pic, { izinkanGabungan: gabungan });
  if ("error" in g) return { error: g.error };

  // Dijaga DI SINI, bukan cuma dengan menyembunyikan pilihannya di layar.
  // Pilihan yang tidak tampil tetap bisa dipanggil langsung, dan penjagaan
  // yang hanya ada di tampilan bukan penjagaan.
  //
  // KETIGA angkanya sekaligus — penjualan, laba, dan harga pokok. Ketiganya
  // menilai orang yang sama; mengecualikan salah satunya membuka celah yang
  // persis sama dengan membuka ketiganya.
  if (
    !bolehAngkaOutlet(g.user) &&
    input.baris.some((b) => b.gross !== undefined || b.netProfit !== undefined || b.hppNominal !== undefined)
  ) {
    return { error: "Gross Sales, Net Profit, dan Harga Pokok Penjualan hanya bisa diubah super admin." };
  }

  const boleh = gabungan ? outletSeluruhPic(input.posisi) : outletMilikPic(input.pic ?? "");
  let n = 0;
  for (const b of input.baris) {
    if (!boleh.has(b.outletId)) return { error: "Ada outlet yang bukan bagian dari area ini." };
    const angka = [b.gross, b.netProfit, b.hppNominal];
    if (angka.every((v) => v === undefined)) continue;
    // NET PROFIT BOLEH MINUS — itu rugi, dan outlet yang rugi justru yang paling
    // perlu terbaca. Menolaknya membuat bulan yang buruk mustahil dilaporkan
    // apa adanya; yang mengisinya akan memasukkan nol atau membiarkannya kosong,
    // dan laporannya jadi lebih baik daripada kenyataannya.
    //
    // Penjualan dan harga pokok tidak bisa minus: yang minus di situ pasti
    // salah ketik.
    const takBolehMinus = [b.gross, b.hppNominal];
    if (takBolehMinus.some((v) => v !== undefined && v !== null && v < 0)) {
      return { error: "Penjualan dan harga pokok tidak bisa minus." };
    }

    // Diteruskan APA ADANYA: `undefined` berarti jangan disentuh, `null`
    // berarti kosongkan. Mengubah `undefined` jadi `null` di sini akan
    // menghapus kolom lain yang tidak sedang diisi.
    const res = await simpanOutletBulanan({
      outletId: b.outletId,
      periode: input.periode,
      gross: b.gross,
      netProfit: b.netProfit,
      hppNominal: b.hppNominal,
      olehId: g.user.id,
      olehNama: g.user.name,
    });
    if (res.error) return { error: res.error };
    n += 1;
  }
  if (n === 0) return { error: "Tidak ada yang berubah." };
  revalidatePath(RUTE(input.posisi));
  return { ok: true, tersimpan: n };
}

export async function hapusEntriAction(input: { posisi: string; periode: string; pic?: string; id: string }): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  const res = await hapusEntri(input.id);
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

/**
 * Realisasi beban operasional BANYAK outlet sekaligus.
 *
 * Diminta tegas: "form itu seperti tabel tinggal saya input, tidak perlu pilih
 * outlet simpan — jadi itu membuat kerja berulang". Lima puluh delapan outlet
 * dikali dua kolom berarti 116 kali buka-pilih-simpan, dan pekerjaan sebanyak
 * itu tidak akan pernah selesai dikerjakan sampai habis.
 *
 * Yang dikirim hanya baris yang BERUBAH; sisanya tidak ikut ditulis ulang.
 */
export async function simpanEfisiensiMassalAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  baris: { outletId: string; actualWh: number | null; actualNonWh: number | null }[];
}): Promise<{ ok?: true; tersimpan?: number; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "efisiensi")) return { error: "Posisi ini tidak dinilai efisiensi beban operasional." };

  let n = 0;
  for (const b of input.baris) {
    if (!b.outletId) continue;
    const res = await simpanEfisiensi({
      periode: input.periode,
      posisi: input.posisi,
      pic: input.pic ?? "",
      outletId: b.outletId,
      actualWh: b.actualWh,
      actualNonWh: b.actualNonWh,
      olehId: g.user.id,
    });
    if (res.error) return { error: res.error };
    n += 1;
  }
  revalidatePath(RUTE(input.posisi));
  return { ok: true, tersimpan: n };
}

/**
 * Ceklis management fee BANYAK outlet sekaligus.
 *
 * Bentuknya satu tabel berisi seluruh outlet dengan net sales dan fee 5%-nya
 * sudah terisi; yang mengisinya tinggal mencentang yang sesuai dan menuliskan
 * selisihnya pada yang tidak.
 */
export async function simpanFeeMassalAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  baris: { outletId: string; sesuai: boolean; catatan?: string }[];
}): Promise<{ ok?: true; tersimpan?: number; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "management_fee")) return { error: "Posisi ini tidak menilai management fee." };

  let n = 0;
  for (const b of input.baris) {
    if (!b.outletId) continue;
    const res = await simpanFee({
      periode: input.periode,
      outletId: b.outletId,
      sesuai: b.sesuai,
      catatan: b.catatan ?? "",
      olehId: g.user.id,
    });
    if (res.error) return { error: res.error };
    n += 1;
  }
  revalidatePath(RUTE(input.posisi));
  return { ok: true, tersimpan: n };
}

/** Realisasi beban operasional satu outlet. */
export async function simpanEfisiensiAction(input: {
  posisi: string;
  periode: string;
  pic?: string;
  outletId: string;
  actualWh: number | null;
  actualNonWh: number | null;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
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
  pic?: string;
  outletId: string;
  sesuai: boolean;
  catatan?: string;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
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
  pic?: string;
  menu: string;
  penjualan: number;
  omset: number;
}): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  if (!punyaIndikator(input.posisi, "keberhasilan_pasar")) return { error: "Posisi ini tidak menilai keberhasilan pasar." };
  if (!input.menu.trim()) return { error: "Nama menunya belum diisi." };

  const res = await simpanMenuPasar({ ...input, menu: input.menu.trim(), olehId: g.user.id });
  if (res.error) return { error: res.error };
  revalidatePath(RUTE(input.posisi));
  return { ok: true };
}

export async function hapusMenuPasarAction(input: { posisi: string; periode: string; pic?: string; menu: string }): Promise<{ ok?: true; error?: string }> {
  const g = await gerbang(input.posisi, input.periode, input.pic);
  if ("error" in g) return { error: g.error };
  const res = await hapusMenuPasar(input.periode, input.posisi, input.menu, input.pic ?? "");
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
