import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { areaName, getOutlets, getUsers } from "./store";

/**
 * WORK Z-02 — PEMBACANYA.
 *
 * ┌─ OTORISASI TIDAK DIPUTUSKAN DI SINI ─────────────────────────────────────┐
 * │                                                                          │
 * │ Halaman yang menjalankan gerbangnya dan menyampaikan HASILNYA ke sini    │
 * │ sebagai `seluruhnya` dan `userId` — pola yang sama persis dengan         │
 * │ `papanCommandCenter()`. Pembaca yang memutuskan sendiri siapa boleh      │
 * │ melihat apa berarti dua tempat memutuskan satu hal, dan yang kedua akan  │
 * │ menyimpang diam-diam.                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ `persempit()` TIDAK DIPAKAI, DAN ITU KEPUTUSAN OWNER ───────────────────┐
 * │                                                                          │
 * │ `works` TIDAK punya `outlet_id`, dan satu Work bisa menangani Signal     │
 * │ dari beberapa outlet sekaligus (D3 · N:N). O-06 mengunci VIEW Work       │
 * │ sebagai "akses Command Center ATAU pelaksana aktif" — tanpa penyempitan  │
 * │ outlet, dan OD-01 = A menegaskannya. Menyaring Work lewat outlet Signal  │
 * │ berarti menjawab "Work dua outlet masuk cakupan siapa", pertanyaan yang  │
 * │ tidak pernah diputuskan siapa pun.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TENGGAT DIBACA, TIDAK PERNAH DIHITUNG ULANG ────────────────────────────┐
 * │                                                                          │
 * │ Kebijakan `Z02-SLA-v1` hidup di `gwg_buat_work` dan hasilnya sudah beku  │
 * │ di `works.tenggat` (O-04, I-10). Menghitungnya lagi di sini berarti dua  │
 * │ kebijakan tenggat untuk satu perusahaan — dan yang kedua akan menggeser  │
 * │ Work lama ketika kebijakannya berubah, persis yang dicegah I-11.         │
 * │                                                                          │
 * │ `signals.diamati_pada` DILARANG menjadi dasar tenggat maupun overdue     │
 * │ (O-02): ia ditulis ulang detektor setiap hari.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TIDAK MENULIS APA PUN.
 */

/* ─────────────────────────────── bentuk ─────────────────────────────── */

/** Status yang dianggap masih berjalan — dasar daftar bawaan (OD-05). */
export const STATUS_AKTIF = ["open", "in_progress"] as const;

/** Keempat status kontrak (O-05). Tidak ada yang kelima. */
export const STATUS_WORK = ["open", "in_progress", "completed", "cancelled"] as const;

const TERMINAL = new Set<string>(["completed", "cancelled"]);

/**
 * Satu baris daftar Work.
 *
 * TIDAK ADA `severity` di sini, dan itu keputusan (OD-03 = A): severity milik
 * Signal. Work tidak punya severity, tidak diurutkan dengannya, dan tidak
 * diberi label yang menyiratkan ia punya.
 */
export interface BarisWork {
  id: number;
  judul: string;
  status: string;
  ownerId: string;
  ownerNama: string;
  primaryDepartment: string;
  tenggatKategori: string;
  tenggat: string;
  dibuatPada: string;
  /** Turunan: `tenggat` sudah lewat DAN pekerjaannya belum berhenti. */
  overdue: boolean;
  jumlahSignalAktif: number;
  jumlahPelaksanaAktif: number;
}

export interface SaringanWork {
  /** Kosong berarti daftar bawaan: hanya yang masih berjalan (OD-05). */
  status?: readonly string[];
  /** Benar berarti hanya yang tenggatnya sudah lewat. */
  overdue?: boolean;
  ownerId?: string | null;
  departemen?: string | null;
  executorId?: string | null;
}

export interface MintaDaftarWork {
  /** Hasil `canReachMenu(user, MENU_WORK)` di halaman — bukan keputusan baru. */
  seluruhnya: boolean;
  userId: string;
  saring?: SaringanWork;
  pada?: number;
}

