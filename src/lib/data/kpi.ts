import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { getOutlets } from "./store";
import { listHcRequests } from "./hc-requests";
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
import { INDIKATOR_KONTEN, hitungKonten } from "@/lib/kpi/konten";
import { posisiDari, type KodePosisi } from "@/lib/kpi/struktur";

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
  /**
   * Dari mana actual-nya diambil untuk indikator yang punya DUA jalan.
   *
   * Jumlah Konten bisa dihitung sendiri dari Antrian Design, atau diketik.
   * Yang menentukan bukan kode, melainkan kesepakatan tim — dan itu berubah
   * (bulan pertama biasanya manual sampai kategori designnya rapi).
   */
  sumber: "otomatis" | "manual" | null;
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
      sumber: r.sumber === "otomatis" || r.sumber === "manual" ? r.sumber : null,
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
  sumber: "otomatis" | "manual" | null;
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
    sumber: input.sumber,
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

/**
 * Jumlah konten selesai per jenis dan brand, dari Antrian Design.
 *
 * Dipakai indikator Jumlah Konten Post/Reels/Story ketika sumbernya disetel
 * otomatis. Yang dihitung hanya permintaan berstatus terlaksana — permintaan
 * yang masih dikerjakan belum menghasilkan konten apa pun.
 */
async function kontenDariDesign(periode: string) {
  const rows = await listHcRequests({ kind: "design", semua: true });
  return hitungKonten(
    rows.map((r) => ({
      designType: r.designType,
      outletNama: r.outletName,
      status: r.status,
      periode: r.createdAt.slice(0, 7),
    })),
    periode,
  );
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
 * Net sales per CABANG ESB untuk satu bulan, dari data harian yang disinkron.
 *
 * Kuncinya id cabang ESB ("18-fnb_nord"), bukan nama outlet. Sempat dicocokkan
 * dengan nama, dan hasilnya nol dari 58 outlet: `seasonal_daily.branch`
 * menyimpan id ESB, sementara `outlets.name` menyimpan nama panjang cabangnya.
 * Tabel Efisiensi dan Management Fee karena itu tampil kosong seluruhnya —
 * tanpa satu pun pesan galat, karena memang tidak ada yang gagal; yang
 * dicocokkan saja tidak pernah bisa bertemu.
 */
async function netSalesPerOutlet(periode: string): Promise<Map<string, number>> {
  const peta = new Map<string, number>();
  if (!dbEnabled) return peta;
  const { data } = await db()
    .from("seasonal_daily")
    .select("branch,net")
    .gte("day", `${periode}-01`)
    .lt("day", `${bulanSetelah(periode)}-01`);
  for (const r of ((data ?? []) as { branch: string; net: number | string }[])) {
    peta.set(r.branch, (peta.get(r.branch) ?? 0) + (Number(r.net) || 0));
  }
  return peta;
}

/** Rata-rata net sales tiga bulan terakhir per cabang ESB — dasar budget efisiensi. */
async function averageTigaBulan(periode: string): Promise<Map<string, number>> {
  const bulan = [periode, bulanSebelum(periode), bulanSebelum(bulanSebelum(periode))];
  const petaBulan = await Promise.all(bulan.map(netSalesPerOutlet));
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

  const lalu = new Map<string, number>();
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
  // Jumlah Konten otomatis hanya bila memang disetel begitu. Bawaannya
  // otomatis: kategori designnya sudah terisi rapi di 132 dari 192 permintaan,
  // jadi menariknya sendiri lebih benar daripada meminta orang mengetik ulang.
  const perluKonten = daftar.some(
    (i) => INDIKATOR_KONTEN[i.key] && (pengaturan.get(i.key)?.sumber ?? "otomatis") === "otomatis",
  );
  const perluKomplain = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "komplain_food_quality");
  const perluFee = daftar.some((i) => i.actual.sumber === "otomatis" && i.actual.kode === "management_fee");

  const [design, konten, komplain, netBulan, average, netPerusahaan, omsetTigaBulan] = await Promise.all([
    perluDesign ? designRequest(periode) : Promise.resolve(null),
    perluKonten ? kontenDariDesign(periode) : Promise.resolve(null),
    perluKomplain ? komplainFoodQuality(periode) : Promise.resolve(null),
    perluFee ? netSalesPerOutlet(periode) : Promise.resolve(null),
    PAKAI_EFISIENSI.includes(posisi) ? averageTigaBulan(periode) : Promise.resolve(null),
    perluNetPerusahaan ? netSalesPerusahaan(periode) : Promise.resolve(null),
    // Omset pembanding Keberhasilan Pasar memakai rentang yang SAMA dengan
    // penjualan menunya: tiga bulan. Membandingkan penjualan tiga bulan dengan
    // omset satu bulan melipatgandakan hasilnya tiga kali tanpa ada yang tahu.
    PAKAI_PASAR.includes(posisi)
      ? netSalesPerusahaan(bulanSebelum(bulanSebelum(periode)), periode)
      : Promise.resolve(null),
  ]);

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
    const baris = outletAktif.map((o) =>
      barisEfisiensi({
        outletId: o.id,
        outletNama: o.name,
        average: (o.esbBranchId ? average.get(o.esbBranchId) : undefined) ?? null,
        actualWh: isian.get(o.id)?.wh ?? null,
        actualNonWh: isian.get(o.id)?.nonWh ?? null,
      }),
    );
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
    konten,
    komplain,
    efisiensi,
    fee,
    pasar,
    netPerusahaan,
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
  konten: Record<string, Record<string, number>> | null;
  komplain: number | null;
  efisiensi: LaporanKpi["efisiensi"];
  fee: DetailFee[] | null;
  pasar: DetailPasar | null;
  netPerusahaan: number | null;
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

  const target = sudahCapaian ? 100 : hitungTarget(jenis, {
    jumlahBrand: k.jumlahBrand,
    jumlahOutlet: k.jumlahOutlet,
    actualBulanLalu: k.lalu,
    jumlahPekerjaan: i.actual.sumber === "otomatis" && i.actual.kode === "design_request" ? (k.design?.masuk ?? null) : null,
  });

  let actual: number | null = null;
  let alasan: string | undefined;

  // Jumlah Konten punya dua jalan: dihitung dari Antrian Design, atau diketik.
  // Yang otomatis diperiksa lebih dulu supaya angka yang pernah diketik tidak
  // menutupi hitungan yang sebenarnya.
  const jenisKonten = INDIKATOR_KONTEN[i.key];
  const kontenOtomatis = !!jenisKonten && (k.pengaturan?.sumber ?? "otomatis") === "otomatis";

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
      if (kontenOtomatis) {
        const per = k.konten?.[jenisKonten];
        actual = per ? Object.values(per).reduce((a, b) => a + b, 0) : null;
        if (actual === null) alasan = "Menunggu data Antrian Design.";
        else {
          const rinci = Object.entries(per!)
            .map(([b, n]) => `${b} ${n}`)
            .join(" · ");
          alasan = `Otomatis dari Antrian Design yang sudah selesai — ${rinci}.`;
        }
      } else {
        actual = k.manual;
        if (actual === null) alasan = "Angkanya belum diisi untuk bulan ini.";
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
      }
      break;
  }

  if (target === null && !alasan) {
    alasan = i.target.jenis === "tumbuh" ? "Belum ada capaian bulan lalu sebagai dasar target." : "Targetnya belum ditetapkan.";
  }

  return barisKpi({ indikator: i, bobot, target, actual, alasan });
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

export const periodeSekarang = (): string => new Date().toISOString().slice(0, 7);
export { bulanSebelum, posisiDari };
