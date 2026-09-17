import "server-only";

import { hariTerhitung, netMingguanPerCabang, type NetMinggu } from "./esb-mingguan";
import { grossDiketik, targetBulananOutlet } from "./kpi";
import { listExpenses } from "./ops-finance";
import { cacahSeverity, signalBulananOutlet, type SignalBulanan } from "./signal-baca";
import { areaName, getOutlets, getUsers } from "./store";
import { BEBAN_BARU, RINCI_UTILITAS, type ExpenseRow } from "@/lib/ops/categories";
import { mingguBulan, type RentangMinggu } from "@/lib/kpi/minggu";
import {
  susunMingguan,
  terukur,
  takTahu,
  type BarisMingguan,
  type MingguMentah,
  type SumberMingguan,
  type Terukur,
} from "@/lib/ops/mingguan";
import {
  buktiBiaya,
  buktiBiayaRinci,
  buktiRataTransaksi,
  buktiSales,
  buktiTarget,
  buktiTraffic,
  keyakinan,
  rangkumBukti,
  type RangkumanBukti,
} from "@/lib/ops/bukti";
import { bulanSah, bulanSebelum } from "@/lib/ops/waktu";

/**
 * WEEKLY PERFORMANCE — pembaca produksi.
 *
 * ┌─ SUMBERNYA `esb_net_mingguan`, DAN HANYA ITU ────────────────────────────┐
 * │                                                                          │
 * │ BUKAN `seasonal_daily` yang dijumlahkan ke minggu. Keduanya bisa berbeda │
 * │ untuk minggu yang sama: `seasonal_daily` diisi cron harian per cabang    │
 * │ bergiliran dan selalu tertinggal puluhan outlet, sementara               │
 * │ `esb_net_mingguan` ditarik sekali per minggu untuk seluruh cabang lalu   │
 * │ selesai. Dua sumber untuk satu angka berarti keduanya cepat atau lambat  │
 * │ berbeda, dan yang membacanya tidak punya cara tahu mana yang benar.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG SENGAJA TIDAK DIPAKAI ─────────────────────────────────────────────┐
 * │                                                                          │
 * │   performaOutlet("mingguan")  membawa target bulanan ke dalam kolom      │
 * │                               minggu (`harian.ts`: target / jumlah kolom)│
 * │   barisHarian()               sumber pembagian itu                        │
 * │   targetMinggu()              target bulan × porsi hari                   │
 * │   hitungBarisMinggu()         capaian & kejar per minggu                  │
 * │   rincianMinggu()             pemanggil dua yang terakhir                 │
 * │                                                                          │
 * │ Kelimanya menurunkan TARGET MINGGUAN dari target bulanan, dan Gate M     │
 * │ mengunci bahwa target mingguan tidak ada. Larangannya dijaga uji yang    │
 * │ membaca berkas ini sebagai teks — lihat `mingguan-performa.test.ts`.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Monthly Target dan Monthly Signal ikut dibaca, keduanya SEBAGAI KONTEKS
 * BERLABEL BULAN — tidak dibagi ke minggu, tidak dipetakan ke minggu, dan tidak
 * pernah melahirkan persentase capaian mingguan.
 */

export interface KonteksSignal {
  /** "YYYY-MM" — label yang WAJIB tampil di kepala bloknya. */
  periode: string;
  daftar: SignalBulanan[];
  perSeverity: Record<string, number>;
}

export interface BarisPerformaMingguan extends BarisMingguan {
  /** Signal BULANAN outlet ini. Konteks, bukan milik minggu mana pun. */
  signal: KonteksSignal;
  bukti: RangkumanBukti;
  /** Jumlah seluruh minggu yang angkanya diketahui — dasar bukti target. */
  realisasiBulan: Terukur;
}

export interface DetailMingguan {
  periode: string;
  minggu: RentangMinggu[];
  baris: BarisPerformaMingguan[];
  /** Outlet yang belum dipasangkan ke cabang ESB — disebut, tidak didiamkan. */
  tanpaCabang: string[];
  /** Outlet yang belum genap tiga bulan, jadi belum punya target bulanan. */
  tanpaTarget: string[];
  /** Outlet yang angka ESB bulan ini dinyatakan tidak sah. */
  sumberTidakSah: string[];
  /** Berapa sel outlet×minggu yang mingguanya sudah dimulai tapi angkanya belum ada. */
  lubang: number;
  /** Berapa sel yang mingguanya sudah dimulai sama sekali. */
  lubangDari: number;
}