export interface DaftarWork {
  baris: BarisWork[];
  /** Benar bila orang ini melihat lewat akses menu, bukan lewat penugasan. */
  seluruhnya: boolean;
  total: number;
  overdue: number;
}

export interface SignalWork {
  signalId: number;
  severity: string;
  kpiDefinitionId: string;
  cakupan: string;
  outletId: string | null;
  outletNama: string | null;
  areaNama: string | null;
  periode: string;
  statusSignal: string;
  diakuiOleh: string | null;
  diakuiNama: string | null;
  diakuiPada: string | null;
  /** Keadaan KAITAN, bukan keadaan Signal. Keduanya terpisah (I-08). */
  aktif: boolean;
  dikaitkanOleh: string;
  dikaitkanNama: string;
  dikaitkanPada: string;
  dilepasOleh: string | null;
  dilepasNama: string | null;
  dilepasPada: string | null;
  alasan: string | null;
}

export interface PelaksanaWork {
  userId: string;
  nama: string;
  departemenSaatDitugaskan: string;
  ditugaskanOleh: string;
  ditugaskanNama: string;
  ditugaskanPada: string;
  aktif: boolean;
  dilepasOleh: string | null;
  dilepasNama: string | null;
  dilepasPada: string | null;
}

export interface RiwayatWork {
  id: number;
  jenis: string;
  nilaiLama: string | null;
  nilaiBaru: string;
  alasan: string | null;
  oleh: string;
  olehNama: string;
  pada: string;
}

export interface DetailWork {
  id: number;
  judul: string;
  deskripsi: string;
  status: string;
  terminal: boolean;
  overdue: boolean;
  ownerId: string;
  ownerNama: string;
  primaryDepartment: string;
  tenggat: string;
  /** Snapshot perhitungan tenggat — dibaca apa adanya, tidak dihitung ulang. */
  tenggatKategori: string;
  tenggatAnchor: string;
  tenggatAnchorPada: string;
  tenggatZona: string;
  tenggatKebijakanVersi: string;
  tenggatDihitungPada: string;
  dibuatOleh: string;
  dibuatNama: string;
  dibuatPada: string;
  diperbaruiPada: string;
  signal: SignalWork[];
  pelaksana: PelaksanaWork[];
  riwayat: RiwayatWork[];
}

/* ─────────────────────────────── baris mentah ─────────────────────────────── */

interface BarisWorks {
  id: number;
  judul: string;
  deskripsi: string;
  owner_id: string;
  primary_department: string;
  status: string;
  tenggat_kategori: string;
  tenggat_anchor: string;
  tenggat_anchor_pada: string;
  tenggat_zona: string;
  tenggat_kebijakan_versi: string;
  tenggat: string;
  tenggat_dihitung_pada: string;
  dibuat_oleh: string;
  dibuat_pada: string;
  diperbarui_pada: string;
}

interface BarisKaitan {
  signal_id: number;
  work_id: number;
  dikaitkan_oleh: string;
  dikaitkan_pada: string;
  dilepas_pada: string | null;
  dilepas_oleh: string | null;
  alasan: string | null;
}

interface BarisPelaksana {
  work_id: number;
  user_id: string;
  ditugaskan_oleh: string;
  ditugaskan_pada: string;
  departemen_saat_ditugaskan: string;
  dilepas_pada: string | null;
  dilepas_oleh: string | null;
}

interface BarisRiwayat {
  id: number;
  work_id: number;
  jenis: string;
  nilai_lama: string | null;
  nilai_baru: string;
  alasan: string | null;
  oleh: string;
  pada: string;
}

interface BarisSignal {
  id: number;
  cakupan: string;
  outlet_id: string | null;
  periode: string;
  kpi_definition_id: string;
  severity: string;
  status: string;
  diakui_oleh: string | null;
  diakui_pada: string | null;
}

const KOLOM_WORKS =
  "id,judul,deskripsi,owner_id,primary_department,status,tenggat_kategori,tenggat_anchor," +
  "tenggat_anchor_pada,tenggat_zona,tenggat_kebijakan_versi,tenggat,tenggat_dihitung_pada," +
  "dibuat_oleh,dibuat_pada,diperbarui_pada";
