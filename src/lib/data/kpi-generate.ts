import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { netBulananPerCabang } from "./esb-bulanan";
import { grossKetikBulan, grossOutlet, tumbuhCa, type OutletCa } from "./kpi";
import { listExpenses, listPurchases } from "./ops-finance";
import { listPnl } from "./ops-pnl";
import { hitungSales, type NilaiKpi, type NilaiTarget } from "@/lib/ops/kpi-sales";
import { hitungTargetSales, tigaBulanSebelum } from "@/lib/ops/target-sales";
import { hitungKeuangan, type AngkaOutlet } from "@/lib/ops/kpi-finansial";
import { petaCabangOutlet, saringFakta, type BarisSeasonal } from "@/lib/ops/sales-fact";
import { periodeGenerasi, periodeSelesai } from "@/lib/ops/finalisasi";
import { akhirBulan, awalBulan, bulanSah, hariBerjalan, jumlahHari } from "@/lib/ops/waktu";
import type { Outlet } from "@/lib/types";

/**
 * JALUR TULIS BERULANG KPI BULANAN — yang membuat bulan berikutnya terisi
 * sendiri.
 *
 * Sampai TASK #85, ketiga mesin hitung V.1 tidak punya SATU PUN pemanggil di
 * aplikasi. 1.118 baris yang ada di produksi seluruhnya ditulis lewat migrasi
 * tangan. Berkas ini yang menutup lubang itu.
 *
 * ┌─ YANG DIKERJAKAN, DAN YANG TIDAK ────────────────────────────────────────┐
 * │                                                                          │
 * │ DIKERJAKAN: menentukan periode, membaca masukan sekali jalan, memanggil  │
 * │ mesin, memeriksa hasilnya, lalu menyerahkannya ke satu fungsi basis data │
 * │ yang mengurus versi dan keutuhan.                                        │
 * │                                                                          │
 * │ TIDAK DIKERJAKAN: menghitung apa pun. Tidak ada satu baris rumus KPI di  │
 * │ berkas ini. `hitungSales()`, `hitungTargetSales()`, dan                  │
 * │ `hitungKeuangan()` dipanggil apa adanya — mesin yang sama persis dengan  │
 * │ yang sudah direkonsiliasi di Phase 2A dan 2C. Menyalin rumusnya ke sini  │
 * │ berarti dua kebenaran yang bisa berbeda diam-diam.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ TIDAK MEMANGGIL ESB ────────────────────────────────────────────────────┐
 * │                                                                          │
 * │ Seluruh masukannya sudah ada di basis data: `seasonal_daily`,            │
 * │ `esb_net_bulanan`, `op_expenses`, `op_purchases`, `op_pnl`. Karena itu   │
 * │ ia TIDAK mengambil `ambilKunciEsb()` dan tidak pernah ikut antre di      │
 * │ belakang penarikan ESB — yang berarti ia juga tidak ikut gagal ketika    │
 * │ ESB sedang membatasi permintaan.                                         │
 * │                                                                          │
 * │ Bacaannya MASSAL: enam query untuk seluruh outlet, bukan satu query per  │
 * │ outlet. Dengan 58 outlet, bentuk per-outlet akan jadi ratusan            │
 * │ perjalanan bolak-balik dan habis di batas 60 detik Vercel.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/* ────────────────────────────── bentuk hasil ────────────────────────────── */

export interface RingkasGenerasi {
  periode: string;
  /** Salah berarti hasilnya sama dengan yang sudah tersimpan — tidak ada yang ditulis. */
  berubah: boolean;
  versi: number;
  nilaiDisisipkan: number;
  nilaiDigantikan: number;
  targetDisisipkan: number;
  targetDigantikan: number;
  /** Berapa baris yang DIHITUNG mesin, sebelum disimpan. */
  dihitung: { nilai: number; target: number; kosong: number };
  outlet: number;
  periodeSelesai: boolean;
  msBaca: number;
  msHitung: number;
  msTulis: number;
}

/**
 * Ambang kelengkapan yang disuntikkan ke `nilaiKelengkapan()`.
 *
 * `kelengkapan.ts` menolak punya nilai bawaan dengan sengaja: angkanya masih
 * keputusan terbuka (`decisions.md` nomor 14) dan dikunci Phase 4. Yang dipakai
 * di sini TIDAK menyentuh satu pun angka yang disimpan — ambang cuma menentukan
 * `bolehDinilai` dan kalimat alasannya, dan keduanya milik Signal yang belum
 * ada. `kelengkapan_persen` yang ikut tersimpan dihitung tanpa ambang.
 */
const AMBANG = { persen: 95, sumber: "bawaan-phase-4" } as const;

/* ─────────────────────────────── pembacaan ─────────────────────────────── */

