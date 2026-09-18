import "server-only";

import { esbConfigured, esbListBranches } from "@/lib/integrations/esb-client";
import { getSalesDaily } from "@/lib/data/fraud-store";
import { listEsbMenus } from "@/lib/data/esb-menu";
import { expenseTotal, listExpenses, listOpOutlets, listPurchases, sumExpenses, sumPurchases } from "@/lib/data/ops-finance";
import { areaName, listComplaints, listEvents, listHygiene, listTasks, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { getOpsSettings } from "@/lib/data/ops-settings";
import { DEFAULT_SETTINGS, type OpsSettings } from "@/lib/ops/settings-types";
import { geserHari, hariIniWib, tanggalSah } from "@/lib/ops/waktu";
import type { ComplaintCategory, UserProfile } from "@/lib/types";

export interface OpsKpi {
  /**
   * Net sales HARI INI. Null berarti barisnya belum ada di `sales_daily` —
   * bukan berarti tidak ada penjualan.
   *
   * Dulu `byDay.get(dToday) ?? 0`, dan nolnya tampil di kartu KPI dengan
   * lencana "live" melekat: layar menyatakan angka itu terukur, padahal cron
   * hari itu belum jalan. Nol berbadge live lebih menyesatkan daripada angka
   * contoh tanpa badge, karena badge-nya menjamin sesuatu yang tidak benar.
   */
  netSales: number | null;
  /** Kemarin, untuk delta. Null berarti barisnya belum ada. */
  netSalesPrev: number | null;
  totalTransaksi: number;
  totalPelanggan: number;
  avgBill: number;
}
/** Finance-input aggregates for the current month (from op_expenses / op_purchases). */
export interface OpsFinance {
  expenses: number; // Beban Operasional total
  purchaseWh: number;
  purchaseNonWh: number;
  purchaseTotal: number; // Pembelian total
}
export interface OpsHourly { x: string; hari: number; kemarin: number }
export interface OpsFraud { name: string; value: number }
export interface OpsBranch { code: string; name: string }

/** Kontrol › Complain (from app CRM/Complaints) & Kebersihan (from app Hygiene). */
export interface OpsComplaint { outlet: string; category: string; note: string; status: "Open" | "In Progress" }
export interface OpsHygieneRow { outlet: string; area: string; ok: boolean; supervisor: string }
export interface OpsHygiene { checkedToday: number; totalOutlets: number; rows: OpsHygieneRow[] }
export interface OpsEventRow { name: string; count: number; up: boolean } // Kontrol › Event (Event Tracker)
export interface OpsControl { complaints: OpsComplaint[]; hygiene: OpsHygiene | null; events: OpsEventRow[] }

/** Aktivitas Terkini (Juknis 2.12): Divisi = Work Tracker; Outlet = sistem otomatis. */
export interface OpsActivity { who: string; time: string; desc: string; tone: "blue" | "green" | "amber" | "red" }
export interface OpsActivityFeed { divisi: OpsActivity[]; outlet: OpsActivity[] }

/** Target & projection (Juknis 2.1–2.3, computed from 3-month omzet history). */
export interface OpsTarget {
  targetMonth: number; // avg 3-month omzet × 115%
  realisasi: number; // current-month omzet (MTD)
  attainmentPct: number; // realisasi / targetMonth × 100
  momPct: number; // realisasi vs previous month (for the −5% style badge)
  targetHarian: number;
  /** Net sales hari ini. Null berarti belum ada barisnya — bukan Rp 0. */
  todayActual: number | null;
  proyeksiBulanan: number; // rate/day × days-in-month
}

/** Produk (per-menu sales this month, from ERP menu-performance — Juknis 2.7). */
export interface OpsProduct { name: string; category: string; qty: number; amount: number }

/** Per-branch performance from our Finance input (Pembelian & Beban, this vs prev month). */
/**
 * Pembelian & beban per cabang dari input Finance sendiri.
 *
 * KEEMPAT ANGKANYA NULLABLE, dan itu pembedaan yang menentukan: `listOpOutlets()`
 * mengembalikan SELURUH outlet aktif, jadi outlet yang belum mengunggah data
 * bulan itu tidak punya barisnya. Dulu ia dibaca Rp 0 — tidak bisa dibedakan
 * dari outlet yang melapor nol — lalu `growth` mengumumkan penurunan 100%
 * terhadap bulan lalu untuk outlet yang cuma belum mengirim berkas.
 */
export interface OpsBranchPerf {
  code: string;
  name: string;
  area: string;
  pembelianCur: number | null;
  pembelianPrev: number | null;
  bebanCur: number | null;
  bebanPrev: number | null;
}

async function loadBranchPerf(month: string): Promise<OpsBranchPerf[]> {
  const prev = ym(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1));
  const [pCur, pPrev, eCur, ePrev] = await Promise.all([listPurchases(month), listPurchases(prev), listExpenses(month), listExpenses(prev)]);
  const pcm = new Map(pCur.map((r) => [r.outletCode, r.warehouse + r.nonWarehouse]));
  const ppm = new Map(pPrev.map((r) => [r.outletCode, r.warehouse + r.nonWarehouse]));
  const ecm = new Map(eCur.map((r) => [r.outletCode, expenseTotal(r)]));
  const epm = new Map(ePrev.map((r) => [r.outletCode, expenseTotal(r)]));
  return listOpOutlets().map((o) => ({
    code: o.code,
    name: o.name,
    area: o.area,
    // Tidak ada barisnya → null. Ada barisnya berangka nol → 0. Keduanya
    // dibedakan, dan yang membacanya berhak tahu mana yang mana.
    pembelianCur: pcm.get(o.code) ?? null,
    pembelianPrev: ppm.get(o.code) ?? null,
    bebanCur: ecm.get(o.code) ?? null,
    bebanPrev: epm.get(o.code) ?? null,
  }));
}