const KOLOM_KAITAN = "signal_id,work_id,dikaitkan_oleh,dikaitkan_pada,dilepas_pada,dilepas_oleh,alasan";
const KOLOM_PELAKSANA =
  "work_id,user_id,ditugaskan_oleh,ditugaskan_pada,departemen_saat_ditugaskan,dilepas_pada,dilepas_oleh";
const KOLOM_RIWAYAT = "id,work_id,jenis,nilai_lama,nilai_baru,alasan,oleh,pada";
const KOLOM_SIGNAL = "id,cakupan,outlet_id,periode,kpi_definition_id,severity,status,diakui_oleh,diakui_pada";

/* ─────────────────────────────── daftar ─────────────────────────────── */

/**
 * Daftar kerja Work.
 *
 * ┌─ `overdue DESC → tenggat ASC` ADALAH `tenggat ASC` ──────────────────────┐
 * │                                                                          │
 * │ OD-02 = B mengunci "yang terlambat lebih dulu, lalu tenggat terdekat".   │
 * │ Pada daftar bawaan yang isinya HANYA Work berjalan (OD-05), setiap Work  │
 * │ yang sudah lewat tenggat punya tenggat LEBIH AWAL daripada setiap yang   │
 * │ belum — jadi mengurutkan `tenggat` menaik sudah menempatkan seluruh yang │
 * │ terlambat di atas, dengan sendirinya.                                    │
 * │                                                                          │
 * │ Hasilnya satu kolom berindex (`works_tenggat_aktif_idx`), tanpa kolom    │
 * │ turunan dan tanpa pengurutan di memori — jadi paginasinya tetap sah.     │
 * │ `id` menutupnya sebagai pemutus seri TEKNIS: `paged.ts` mewajibkan       │
 * │ urutan pada kolom unik supaya batas halaman tidak menggeser baris. Ia    │
 * │ bukan peringkat bisnis.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export async function daftarWork(m: MintaDaftarWork): Promise<DaftarWork> {
  const pada = m.pada ?? Date.now();
  const kosong: DaftarWork = { baris: [], seluruhnya: m.seluruhnya, total: 0, overdue: 0 };
  if (!dbEnabled) return kosong;

  const saring = m.saring ?? {};
  const status = saringStatus(saring.status);

  // ── batas visibilitas ──
  //
  // Tanpa akses menu, yang terbaca HANYA Work yang orang ini pegang sekarang.
  // Penugasan yang sudah dilepas TIDAK memberi akses apa pun: ia rekam audit,
  // bukan hak baca yang tersisa.
  let batasId: number[] | null = null;
  if (!m.seluruhnya) {
    batasId = await workPelaksanaAktif(m.userId);
    if (batasId.length === 0) return kosong;
  }
  if (saring.executorId) {
    const punya = await workPelaksanaAktif(saring.executorId);
    batasId = batasId === null ? punya : batasId.filter((id) => punya.includes(id));
    if (batasId.length === 0) return kosong;
  }

  const works = await bacaWorks({ status, batasId, saring, sekarang: new Date(pada).toISOString() });
  if (works.length === 0) return kosong;

  const ids = works.map((w) => w.id);
  const [kaitan, pelaksana] = await Promise.all([bacaKaitan(ids), bacaPelaksana(ids)]);

  const cacahSignal = cacahAktif(kaitan, (r) => r.work_id, (r) => r.dilepas_pada === null);
  const cacahPelaksana = cacahAktif(pelaksana, (r) => r.work_id, (r) => r.dilepas_pada === null);
  const nama = petaNama();

  const baris = works.map((w) => ({
    id: w.id,
    judul: w.judul,
    status: w.status,
    ownerId: w.owner_id,
    ownerNama: nama.orang.get(w.owner_id) ?? w.owner_id,
    primaryDepartment: w.primary_department,
    tenggatKategori: w.tenggat_kategori,
    tenggat: w.tenggat,
    dibuatPada: w.dibuat_pada,
    overdue: sudahLewatTenggat(w.tenggat, w.status, pada),
    jumlahSignalAktif: cacahSignal.get(w.id) ?? 0,
    jumlahPelaksanaAktif: cacahPelaksana.get(w.id) ?? 0,
  }));

  return { baris, seluruhnya: m.seluruhnya, total: baris.length, overdue: baris.filter((b) => b.overdue).length };
}

/**
 * Sudah lewat tenggat?
 *
 * ┌─ DUA INSTAN, BUKAN DUA TANGGAL ──────────────────────────────────────────┐
 * │                                                                          │
 * │ `works.tenggat` bertipe `timestamptz` — ia titik waktu absolut, bukan    │
 * │ tanggal kalender. Membandingkannya dengan sekarang karena itu TIDAK      │
 * │ menuntut pergeseran zona apa pun, dan menggesernya +7 jam justru akan    │
 * │ MEMINDAHKAN batasnya tujuh jam dari tempat yang benar.                   │
 * │                                                                          │
 * │ Kalender bisnisnya tetap WIB: nilai `tenggat` itu sendiri sudah lahir    │
 * │ dari kebijakan ber-`tenggat_zona = 'Asia/Jakarta'` di `gwg_buat_work`,   │
 * │ dan layar menampilkannya dalam WIB. Yang tidak boleh terjadi adalah      │
 * │ zona diterapkan DUA KALI.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Work yang sudah `completed` maupun `cancelled` TIDAK PERNAH overdue: ia
 * sudah berhenti, dan tanggal yang lewat sesudahnya tidak menuntut siapa pun.
 */