interface BarisOutlet {
  id: string;
  name: string;
  code: string;
  city: string | null;
  area_id: string | null;
  supervisor_id: string | null;
  pic_id: string | null;
  active: boolean;
  esb_branch_id: string | null;
  gross_manual: boolean | null;
  esb_mulai: string | null;
  buka_tanggal: string | null;
  esb_abaikan: string[] | null;
}

/** Outlet dibaca LANGSUNG dari basis data, bukan dari `getOutlets()`. */
// Rute cron tidak merender halaman, jadi tidak ada yang menjamin penyimpan di
// memori sudah terisi. Membacanya dari sana berarti generasi bisa berjalan atas
// daftar outlet kosong dan melaporkan sukses.
async function bacaOutlet(): Promise<{ outlets: Outlet[]; ca: OutletCa[] }> {
  const rows = await selectAll<BarisOutlet>("outlets", (a, b) =>
    db().from("outlets").select("*").eq("active", true).order("id").range(a, b),
  );
  const outlets: Outlet[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    city: r.city ?? "",
    areaId: r.area_id ?? "",
    supervisorId: r.supervisor_id ?? "",
    picId: r.pic_id ?? "",
    active: r.active,
    esbBranchId: r.esb_branch_id,
    grossManual: !!r.gross_manual,
    esbMulai: r.esb_mulai,
    bukaTanggal: r.buka_tanggal,
    esbAbaikan: r.esb_abaikan ?? [],
  }));
  const ca: OutletCa[] = rows.map((r) => ({
    id: r.id,
    nama: r.name,
    branch: r.esb_branch_id,
    grossManual: !!r.gross_manual,
    esbMulai: r.esb_mulai,
    bukaTanggal: r.buka_tanggal,
    esbAbaikan: r.esb_abaikan ?? [],
  }));
  return { outlets, ca };
}

/** Baris harian satu bulan, HANYA untuk cabang milik outlet aktif. */
async function bacaSeasonal(periode: string, cabang: string[]): Promise<BarisSeasonal[]> {
  if (cabang.length === 0) return [];
  return selectAll<BarisSeasonal>("seasonal_daily", (a, b) =>
    db()
      .from("seasonal_daily")
      .select("branch,day,net,gross,pax,bills")
      .in("branch", cabang)
      .gte("day", awalBulan(periode))
      .lte("day", akhirBulan(periode))
      .order("day")
      .range(a, b),
  );
}

/**
 * Riwayat tiga bulan untuk target — aturan `grossOutlet()` yang sudah berlaku.
 *
 * Bukan `seasonal_daily`: target memakai gross bulanan dengan aturan
 * penggantian tangan (`esb_mulai`, `esb_abaikan`, isian manual), dan aturan itu
 * milik KPI Coordinator Area. Dipanggil dari sana, bukan ditulis ulang di sini.
 * Yang dikunci ke sales-fact adalah PENYEBUT KPI, bukan riwayat target.
 */
async function bacaRiwayat(periode: string, ca: OutletCa[]): Promise<Map<string, number | null>> {
  const bulan = tigaBulanSebelum(periode);
  const sumber = await Promise.all(
    bulan.map(async (b) => {
      const [esb, ketik] = await Promise.all([netBulananPerCabang(b), grossKetikBulan(b)]);
      const tangan = new Map(
        [...ketik].map(([id, gross]) => [id, { outletId: id, gross, netProfit: null, hppNominal: null }]),
      );
      return { esb, tangan };
    }),
  );
  const riwayat = new Map<string, number | null>();
  for (const o of ca) {
    bulan.forEach((b, i) => riwayat.set(`${o.id}|${b}`, grossOutlet(o, b, sumber[i].esb, sumber[i].tangan)));
  }
  return riwayat;
}

/* ─────────────────────────────── pemeriksaan ─────────────────────────────── */

const STATUS_SAH = new Set(["final", "sementara", "tidak_tersedia", "invalid"]);

const angkaSah = (n: number | null): boolean => n === null || Number.isFinite(n);

/**
 * Periksa hasil mesin SEBELUM apa pun ditulis.
 *
 * Melempar, bukan mengembalikan bendera: hasil yang tidak lolos tidak boleh
 * bisa lolos ke basis data karena seseorang lupa memeriksa kembaliannya.
 */