/** Ambil satu baris mingguan dari peta ESB, atau null bila memang tidak ada. */
function mentah(
  periode: string,
  m: RentangMinggu,
  cabang: string | null,
  peta: Map<string, NetMinggu>,
): MingguMentah | null {
  if (cabang === null) return null;
  const r = peta.get(`${cabang}|${m.minggu}`) ?? null;
  return {
    minggu: m.minggu,
    hariMinggu: m.hari,
    // `hariTerhitung` mengembalikan 0 untuk `sampai` yang null — dan nol di
    // sini berarti "belum ada satu hari pun", bukan "tidak ada datanya".
    hariAda: hariTerhitung(periode, m, r?.sampai ?? null),
    net: r === null ? null : r.net,
    pax: r?.pax ?? null,
    bills: r?.bills ?? null,
  };
}

/**
 * Keenam kolom biaya rinci sudah terisi?
 *
 * SELURUHNYA, bukan salah satu. `sudahDirinci()` di `ops/utilitas.ts` sengaja
 * tidak dipakai: ia menjawab pertanyaan yang berbeda — "berkas unggahan ini
 * memakai jalur rincian?" — dan cukup satu kolom terisi untuk menjawab ya. Di
 * sini yang ditanyakan apakah buktinya LENGKAP, dan satu kolom terisi dari enam
 * bukan bukti yang lengkap.
 *
 * Hari ini jawabannya selalu salah: 0 dari 174 baris terisi. Itu dilaporkan apa
 * adanya sebagai `UNKNOWN`, bukan disamarkan jadi biaya nol.
 */
const sudahDirinciPenuh = (r: ExpenseRow): boolean =>
  [...RINCI_UTILITAS, ...BEBAN_BARU].every((c) => r[c] !== null && r[c] !== undefined);

/** Jumlah seluruh minggu yang angkanya diketahui. Null bila tak satu pun ada. */
function realisasiBulanan(b: BarisMingguan): Terukur {
  const ada = b.sel.filter((s) => s.sales.diketahui);
  if (ada.length === 0) return takTahu("data_tidak_tersedia");
  return terukur(ada.reduce((n, s) => n + (s.sales.diketahui ? s.sales.nilai : 0), 0));
}

/**
 * Minggu TERAKHIR yang sudah punya angka — dasar bukti dan ringkasan.
 *
 * Bukan minggu terakhir kalender: minggu yang belum datang tidak menceritakan
 * apa pun, dan memakainya membuat setiap outlet terbaca `UNKNOWN` sepanjang
 * awal bulan.
 */
function mingguTerbaru(b: BarisMingguan): number {
  for (let i = b.sel.length - 1; i >= 0; i -= 1) {
    if (b.sel[i].sales.diketahui) return i;
  }
  return -1;
}

/**
 * Tabel Weekly Performance satu bulan.
 *
 * `outletIds` membatasi barisnya. Batasnya DI SINI, bukan di komponen: baris
 * yang cuma disaring di layar tetap terkirim ke peramban, dan siapa pun bisa
 * membacanya dari sana.
 */