export function sudahLewatTenggat(tenggat: string, status: string, pada: number): boolean {
  if (TERMINAL.has(status)) return false;
  return Date.parse(tenggat) < pada;
}

/** Daftar status yang diminta; kosong berarti hanya yang masih berjalan. */
export function saringStatus(diminta?: readonly string[]): string[] {
  const bersih = (diminta ?? []).filter((s) => (STATUS_WORK as readonly string[]).includes(s));
  return bersih.length > 0 ? [...new Set(bersih)] : [...STATUS_AKTIF];
}

/* ─────────────────────────────── detail ─────────────────────────────── */

/**
 * Satu Work beserta seluruh yang melekat padanya.
 *
 * Terminal TETAP terbaca penuh — yang berhenti mutasinya, bukan pembacaannya
 * (AD-20 · G). Kaitan Signal dan penugasan yang sudah DILEPAS ikut terbawa,
 * karena keduanya rekam audit permanen (I-16, I-26, I-27, I-28); menyembunyikan
 * mereka membuat jejaknya tidak berguna.
 */
export async function detailWork(id: number, pada: number = Date.now()): Promise<DetailWork | null> {
  if (!dbEnabled) return null;
  if (!Number.isInteger(id) || id <= 0) return null;

  const { data, error } = await db().from("works").select(KOLOM_WORKS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const w = data as unknown as BarisWorks;

  const [kaitan, pelaksana, riwayat] = await Promise.all([bacaKaitan([id]), bacaPelaksana([id]), bacaRiwayat(id)]);

  // Satu pembacaan untuk SELURUH Signal yang terkait — bukan satu per kaitan.
  const signalIds = [...new Set(kaitan.map((k) => k.signal_id))];
  const signal = signalIds.length === 0 ? [] : await bacaSignal(signalIds);
  const petaSignal = new Map(signal.map((s) => [s.id, s]));

  const nama = petaNama();
  const orang = (id: string | null): string | null => (id === null ? null : (nama.orang.get(id) ?? id));

  return {
    id: w.id,
    judul: w.judul,
    deskripsi: w.deskripsi,
    status: w.status,
    terminal: TERMINAL.has(w.status),
    overdue: sudahLewatTenggat(w.tenggat, w.status, pada),
    ownerId: w.owner_id,
    ownerNama: orang(w.owner_id) ?? w.owner_id,
    primaryDepartment: w.primary_department,
    tenggat: w.tenggat,
    tenggatKategori: w.tenggat_kategori,
    tenggatAnchor: w.tenggat_anchor,
    tenggatAnchorPada: w.tenggat_anchor_pada,
    tenggatZona: w.tenggat_zona,
    tenggatKebijakanVersi: w.tenggat_kebijakan_versi,
    tenggatDihitungPada: w.tenggat_dihitung_pada,
    dibuatOleh: w.dibuat_oleh,
    dibuatNama: orang(w.dibuat_oleh) ?? w.dibuat_oleh,
    dibuatPada: w.dibuat_pada,
    diperbaruiPada: w.diperbarui_pada,
    signal: kaitan.map((k) => {
      const s = petaSignal.get(k.signal_id);
      const o = s?.outlet_id ? nama.outlet.get(s.outlet_id) : undefined;
      return {
        signalId: k.signal_id,
        severity: s?.severity ?? "—",
        kpiDefinitionId: s?.kpi_definition_id ?? "—",
        cakupan: s?.cakupan ?? "—",
        outletId: s?.outlet_id ?? null,
        outletNama: o?.nama ?? s?.outlet_id ?? null,
        areaNama: o?.area ?? null,
        periode: s?.periode ?? "—",
        statusSignal: s?.status ?? "—",
        diakuiOleh: s?.diakui_oleh ?? null,
        diakuiNama: orang(s?.diakui_oleh ?? null),
        diakuiPada: s?.diakui_pada ?? null,
        aktif: k.dilepas_pada === null,
        dikaitkanOleh: k.dikaitkan_oleh,
        dikaitkanNama: orang(k.dikaitkan_oleh) ?? k.dikaitkan_oleh,
        dikaitkanPada: k.dikaitkan_pada,
        dilepasOleh: k.dilepas_oleh,
        dilepasNama: orang(k.dilepas_oleh),
        dilepasPada: k.dilepas_pada,
        alasan: k.alasan,
      };
    }),
    pelaksana: pelaksana.map((p) => ({
      userId: p.user_id,
      nama: orang(p.user_id) ?? p.user_id,
      departemenSaatDitugaskan: p.departemen_saat_ditugaskan,
      ditugaskanOleh: p.ditugaskan_oleh,
      ditugaskanNama: orang(p.ditugaskan_oleh) ?? p.ditugaskan_oleh,
      ditugaskanPada: p.ditugaskan_pada,
      aktif: p.dilepas_pada === null,
      dilepasOleh: p.dilepas_oleh,
      dilepasNama: orang(p.dilepas_oleh),
      dilepasPada: p.dilepas_pada,
    })),
    riwayat: riwayat.map((r) => ({
      id: r.id,
      jenis: r.jenis,
      nilaiLama: r.nilai_lama,
      nilaiBaru: r.nilai_baru,
      alasan: r.alasan,
      oleh: r.oleh,
      olehNama: orang(r.oleh) ?? r.oleh,
      pada: r.pada,
    })),
  };
}

/* ─────────────────────────────── pembacaan ─────────────────────────────── */

/**
 * Seluruh pembacaan lewat `selectAll` dengan urutan pada kolom unik.
 *
 * PostgREST memotong setiap permintaan pada 1.000 baris TANPA galat — lihat
 * `paged.ts`. Pembacaan yang bisa melewatinya dan tidak lewat `selectAll` akan
 * kehilangan baris tanpa jejak, dan tidak ada yang terlihat salah dari layar.
 */
function bacaWorks(m: {
  status: string[];
  batasId: number[] | null;
  saring: SaringanWork;
  sekarang: string;
}): Promise<BarisWorks[]> {
  return selectAll<BarisWorks>("works", (a, b) => {
    let q = db().from("works").select(KOLOM_WORKS).in("status", m.status);
    if (m.batasId !== null) q = q.in("id", m.batasId);
    if (m.saring.ownerId) q = q.eq("owner_id", m.saring.ownerId);
    if (m.saring.departemen) q = q.eq("primary_department", m.saring.departemen);
    // Overdue disaring di basis data, bukan sesudah barisnya ditarik: menyaring
    // di memori berarti halaman terakhir bisa kosong sementara masih ada baris.
    if (m.saring.overdue) q = q.lt("tenggat", m.sekarang);
    return q.order("tenggat").order("id").range(a, b);
  }).catch(() => [] as BarisWorks[]);
}

/** Work yang sedang dipegang seseorang. Yang sudah dilepas tidak ikut. */
function workPelaksanaAktif(userId: string): Promise<number[]> {
  return selectAll<{ work_id: number }>("work_executors", (a, b) =>
    db()
      .from("work_executors")
      .select("work_id")
      .eq("user_id", userId)
      .is("dilepas_pada", null)
      .order("work_id")
      .range(a, b),
  )
    .then((r) => [...new Set(r.map((x) => x.work_id))])
    .catch(() => [] as number[]);
}

function bacaKaitan(ids: number[]): Promise<BarisKaitan[]> {
  return selectAll<BarisKaitan>("signal_work", (a, b) =>
    db().from("signal_work").select(KOLOM_KAITAN).in("work_id", ids).order("work_id").order("signal_id").range(a, b),
  ).catch(() => [] as BarisKaitan[]);
}

function bacaPelaksana(ids: number[]): Promise<BarisPelaksana[]> {
  return selectAll<BarisPelaksana>("work_executors", (a, b) =>
    db()
      .from("work_executors")
      .select(KOLOM_PELAKSANA)
      .in("work_id", ids)
      .order("work_id")
      .order("user_id")
      .range(a, b),
  ).catch(() => [] as BarisPelaksana[]);
}

/** Kronologis menaik — `work_riwayat_urut_idx (work_id, pada)`. */
function bacaRiwayat(id: number): Promise<BarisRiwayat[]> {
  return selectAll<BarisRiwayat>("work_riwayat", (a, b) =>
    db().from("work_riwayat").select(KOLOM_RIWAYAT).eq("work_id", id).order("pada").order("id").range(a, b),
  ).catch(() => [] as BarisRiwayat[]);
}

function bacaSignal(ids: number[]): Promise<BarisSignal[]> {
  return selectAll<BarisSignal>("signals", (a, b) =>
    db().from("signals").select(KOLOM_SIGNAL).in("id", ids).order("id").range(a, b),
  ).catch(() => [] as BarisSignal[]);
}

/* ─────────────────────────────── penyusunan ─────────────────────────────── */

interface PetaNama {
  outlet: Map<string, { nama: string; area: string }>;
  orang: Map<string, string>;
}

/**
 * Nama orang dan outlet TIDAK di-join dari basis data.
 *
 * Pola yang sama dengan `command-center.ts`: satu peta di memori dari
 * `store.ts`, bukan satu kueri per baris. Join lewat PostgREST pada relasi N:N
 * juga membuat paginasi tidak bisa diandalkan.
 */
function petaNama(): PetaNama {
  const outlet = new Map<string, { nama: string; area: string }>();
  for (const o of getOutlets()) outlet.set(o.id, { nama: o.name, area: areaName(o.areaId) });
  const orang = new Map<string, string>();
  for (const u of getUsers()) orang.set(u.id, u.name);
  return { outlet, orang };
}

/** MURNI dan diekspor — supaya cacahnya bisa diuji tanpa basis data. */
export function cacahAktif<T>(baris: T[], kunci: (r: T) => number, aktif: (r: T) => boolean): Map<number, number> {
  const peta = new Map<number, number>();
  for (const r of baris) {
    if (!aktif(r)) continue;
    const k = kunci(r);
    peta.set(k, (peta.get(k) ?? 0) + 1);
  }
  return peta;
}

/* ───────────────────── GAP-04 · arah terbalik: Signal → Work ───────────────────── */

/**
 * SATU SIGNAL BOLEH PUNYA BANYAK WORK, DAN ITU MEMANG KONTRAKNYA.
 *
 * ┌─ YANG DIBACA DI SINI BUKAN PELANGGARAN ──────────────────────────────────┐
 * │                                                                          │
 * │ D3 mengunci Signal ↔ Work sebagai N:N, dan `primary key (signal_id,      │
 * │ work_id)` mengunci PASANGANNYA — bukan Signalnya. Satu Signal biaya      │
 * │ tenaga kerja yang melewati ambang bisa sah melahirkan dua Work berbeda:  │
 * │ satu menjadwal ulang shift, satu menegosiasi ulang kontrak.              │
 * │                                                                          │
 * │ Jadi yang dibaca di sini BUKAN untuk menolak apa pun. Ia untuk menjawab  │
 * │ satu pertanyaan yang selama ini tidak punya jawaban di layar mana pun:   │
 * │ "apakah sudah ada yang mengerjakan Signal ini?" Yang memutuskan tetap    │
 * │ orangnya.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ HANYA YANG MASIH BERJALAN (OD-STEP8E-02) ───────────────────────────────┐
 * │                                                                          │
 * │ Kaitan pada Work yang sudah selesai TIDAK PERNAH dihapus — I-16 dan      │
 * │ BLOCKER-1 menyimpannya sebagai rekam audit permanen. Karena itu cacah    │
 * │ SELURUH Work per Signal hanya bertambah dan tidak pernah menyusut, dan   │
 * │ Signal berumur panjang akan terlihat "punya banyak Work" padahal         │
 * │ semuanya sudah tutup berbulan-bulan lalu. Yang berguna ditanyakan        │
 * │ sebelum membuat Work baru hanyalah: apakah masih ada yang BERJALAN.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export interface WorkAktifSignal {
  workId: number;
  judul: string;
  status: string;
  ownerId: string;
  ownerNama: string;
  tenggat: string;
}

/** Peta yang dikirim ke komponen klien — kunci `signal_id` sebagai teks. */
export type PetaWorkAktif = Record<string, WorkAktifSignal[]>;

/**
 * Work yang MASIH BERJALAN untuk tiap Signal yang diminta.
 *
 * Dua pembacaan, bukan satu per Signal: kaitannya dulu, lalu Work-nya sekali.
 * Signal tanpa Work berjalan tidak muncul sebagai kunci sama sekali — peta
 * kosong dan "tidak ada Work" adalah jawaban yang sama, dan itu memang benar.
 */
export async function workAktifPerSignal(signalIds: number[]): Promise<PetaWorkAktif> {
  const unik = [...new Set(signalIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (!dbEnabled || unik.length === 0) return {};

  // Kaitan yang sudah DILEPAS tidak ikut: ia rekam audit, bukan pekerjaan
  // berjalan. Work-nya boleh saja masih hidup, tetapi ia tidak lagi menangani
  // Signal ini — dan itu persis yang dinyatakan pelepasannya (I-16).
  const kaitan = await selectAll<{ signal_id: number; work_id: number }>("signal_work", (a, b) =>
    db()
      .from("signal_work")
      .select("signal_id,work_id")
      .in("signal_id", unik)
      .is("dilepas_pada", null)
      .order("signal_id")
      .order("work_id")
      .range(a, b),
  ).catch(() => [] as { signal_id: number; work_id: number }[]);

  const workIds = [...new Set(kaitan.map((k) => k.work_id))];
  if (workIds.length === 0) return {};

  // Penyaringan status dilakukan BASIS DATA, bukan sesudah barisnya ditarik:
  // Work terminal tidak pernah ikut terbawa, sebanyak apa pun jumlahnya.
  const works = await selectAll<{
    id: number;
    judul: string;
    status: string;
    owner_id: string;
    tenggat: string;
  }>("works", (a, b) =>
    db()
      .from("works")
      .select("id,judul,status,owner_id,tenggat")
      .in("id", workIds)
      .in("status", [...STATUS_AKTIF])
      .order("id")
      .range(a, b),
  ).catch(() => [] as { id: number; judul: string; status: string; owner_id: string; tenggat: string }[]);

  const nama = petaNama();
  const petaWork = new Map(
    works.map((w) => [
      w.id,
      {
        workId: w.id,
        judul: w.judul,
        status: w.status,
        ownerId: w.owner_id,
        ownerNama: nama.orang.get(w.owner_id) ?? w.owner_id,
        tenggat: w.tenggat,
      } satisfies WorkAktifSignal,
    ]),
  );

  const hasil: PetaWorkAktif = {};
  for (const k of kaitan) {
    const w = petaWork.get(k.work_id);
    if (!w) continue;
    (hasil[String(k.signal_id)] ??= []).push(w);
  }
  return hasil;
}