export interface OpsDashboardData {
  configured: boolean;
  date: string; // YYYY-MM-DD used
  kpi: OpsKpi | null;
  hourly: OpsHourly[] | null;
  fraud: OpsFraud[] | null;
  branches: OpsBranch[];
  finance: OpsFinance | null; // from our own Finance-input tables (independent of ERP)
  control: OpsControl | null; // from app Complaints + Hygiene (scoped to the user)
  target: OpsTarget | null; // ERP omzet history (Juknis 2.1)
  products: OpsProduct[] | null; // ERP menu-performance (Juknis 2.7)
  branchPerf: OpsBranchPerf[]; // per-outlet Finance (Pembelian & Beban)
  activity: OpsActivityFeed | null; // Work/Event tracker (Juknis 2.12)
  settings: OpsSettings; // configurable thresholds (Juknis bab 6)
  errors: string[]; // human labels of sources that failed
}

async function loadProducts(): Promise<OpsProduct[] | null> {
  try {
    const menus = await listEsbMenus(); // katalog ESB — tiga bulan kalender terakhir
    if (!menus.length) return null;
    return menus
      .map((m) => ({ name: m.menu, category: m.category || "Lainnya", qty: m.qty, amount: Math.round(m.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50);
  } catch {
    return null;
  }
}

/** First & last calendar day of a YYYY-MM month. */
function monthBounds(month: string): { from: string; to: string } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Total omzet of a month = Σ daily net sales from the ESB sales cache. */
async function omzetOfMonth(month: string): Promise<number> {
  const { from, to } = monthBounds(month);
  const days = await getSalesDaily(from, to);
  return days.reduce((a, d) => a + d.netSales, 0);
}

/**
 * Target Per Bulan / Harian + Proyeksi Bulanan (Juknis 2.1-2.3).
 *
 * TIDAK ADA ANGKA MINGGUAN DI SINI, dan ketiadaannya disengaja. Sampai Gate Q
 * fungsi ini juga membangun `weeks[]`: target tiap minggu dari target bulanan
 * dibagi jumlah hari, dan "actual" tiap minggu dari laju rata-rata bulan
 * berjalan disebar rata. Yang kedua itu yang paling menyesatkan - ia bukan
 * penjualan minggu itu, sehingga setiap minggu penuh mendapat angka yang nyaris
 * sama dan variasi mingguan yang sesungguhnya hilang total.
 *
 * Tidak ada target mingguan resmi di GWG (M-03). Menghapusnya dari lapisan data
 * - bukan cuma dari layar - supaya rumusnya tidak tersedia untuk dipanggil
 * panel berikutnya tanpa melewati keputusan pemiliknya.
 *
 * Angka mingguan per outlet yang sah ada di `/operational/weekly`, dari
 * `esb_net_mingguan`, dan ia tidak punya target.
 */
async function loadTarget(todayNetSales: number | null): Promise<OpsTarget | null> {
  try {
    const now = new Date();
    const monthOf = (back: number) => ym(new Date(now.getFullYear(), now.getMonth() - back, 1));
    const [o0, o1, o2, o3] = await Promise.all([omzetOfMonth(monthOf(0)), omzetOfMonth(monthOf(1)), omzetOfMonth(monthOf(2)), omzetOfMonth(monthOf(3))]);
    const avg3 = (o1 + o2 + o3) / 3;
    if (avg3 <= 0) return null; // not enough history (Juknis: min 3 bulan)

    const targetMonth = avg3 * 1.15;
    const realisasi = o0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const targetHarian = targetMonth / daysInMonth;
    const ratePerDay = daysElapsed > 0 ? realisasi / daysElapsed : 0;

    return {
      targetMonth,
      realisasi,
      attainmentPct: targetMonth > 0 ? +((realisasi / targetMonth) * 100).toFixed(2) : 0,
      momPct: o1 > 0 ? +(((realisasi - o1) / o1) * 100).toFixed(1) : 0,
      targetHarian,
      todayActual: todayNetSales,
      proyeksiBulanan: ratePerDay * daysInMonth,
    };
  } catch {
    return null;
  }
}

const COMPLAINT_LABEL: Record<ComplaintCategory, string> = {
  service: "Service",
  food_quality: "Food Quality",
  cleanliness: "Cleanliness",
  staff_characteristics: "Staff Characteristics",
  price: "Price",
  payment_system: "Payment System",
  ambiance: "Ambiance",
  order_error: "Order Error",
};

/** Complaints (open/in-progress only, Juknis 2.10.2) + hygiene checklist summary. */
function loadControl(user: UserProfile): OpsControl {
  const complaints: OpsComplaint[] = listComplaints(user)
    .filter((c) => c.status !== "close")
    .slice(0, 20)
    .map((c) => ({ outlet: outletName(c.outletId), category: COMPLAINT_LABEL[c.category] ?? c.category, note: c.content, status: c.status === "open" ? "Open" : "In Progress" }));

  // ┌─ "HARI INI" ITU HARI KALENDER JAKARTA, BUKAN JAM SERVER ────────────────┐
  // │                                                                        │
  // │ Dulu `ymd(new Date())` — jam lokal server. Di server UTC, antara 00.00  │
  // │ dan 07.00 WIB tanggalnya jatuh ke hari WIB SEBELUMNYA, sehingga setiap  │
  // │ outlet yang sudah mengisi checklist untuk hari yang benar terhitung     │
  // │ belum. Tujuh jam tiap hari, tanpa satu pun tanda di layar.              │
  // │                                                                        │
  // │ `hariIniWib()` sudah ada di `@/lib/ops/waktu` untuk persis alasan ini.  │
  // │ Yang dipakai helper existing, bukan salinan ke-dua-belas dari           │
  // │ `Date.now() + 7 jam`.                                                  │
  // └────────────────────────────────────────────────────────────────────────┘
  const today = hariIniWib();
  const hy = listHygiene(user);
  const todays = hy.filter((h) => (h.date ?? "").slice(0, 10) === today);
  const src = todays.length > 0 ? todays : hy.slice(0, 8);
  const rows: OpsHygieneRow[] = src.slice(0, 10).map((h) => ({ outlet: outletName(h.outletId), area: areaName(h.areaId), ok: h.isClean, supervisor: h.supervisorName }));
  const hygiene: OpsHygiene = { checkedToday: new Set(todays.map((h) => h.outletId)).size, totalOutlets: visibleOutlets(user).length, rows };

  // Event Tracker → usage per event name (Juknis 2.10.4).
  const evMap = new Map<string, number>();
  for (const e of listEvents(user)) evMap.set(e.name, (evMap.get(e.name) ?? 0) + 1);
  const events: OpsEventRow[] = [...evMap.entries()].map(([name, count]) => ({ name, count, up: count >= 2 })).sort((a, b) => b.count - a.count).slice(0, 10);

  return { complaints, hygiene, events };
}

const hm = (iso?: string | null) => { try { return iso ? new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""; } catch { return ""; } };

/** Aktivitas Terkini: Divisi from Work Tracker (done tasks); Outlet auto-derived. */
function loadActivity(user: UserProfile): OpsActivityFeed {
  const divisi: OpsActivity[] = listTasks(user)
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completionDate ?? b.createdAt).localeCompare(a.completionDate ?? a.createdAt))
    .slice(0, 6)
    .map((t) => ({ who: t.picIds[0] ? userName(t.picIds[0]) : t.division, time: hm(t.completionDate ?? t.createdAt), desc: t.title, tone: "green" as const }));

  const outlet: OpsActivity[] = [];
  // Hari kalender Jakarta, sama dengan `loadControl` — lihat catatan di sana.
  const today = hariIniWib();
  const checked = new Set(listHygiene(user).filter((h) => (h.date ?? "").slice(0, 10) === today).map((h) => h.outletId));
  for (const o of visibleOutlets(user)) {
    if (outlet.length >= 3) break;
    // ┌─ KALIMATNYA MENYEBUT YANG DIBUKTIKAN, BUKAN YANG DISIMPULKAN ─────────┐
    // │                                                                      │
    // │ Dulu: "SPV belum upload checklist kebersihan hari ini". Yang ada di   │
    // │ data cuma KETIADAAN baris `hygiene` ber-`date` = hari ini. Tiga       │
    // │ langkah inferensi memisahkan keduanya, dan tak satu pun didukung:     │
    // │                                                                      │
    // │   • aktornya. `HygieneAudit` tidak punya `submitted_by` maupun id     │
    // │     pengguna sama sekali; `inspectorName`/`supervisorName` teks bebas.│
    // │     Jadi "SPV" tidak pernah dibuktikan barisnya.                      │
    // │   • peristiwa unggahnya. Tidak ada `submitted_at`; `date` DIISI       │
    // │     PENGGUNA (`actions/hygiene.ts`) dan artinya tanggal yang          │
    // │     DIPERIKSA, bukan waktu pengiriman. Unggah hari ini untuk tanggal  │
    // │     kemarin terbaca "belum unggah".                                  │
    // │   • kepastiannya. Hidrasi bergerbang sidik, jadi baris yang baru      │
    // │     masuk bisa belum ada di memori instance ini.                     │
    // │                                                                      │
    // │ Menuduh outlet tertentu lalai berbiaya berbeda dari salah angka:      │
    // │ tuduhannya sampai ke orangnya sebelum ada yang memeriksanya.          │
    // └──────────────────────────────────────────────────────────────────────┘
    if (!checked.has(o.id)) outlet.push({ who: o.name, time: "", desc: "Belum ada catatan hygiene untuk tanggal ini", tone: "red" });
  }
  for (const c of listComplaints(user).filter((c) => c.status === "open").slice(0, 3)) {
    outlet.push({ who: outletName(c.outletId), time: hm(c.createdAt), desc: `Komplain baru: ${COMPLAINT_LABEL[c.category] ?? c.category}`, tone: "amber" });
  }
  return { divisi, outlet: outlet.slice(0, 6) };
}

/** Berapa tanggal yang masuk jendela tren harian, termasuk hari ini. */
export const HARI_JENDELA = 14;

export interface TanggalHarian {
  /** Hari bisnis yang sedang dilihat, "YYYY-MM-DD". */
  dToday: string;
  /** Sehari sebelumnya — pembanding "vs kemarin". */
  dYest: string;
  /** Awal jendela tren; `dFrom..dToday` berisi tepat `HARI_JENDELA` tanggal. */
  dFrom: string;
}

/**
 * TANGGAL HARIAN OPS DASHBOARD — hari kalender Jakarta, bukan jam server.
 *
 * ┌─ KENAPA JAM SERVER SALAH DI SINI ───────────────────────────────────────┐
 * │                                                                        │
 * │ Dulu: `ymd(new Date())` dengan `getFullYear()/getMonth()/getDate()` —   │
 * │ seluruhnya jam lokal proses. Produksi berjalan di UTC, dan WIB = UTC+7, │
 * │ jadi antara 00.00 dan 07.00 WIB tanggalnya jatuh ke hari WIB SEBELUMNYA.│
 * │                                                                        │
 * │ Yang membuatnya sulit dicurigai: pada jendela itu baris `sales_daily`   │
 * │ untuk kemarin SUDAH terisi cron. Jadi kartu KPI tidak kosong — ia       │
 * │ menampilkan penjualan KEMARIN SEHARI PENUH sebagai "Net Sales" hari     │
 * │ ini, lengkap dengan lencana `live`, dan `todayActual` membawanya ke     │
 * │ panel Target Harian sehingga capaiannya terbaca tinggi. Angka yang      │
 * │ salah dan berlencana live lebih sulit ditangkap daripada angka kosong.  │
 * │                                                                        │
 * │ Domain ini memang sudah berhari WIB di tempat lain — `fraud-store.ts`   │
 * │ memutuskan `todayW` begitu, dan `esb-mingguan.ts` juga. Yang menyimpang │
 * │ cuma berkas ini.                                                       │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * `diminta` (dari `opts.date`) DIPAKAI APA ADANYA. Ia sudah berupa tanggal
 * bisnis yang diminta pemanggil; memutarnya lewat `new Date()` lalu membacanya
 * kembali dengan getter lokal adalah persis cara "2026-09-17" bisa keluar
 * sebagai 2026-09-16. Yang bentuknya tidak sah tidak bisa dihormati sama
 * sekali, jadi ia jatuh ke hari WIB berjalan alih-alih menghasilkan tanggal
 * karangan.
 *
 * MURNI — `pada` disuntikkan supaya batas tengah malamnya bisa diuji.
 */
export function tanggalHarian(pada: number = Date.now(), diminta?: string): TanggalHarian {
  const dToday = diminta && tanggalSah(diminta) ? diminta : hariIniWib(pada);
  return { dToday, dYest: geserHari(dToday, -1), dFrom: geserHari(dToday, -(HARI_JENDELA - 1)) };
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

async function loadFinance(month: string): Promise<OpsFinance | null> {
  try {
    const [expenses, pur] = await Promise.all([sumExpenses(month), sumPurchases(month)]);
    if (expenses === 0 && pur.total === 0) return null; // nothing input yet
    return { expenses, purchaseWh: pur.warehouse, purchaseNonWh: pur.nonWarehouse, purchaseTotal: pur.total };
  } catch {
    return null;
  }
}

function baseOpsDashboard(): OpsDashboardData {
  return { configured: false, date: "", kpi: null, hourly: null, fraud: null, branches: [], finance: null, control: null, target: null, products: null, branchPerf: [], activity: null, settings: DEFAULT_SETTINGS, errors: [] };
}

/**
 * Build Dashboard 2 from ESB data (via the cached sales/menu tables — fast):
 *  - KPI Net Sales (today vs yesterday)        ← ESB daily sales cache
 *  - Penjualan trend (daily, last 14 days)     ← ESB daily sales cache
 *  - Produk (menu qty + amount)                ← ESB menu catalog (esb_menu)
 *  - Cabang list                               ← ESB branches
 * ESB has no per-hour, transaksi, pelanggan, or avg-bill data, so those KPI
 * fields stay 0 and the void/cancel card lives on the dedicated Fraud page.
 * Each source is independent (Promise.allSettled) so one failure doesn't blank
 * the rest — the component keeps its placeholder for anything that errored.
 */
export async function getOpsDashboard(opts: { date?: string; user?: UserProfile } = {}): Promise<OpsDashboardData> {
  const month = ym(opts.date ? new Date(opts.date) : new Date());
  const finance = await loadFinance(month);
  const control = opts.user ? loadControl(opts.user) : null;
  const activity = opts.user ? loadActivity(opts.user) : null;
  const branchPerf = await loadBranchPerf(month);
  const settings = await getOpsSettings();
  if (!esbConfigured()) return { ...baseOpsDashboard(), finance, control, branchPerf, activity, settings };
  const errors: string[] = [];

  const { dToday, dYest, dFrom } = tanggalHarian(Date.now(), opts.date);

  // ESB gives daily net sales (cached, fast) + branches. There's no per-hour or
  // transaksi/pelanggan/avg-bill data, so the hourly chart becomes a DAILY net
  // sales trend and those KPI fields stay 0.
  const [salesRes, branchesRes] = await Promise.allSettled([getSalesDaily(dFrom, dToday), esbListBranches()]);

  let hourly: OpsHourly[] | null = null;
  let todayNet: number | null = null;
  let prevNet: number | null = null;
  if (salesRes.status === "fulfilled") {
    const days = salesRes.value.slice().sort((a, b) => a.day.localeCompare(b.day));
    const byDay = new Map(days.map((d) => [d.day, d.netSales]));
    // Hari yang belum ditarik cron TIDAK dibaca nol. Lihat `OpsKpi.netSales`.
    todayNet = byDay.get(dToday) ?? null;
    prevNet = byDay.get(dYest) ?? null;
    hourly = days.map((d) => {
      const dt = new Date(`${d.day}T00:00:00`);
      return { x: `${dt.getDate()}/${dt.getMonth() + 1}`, hari: d.netSales, kemarin: 0 };
    });
  } else {
    errors.push("Penjualan");
  }

  const kpi: OpsKpi | null =
    salesRes.status === "fulfilled"
      ? { netSales: todayNet, netSalesPrev: prevNet, totalTransaksi: 0, totalPelanggan: 0, avgBill: 0 }
      : null;
  if (!kpi) errors.push("KPI");

  // Void/cancel breakdown lives on the dedicated Fraud page (ESB cancel export);
  // leave the dashboard fraud card empty rather than approximate it here.
  const fraud: OpsFraud[] | null = null;

  const brs: OpsBranch[] = branchesRes.status === "fulfilled" ? branchesRes.value.map((b) => ({ code: b.id, name: b.name })) : [];
  if (branchesRes.status !== "fulfilled") errors.push("Cabang");

  const [tgt, products] = await Promise.all([loadTarget(kpi?.netSales ?? null), loadProducts()]);
  const target = tgt;
  if (!target) errors.push("Target");
  if (!products) errors.push("Produk");

  return { configured: true, date: dToday, kpi, hourly, fraud, branches: brs, finance, control, target, products, branchPerf, activity, settings, errors };
}