export function periksaHasil(periode: string, nilai: NilaiKpi[], target: NilaiTarget[], definisiAktif: Set<string>): void {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  if (nilai.length === 0) throw new Error(`tidak ada satu pun baris KPI untuk ${periode}`);

  const grain = new Set<string>();
  for (const n of nilai) {
    if (n.periode !== periode) throw new Error(`baris ${n.kpiDefinitionId} berperiode ${n.periode}, bukan ${periode}`);
    if (n.skala !== "bulanan") throw new Error(`baris ${n.kpiDefinitionId} berskala ${n.skala}, bukan bulanan`);
    if (!definisiAktif.has(n.kpiDefinitionId)) throw new Error(`definisi KPI tidak ada atau tidak aktif: ${n.kpiDefinitionId}`);
    if (!STATUS_SAH.has(n.status)) throw new Error(`status tidak dikenal: ${n.status}`);
    if (!angkaSah(n.nilai)) throw new Error(`nilai bukan angka terhingga pada ${n.kpiDefinitionId}`);
    // Cermin `kpi_values_nilai_sepakat` di migrasi 0103. Diperiksa di sini juga
    // supaya kegagalannya bernama, bukan sekadar ditolak basis data.
    if (n.nilai === null && n.status !== "tidak_tersedia" && n.status !== "invalid") {
      throw new Error(`${n.kpiDefinitionId} bernilai kosong tapi berstatus ${n.status}`);
    }
    if (n.nilai !== null && (n.status === "tidak_tersedia" || n.status === "invalid")) {
      throw new Error(`${n.kpiDefinitionId} berstatus ${n.status} tapi punya nilai`);
    }
    const k = `${n.kpiDefinitionId}|${n.cakupan}|${n.outletId ?? n.areaId ?? "~korporat"}`;
    if (grain.has(k)) throw new Error(`grain kembar: ${k}`);
    grain.add(k);
  }

  const grainTarget = new Set<string>();
  for (const t of target) {
    if (t.periode !== periode) throw new Error(`target berperiode ${t.periode}, bukan ${periode}`);
    // `targets.nilai` NOT NULL sejak 0103: outlet yang belum berhak TIDAK
    // menghasilkan baris, bukan baris bernilai kosong.
    if (t.nilai === null || t.nilai === undefined || !Number.isFinite(t.nilai)) {
      throw new Error(`target ${t.outletId} bukan angka terhingga`);
    }
    if (t.sumber !== "rumus") throw new Error(`target ${t.outletId} bukan bersumber rumus`);
    const k = `${t.kpiDefinitionId}|${t.cakupan}|${t.outletId ?? t.areaId ?? "~korporat"}`;
    if (grainTarget.has(k)) throw new Error(`grain target kembar: ${k}`);
    grainTarget.add(k);
  }
}

async function definisiAktif(): Promise<Set<string>> {
  const { data, error } = await db().from("kpi_definitions").select("id").eq("aktif", true);
  if (error) throw new Error(`kpi_definitions: ${error.message}`);
  return new Set((data ?? []).map((r) => String((r as { id: unknown }).id)));
}

/* ─────────────────────────────── penyusunan ─────────────────────────────── */

export interface HasilHitung {
  periode: string;
  selesai: boolean;
  outlet: number;
  nilai: NilaiKpi[];
  target: NilaiTarget[];
}

/**
 * Hitung satu periode tanpa menulis apa pun.
 *
 * Dipisah dari penulisannya supaya pratinjau produksi menjalankan jalur yang
 * sama persis dengan yang akan menulis — bukan salinannya.
 */
export async function hitungPeriode(periode: string, pada: number = Date.now()): Promise<HasilHitung> {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);
  if (!dbEnabled) throw new Error("basis data tidak aktif");

  const { outlets, ca } = await bacaOutlet();
  const peta = petaCabangOutlet(outlets);
  const cabang = [...peta.keys()];

  const [seasonal, riwayat, beban, pembelian, laba] = await Promise.all([
    bacaSeasonal(periode, cabang),
    bacaRiwayat(periode, ca),
    listExpenses(periode),
    listPurchases(periode),
    listPnl(periode),
  ]);

  const selesai = periodeSelesai(periode, pada);
  const { fakta, dibuang } = saringFakta(seasonal, peta);

  const target = hitungTargetSales({
    periode,
    outlets: ca.map((o) => ({ id: o.id, bukaTanggal: o.bukaTanggal })),
    riwayat,
    pertumbuhan: tumbuhCa(),
  });

  const sales = hitungSales({
    periode,
    outlets: outlets.map((o) => ({
      id: o.id,
      areaId: o.areaId || null,
      // Aturan `grossDiketik()` dipakai lewat `grossOutlet()` di riwayat; di
      // sini yang ditandai cuma bulan sebelum `esb_mulai`, sama seperti
      // rekonsiliasi Phase 2A.
      esbTidakBerlaku: !!(o.esbMulai && periode < o.esbMulai),
    })),
    fakta,
    cacat: dibuang.cacat,
    ambang: AMBANG,
    target,
    hariBerjalan: selesai ? jumlahHari(periode) : hariBerjalan(periode, pada),
    periodeSelesai: selesai,
  });

  const bebanPeta = new Map(beban.map((r) => [r.outletCode, r]));
  const beliPeta = new Map(pembelian.map((r) => [r.outletCode, r]));
  const labaPeta = new Map(laba.map((r) => [r.outletCode, r]));
  const omzet = new Map<string, number>();
  for (const f of fakta) omzet.set(f.outletId, (omzet.get(f.outletId) ?? 0) + f.net);

  const angka: AngkaOutlet[] = outlets.map((o) => {
    const e = bebanPeta.get(o.code);
    const p = beliPeta.get(o.code);
    const n = labaPeta.get(o.code);
    return {
      outletId: o.id,
      areaId: o.areaId || null,
      sales: omzet.get(o.id) ?? null,
      adaLaporan: !!e,
      warehouse: p ? p.warehouse : null,
      nonWarehouse: p ? p.nonWarehouse : null,
      hpp: n ? n.hpp : null,
      labaBersih: n ? n.laba_bersih : null,
      tenagaKerja: e ? e.tenaga_kerja : null,
      sewa: e ? e.sewa : null,
      lainnya: e ? e.lainnya : null,
      listrik: e?.listrik ?? null,
      air: e?.air ?? null,
      internet: e?.internet ?? null,
      kebersihan: e?.kebersihan ?? null,
      platformFee: e?.platform_fee ?? null,
      pbjt: e?.pbjt ?? null,
    };
  });

  const keuangan = hitungKeuangan({ periode, outlets: angka, periodeSelesai: selesai });

  return {
    periode,
    selesai,
    outlet: outlets.length,
    nilai: [...sales.nilai, ...keuangan.nilai],
    target: sales.target,
  };
}