export async function performaMingguan(periode: string, outletIds?: readonly string[]): Promise<DetailMingguan> {
  if (!bulanSah(periode)) throw new Error(`periode tidak sah: ${periode}`);

  const minggu = mingguBulan(periode);
  const sebelum = bulanSebelum(periode);
  const boleh = outletIds ? new Set(outletIds) : null;

  const outlet = getOutlets().filter((o) => o.active && (!boleh || boleh.has(o.id)));

  // Coordinator dari PENUGASANNYA (`users.outlet_ids`), bukan dari
  // `outlets.area_id`. Keduanya pernah tertukar, dan akibatnya satu orang
  // dinilai atas outlet yang bukan wilayahnya — daftar yang tetap masuk akal
  // di layar, tanpa satu pun tanda bahwa yang dinilai salah.
  const pemegang = new Map<string, string>();
  for (const u of getUsers()) {
    if (u.role !== "area_coordinator" || u.active === false) continue;
    for (const id of u.outletIds ?? []) pemegang.set(id, u.name);
  }

  const [petaIni, petaLalu, target, beban] = await Promise.all([
    netMingguanPerCabang(periode),
    netMingguanPerCabang(sebelum),
    targetBulananOutlet(periode),
    listExpenses(periode).catch(() => []),
  ]);

  const mingguLaluBulanLalu = mingguBulan(sebelum).at(-1) ?? null;
  const bebanPerKode = new Map<string, ExpenseRow>(beban.map((r) => [r.outletCode, r]));

  const sumber: SumberMingguan[] = outlet.map((o) => {
    const cabang = o.esbBranchId ?? null;
    const sah = !grossDiketik({ esbMulai: o.esbMulai ?? null, esbAbaikan: o.esbAbaikan ?? [] }, periode);
    return {
      outletId: o.id,
      nama: o.name,
      kode: o.code,
      area: areaName(o.areaId),
      coordinator: pemegang.get(o.id) ?? "belum ditugaskan",
      cabang,
      minggu: minggu.map((m) => mentah(periode, m, cabang, petaIni)).filter((m): m is MingguMentah => m !== null),
      mingguLalu: mingguLaluBulanLalu ? mentah(sebelum, mingguLaluBulanLalu, cabang, petaLalu) : null,
      sumberSah: sah,
      targetBulanan: target.get(o.id) ?? null,
    };
  });

  // Outlet tanpa cabang tetap punya barisnya — sel-selnya `tanpa_cabang`,
  // bukan nol — jadi `minggu` yang kosong diisi ulang di sini supaya panjang
  // barisnya sama dengan outlet lain dan tabelnya tidak bergeser.
  for (const s of sumber) {
    if (s.minggu.length === 0) {
      s.minggu = minggu.map((m) => ({ minggu: m.minggu, hariMinggu: m.hari, hariAda: 0, net: null, pax: null, bills: null }));
    }
  }

  const dasar = susunMingguan(sumber);
  const idTerbaca = dasar.map((b) => b.outletId);
  const signal = await signalBulananOutlet(periode, idTerbaca).catch(() => new Map<string, SignalBulanan[]>());

  const baris: BarisPerformaMingguan[] = dasar.map((b) => {
    const daftarSignal = signal.get(b.outletId) ?? [];
    const i = mingguTerbaru(b);
    const sel = i >= 0 ? b.sel[i] : null;
    const selSebelum = i > 0 ? b.sel[i - 1] : null;
    const realisasi = realisasiBulanan(b);

    const rincian = bebanPerKode.get(b.kode);
    const adaLaporan = rincian !== undefined;
    const adaRincian = rincian !== undefined && sudahDirinciPenuh(rincian);

    const daftarBukti = [
      buktiSales(sel?.sales ?? takTahu("data_tidak_tersedia"), selSebelum?.sales ?? takTahu("tanpa_minggu_sebelumnya")),
      buktiTarget(realisasi, b.targetBulananKonteks),
      buktiTraffic(sel?.pax ?? takTahu("data_tidak_tersedia"), sel?.bills ?? takTahu("data_tidak_tersedia")),
      buktiRataTransaksi(sel?.rataTransaksi ?? takTahu("data_tidak_tersedia")),
      buktiBiaya(adaLaporan, b.sumberSah),
      buktiBiayaRinci(adaRincian),
    ];

    const tingkat = keyakinan({
      kelengkapan: sel?.kelengkapan ?? takTahu("data_tidak_tersedia"),
      trafficAda: !!sel && sel.pax.diketahui && sel.bills.diketahui,
      targetAda: b.targetBulananKonteks.diketahui,
      sumberSah: b.sumberSah,
      biayaRinciAda: adaRincian,
    });

    return {
      ...b,
      signal: { periode, daftar: daftarSignal, perSeverity: cacahSeverity(daftarSignal) },
      realisasiBulan: realisasi,
      // `sudahDiperiksa` benar karena bukti di atas BENAR-BENAR dijalankan untuk
      // outlet ini. Ia bukan janji bahwa hasilnya lengkap — hasil yang kosong
      // tetap `UNKNOWN`, dan `UNKNOWN` tetap membuat tindakan tidak layak.
      bukti: rangkumBukti(daftarBukti, tingkat, { adaSignal: daftarSignal.length > 0, sudahDiperiksa: true }),
    };
  });

  // Lubang dihitung per SEL yang mingguanya sudah dimulai. Minggu yang belum
  // datang bukan minggu yang datanya hilang — memasukkannya membuat setiap
  // outlet terbaca berlubang sepanjang awal bulan.
  let lubang = 0;
  let lubangDari = 0;
  for (const b of baris) {
    for (const s of b.sel) {
      if (s.hariAda === 0 && !s.sales.diketahui) continue; // minggunya belum datang
      lubangDari += 1;
      if (!s.sales.diketahui) lubang += 1;
    }
  }

  return {
    periode,
    minggu,
    baris,
    tanpaCabang: baris.filter((b) => b.cabang === null).map((b) => b.nama),
    tanpaTarget: baris.filter((b) => !b.targetBulananKonteks.diketahui).map((b) => b.nama),
    sumberTidakSah: baris.filter((b) => !b.sumberSah).map((b) => b.nama),
    lubang,
    lubangDari,
  };
}