/* ─────────────────────────────── penulisan ─────────────────────────────── */

const muatanNilai = (n: NilaiKpi) => ({
  kpi: n.kpiDefinitionId,
  cakupan: n.cakupan,
  outlet_id: n.outletId,
  area_id: n.areaId,
  nilai: n.nilai,
  status: n.status,
  sumber: n.sumber,
  rumus: n.rumus,
  rumus_versi: n.rumusVersi,
  sumber_sah: n.sumberSah,
  kelengkapan_persen: n.kelengkapanPersen,
  jumlah_hari: n.jumlahHari,
  catatan: n.catatan,
});

const muatanTarget = (t: NilaiTarget) => ({
  kpi: t.kpiDefinitionId,
  cakupan: t.cakupan,
  outlet_id: t.outletId,
  area_id: t.areaId,
  nilai: t.nilai,
  sumber: t.sumber,
  rumus: t.rumus,
  rumus_versi: t.rumusVersi,
  dasar: t.dasar,
});

interface BalasanRpc {
  periode: string;
  berubah: boolean;
  versi: number;
  nilai_disisipkan: number;
  nilai_digantikan: number;
  target_disisipkan: number;
  target_digantikan: number;
}

/** Hitung satu periode lalu tulis hasilnya — satu transaksi, satu versi. */
export async function generateBulan(periode: string, pada: number = Date.now()): Promise<RingkasGenerasi> {
  const t0 = Date.now();
  const h = await hitungPeriode(periode, pada);
  const t1 = Date.now();

  periksaHasil(periode, h.nilai, h.target, await definisiAktif());
  const t2 = Date.now();

  const { data, error } = await db().rpc("gwg_tulis_kpi_bulanan", {
    p_periode: periode,
    p_nilai: h.nilai.map(muatanNilai),
    p_target: h.target.map(muatanTarget),
  });
  if (error) throw new Error(`gwg_tulis_kpi_bulanan: ${error.message}`);
  const r = data as BalasanRpc;
  const t3 = Date.now();

  return {
    periode,
    berubah: r.berubah,
    versi: r.versi,
    nilaiDisisipkan: r.nilai_disisipkan,
    nilaiDigantikan: r.nilai_digantikan,
    targetDisisipkan: r.target_disisipkan,
    targetDigantikan: r.target_digantikan,
    dihitung: {
      nilai: h.nilai.length,
      target: h.target.length,
      kosong: h.nilai.filter((n) => n.nilai === null).length,
    },
    outlet: h.outlet,
    periodeSelesai: h.selesai,
    msBaca: t1 - t0,
    msHitung: t2 - t1,
    msTulis: t3 - t2,
  };
}

/**
 * Yang dijalankan penjadwal: seluruh periode yang memang perlu ditulis ulang.
 *
 * Daftarnya ditentukan `periodeGenerasi()`, dan untuk sekarang isinya satu —
 * bulan berjalan. Alasannya ada di sana.
 */
export async function generateTerjadwal(pada: number = Date.now()): Promise<RingkasGenerasi[]> {
  const hasil: RingkasGenerasi[] = [];
  for (const p of periodeGenerasi(pada)) hasil.push(await generateBulan(p, pada));
  return hasil;
}
