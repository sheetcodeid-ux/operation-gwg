import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { randomUUID } from "node:crypto";
import { esbConfigured, esbMintaMenuRecap, esbBacaHalamanMenu, esbReadMenuPages, esbEnsureDeadline, type HalamanMenuRecap } from "@/lib/integrations/esb-client";
import { classifyMenuCategory } from "@/lib/integrations/esb";
import { getAppConfig, setAppConfig } from "./app-config";

/**
 * Katalog produk ESB (tabel `esb_menu`), ditarik dari Sales Menu Recapitulation
 * untuk TIGA BULAN KALENDER TERAKHIR YANG SUDAH LENGKAP.
 *
 * NILAI PENJUALANNYA DIBACA, BUKAN DIKIRA-KIRA. Sebelumnya angka penjualan
 * dihitung qty × harga satuan, padahal ESB sudah mengirim Grand Total tiap
 * barisnya. Satu menu yang terjual pada lebih dari satu harga — promo, ukuran
 * berbeda, tingkat harga outlet berbeda — tidak mungkin benar dengan perkalian
 * itu, dan "harga satuan" yang dipakai kebetulan harga terakhir yang terbaca.
 *
 * JENDELANYA TIGA BULAN, bukan 30 hari. Yang membacanya adalah indikator
 * Keberhasilan Pasar, dan indikator itu menghitung tiga bulan; katalog 30 hari
 * memaksa yang mengisinya mengalikan sendiri di kepala, dan tidak ada satu pun
 * yang mengingatkan kalau ia lupa. Tiga bulan KALENDER LENGKAP, bukan 90 hari
 * bergulir: "1 Juni–31 Agustus" bisa dicocokkan dengan laporan ESB apa pun,
 * sedangkan "14 Juni–12 September" tidak bisa dicocokkan dengan apa pun.
 */
export interface EsbMenu {
  menu: string;
  menuCode: string;
  category: string;
  categoryDetail: string;
  foodBev: "makanan" | "minuman";
  /** Jumlah terjual sepanjang jendelanya. */
  qty: number;
  /**
   * Nilai penjualan sepanjang jendelanya, SEBELUM PAJAK.
   *
   * Inilah patokan yang dipakai perusahaan — dicocokkan dengan tarikan ESB
   * milik pemiliknya untuk Juni–Agustus 2026 dan selisihnya Rp 25, murni
   * pembulatan. Dipakai juga oleh Keberhasilan Pasar, yang pembaginya net
   * sales ESB — sama-sama sebelum pajak. Membandingkan penjualan menu bersama
   * pajak dengan omzet tanpa pajak menaikkan bagiannya ~9% tanpa satu menu pun
   * benar-benar terjual lebih banyak.
   */
  amount: number;
  /** Nilai kotor termasuk pajak — untuk penelusuran, bukan dasar penilaian. */
  amountKotor: number;
  /** Harga satuan rata-rata TERTIMBANG qty, sebelum pajak. */
  unitPrice: number;
  /** Panjang jendelanya dalam hari — dipakai menormalkan ke per bulan/per hari. */
  windowDays: number;
  /** Tanggal awal jendelanya, "YYYY-MM-DD". Kosong pada baris lama. */
  dari: string | null;
  /** Tanggal akhir jendelanya, "YYYY-MM-DD". */
  sampai: string | null;
  syncedAt: string;
}

/** Berapa bulan kalender lengkap yang ditarik — sama dengan jangka indikator
 *  Keberhasilan Pasar. */
export const BULAN_KATALOG = 3;

export const esbMenuEnabled = () => dbEnabled;

interface Row {
  menu: string;
  menu_code: string;
  category: string;
  category_detail: string;
  food_bev: string;
  qty_30d: number | string;
  amount: number | string;
  amount_kotor: number | string;
  unit_price: number | string;
  window_days: number;
  periode_dari: string | null;
  periode_sampai: string | null;
  synced_at: string;
}

const fromRow = (r: Row): EsbMenu => ({
  menu: r.menu,
  menuCode: r.menu_code,
  category: r.category,
  categoryDetail: r.category_detail,
  foodBev: r.food_bev === "minuman" ? "minuman" : "makanan",
  qty: Number(r.qty_30d) || 0,
  amount: Number(r.amount) || 0,
  amountKotor: Number(r.amount_kotor) || 0,
  unitPrice: Number(r.unit_price) || 0,
  windowDays: r.window_days || 30,
  dari: r.periode_dari,
  sampai: r.periode_sampai,
  syncedAt: r.synced_at,
});

/**
 * Rentang katalog sebagaimana tertulis pada barisnya — untuk disebut di layar.
 *
 * Dibaca dari datanya, bukan ditulis tangan di tiap halaman. Kalimat "30 hari
 * terakhir" yang diketik di enam tempat akan tetap berbunyi 30 hari lama
 * setelah jendelanya diubah, dan tidak ada yang gagal saat itu terjadi — hanya
 * enam layar yang berbohong dengan tenang.
 */
export function rentangKatalog(menus: EsbMenu[]): { dari: string; sampai: string } | null {
  const isi = menus.find((m) => m.dari && m.sampai);
  return isi ? { dari: isi.dari!, sampai: isi.sampai! } : null;
}

/** Whole catalog (paged past supabase's 1000-row cap). Never throws. */
export async function listEsbMenus(): Promise<EsbMenu[]> {
  if (!dbEnabled) return [];
  try {
    const rows = await selectAll<Row>("esb_menu", (a, b) =>
      db().from("esb_menu").select("*").order("menu", { ascending: true }).range(a, b),
    );
    return rows.map(fromRow);
  } catch {
    return [];
  }
}

/** Most recent sync time (freshness indicator), or null when never synced. */
export async function esbMenuSyncedAt(): Promise<string | null> {
  if (!dbEnabled) return null;
  try {
    const { data } = await db().from("esb_menu").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle();
    return (data as { synced_at: string } | null)?.synced_at ?? null;
  } catch {
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

const CURSOR_KEY = "esb_menu_cursor";

interface Cursor {
  url: string;
  from: string;
  to: string;
  /** 0 = halaman 0 belum terbaca, jadi jumlah halamannya belum diketahui. */
  totalItems: number;
  pageSize: number;
  nextPage: number;
  startedAt: string;
  windowDays: number;
  /** Penanda satu penarikan; jadi kunci baris singgahannya. */
  runId: string;
}

/**
 * Tiga bulan kalender LENGKAP terakhir, dihitung dari hari ini (WIB).
 *
 * Bulan berjalan sengaja tidak ikut: angkanya masih bertambah tiap hari, dan
 * katalog yang jendelanya bergerak sendiri tidak bisa dicocokkan dengan
 * laporan ESB mana pun. Pada 12 September 2026 hasilnya 1 Juni – 31 Agustus.
 */
export function rentangTigaBulan(hariIni = new Date(Date.now() + 7 * 3_600_000)): { from: string; to: string; days: number } {
  const th = hariIni.getUTCFullYear();
  const bl = hariIni.getUTCMonth(); // 0-based; bulan berjalan
  // Akhir = hari terakhir bulan SEBELUM bulan berjalan.
  const akhir = new Date(Date.UTC(th, bl, 0));
  const awal = new Date(Date.UTC(akhir.getUTCFullYear(), akhir.getUTCMonth() - (BULAN_KATALOG - 1), 1));
  const days = Math.round((akhir.getTime() - awal.getTime()) / 86_400_000) + 1;
  return { from: ymdUtc(awal), to: ymdUtc(akhir), days };
}

const ymdUtc = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

interface BarisSinggah {
  run_id: string;
  page: number;
  menu: string;
  menu_code: string;
  category: string;
  category_detail: string;
  qty: number;
  amount: number;
  harga_qty: number;
}

/**
 * Tulis satu halaman ekspor ke tabel singgahan.
 *
 * BERKUNCI NOMOR HALAMAN, dan itulah inti perbaikannya. Sebelumnya tiap batch
 * menambahkan qty ke baris katalog yang sudah ada; satu halaman yang terbaca
 * dua kali — jalannya cron mati setelah menulis tapi sebelum menyimpan
 * kursornya — menambah qty-nya dua kali tanpa satu pun tanda. Di sini halaman
 * yang sama menimpa dirinya sendiri.
 */
async function simpanHalaman(runId: string, halaman: HalamanMenuRecap[]): Promise<number> {
  const payload: BarisSinggah[] = [];
  for (const h of halaman) {
    const agg = new Map<string, BarisSinggah>();
    for (const r of h.rows) {
      if (!r.menu) continue;
      const cur =
        agg.get(r.menu) ??
        ({
          run_id: runId,
          page: h.page,
          menu: r.menu,
          menu_code: r.menuCode,
          category: r.category,
          category_detail: r.categoryDetail,
          qty: 0,
          amount: 0,
          harga_qty: 0,
        } satisfies BarisSinggah);
      cur.qty += r.qty;
      // Keduanya DIBACA dari ESB, bukan dikira-kira: `grandTotal` sudah
      // termasuk pajak, sedangkan harga satuan ESB memang harga sebelum pajak.
      // Menjumlahkan harga × qty PER BARIS — bukan mengalikan ulang harga
      // rata-rata di ujung — membuat angkanya tepat sampai rupiah terakhir.
      cur.amount += r.grandTotal;
      cur.harga_qty += r.unitPrice * r.qty;
      if (!cur.menu_code && r.menuCode) cur.menu_code = r.menuCode;
      agg.set(r.menu, cur);
    }
    payload.push(...agg.values());
  }
  if (payload.length === 0) return 0;

  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const up = await db().from("esb_menu_stage").upsert(payload.slice(i, i + CHUNK));
    if (up.error) throw new Error(`DB esb_menu_stage upsert: ${up.error.message}`);
  }
  return payload.length;
}

/**
 * Pindahkan hasil satu penarikan yang SUDAH LENGKAP ke katalog.
 *
 * Baru di sini katalognya berubah. Selama ekspornya belum habis terbaca,
 * katalog tetap memuat angka penarikan sebelumnya secara utuh — bukan campuran
 * separuh ekspor baru dan separuh ekspor lama, yang justru tidak bisa
 * dikenali sebagai salah oleh siapa pun yang membacanya.
 */
async function pindahkanKeKatalog(c: Cursor): Promise<number> {
  const rows = await selectAll<BarisSinggah>("esb_menu_stage", (a, b) =>
    db().from("esb_menu_stage").select("*").eq("run_id", c.runId).order("menu").range(a, b),
  );

  const agg = new Map<string, { code: string; cat: string; detail: string; qty: number; amount: number; hargaQty: number }>();
  for (const r of rows) {
    const cur = agg.get(r.menu) ?? { code: r.menu_code, cat: r.category, detail: r.category_detail, qty: 0, amount: 0, hargaQty: 0 };
    cur.qty += Number(r.qty) || 0;
    cur.amount += Number(r.amount) || 0;
    cur.hargaQty += Number(r.harga_qty) || 0;
    if (!cur.code && r.menu_code) cur.code = r.menu_code;
    agg.set(r.menu, cur);
  }
  // Ekspor yang pulang kosong TIDAK dipakai mengosongkan katalog: jauh lebih
  // mungkin ESB sedang bermasalah daripada seluruh perusahaan berhenti
  // berjualan tiga bulan.
  if (agg.size === 0) return 0;

  const nowIso = new Date().toISOString();
  const payload = [...agg.entries()].map(([menu, m]) => ({
    menu,
    menu_code: m.code,
    category: m.cat,
    category_detail: m.detail,
    food_bev: classifyMenuCategory(m.cat, m.detail),
    qty_30d: m.qty,
    // Yang jadi patokan angka SEBELUM PAJAK; yang kotor dibawa berdampingan.
    amount: m.hargaQty,
    amount_kotor: m.amount,
    // Rata-rata TERTIMBANG qty. Rata-rata biasa memberi bobot sama kepada satu
    // cangkir di harga promo dan seribu cangkir di harga normal.
    unit_price: m.qty > 0 ? m.hargaQty / m.qty : 0,
    window_days: c.windowDays,
    periode_dari: c.from,
    periode_sampai: c.to,
    synced_at: nowIso,
  }));

  const CHUNK = 500;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const up = await db().from("esb_menu").upsert(payload.slice(i, i + CHUNK));
    if (up.error) throw new Error(`DB esb_menu upsert: ${up.error.message}`);
  }
  // Menu yang tidak muncul sama sekali pada ekspor ini memang sudah tidak ada.
  await db().from("esb_menu").delete().lt("synced_at", nowIso);
  await db().from("esb_menu_stage").delete().eq("run_id", c.runId);
  return payload.length;
}

export interface HasilSyncMenu {
  menus: number;
  complete?: boolean;
  nextPage?: number;
  totalPages?: number;
  dari?: string;
  sampai?: string;
  /** Ekspornya masih dibangun ESB — belum ada yang bisa dibaca jalan ini. */
  menunggu?: boolean;
  skipped?: string;
}

/**
 * Tarik katalog dari ESB — BISA DILANJUTKAN.
 *
 * Ekspornya ratusan halaman dan butuh ~45 detik hanya untuk dibangkitkan, jadi
 * satu jalannya cron tidak akan selesai. Kursor (`app_config esb_menu_cursor`)
 * menyimpan URL ekspor, penanda penarikan, dan halaman berikutnya; tiap jalan
 * membaca sebanyak yang muat di anggaran waktunya.
 *
 * Barisnya masuk ke TABEL SINGGAHAN dulu dan baru dipindahkan ke katalog
 * setelah seluruh halaman terbaca — lihat `simpanHalaman` dan
 * `pindahkanKeKatalog` untuk alasannya.
 */
export async function syncEsbMenus(budgetMs = 48_000): Promise<HasilSyncMenu> {
  if (!dbEnabled || !esbConfigured()) return { menus: 0, skipped: "not configured" };
  const started = Date.now();
  const sisa = () => budgetMs - (Date.now() - started);
  esbEnsureDeadline(budgetMs); // batas waktu ikut berlaku di dalam klien ESB

  let cursor: Cursor | null = null;
  try {
    const raw = await getAppConfig(CURSOR_KEY);
    if (raw) cursor = JSON.parse(raw) as Cursor;
  } catch {
    cursor = null;
  }

  const rentang = rentangTigaBulan();
  // Ekspor dibuat ulang bila belum ada, sudah basi, atau rentangnya bukan lagi
  // tiga bulan yang berlaku sekarang — pergantian bulan menggeser jendelanya.
  const basi = cursor && Date.now() - Date.parse(cursor.startedAt) > 2 * 3_600_000;
  const bedaRentang = cursor && (cursor.from !== rentang.from || cursor.to !== rentang.to);
  const fresh = !cursor || basi || bedaRentang || !cursor.runId;

  if (fresh) {
    if (cursor?.runId) await db().from("esb_menu_stage").delete().eq("run_id", cursor.runId);
    // URL-nya DISIMPAN SEBELUM berkasnya siap. Menunggu di sini sampai ekspor
    // selesai dibangun menghabiskan seluruh anggaran satu jalannya cron tanpa
    // menyimpan apa pun — dan jalan berikutnya memulai dari nol, menunggu lagi,
    // gagal lagi. Itu persis yang membuat katalog macet sejak 30 Agustus.
    const url = await esbMintaMenuRecap(rentang.from, rentang.to);
    cursor = {
      url,
      from: rentang.from,
      to: rentang.to,
      totalItems: 0,
      pageSize: 0,
      nextPage: 0,
      startedAt: new Date().toISOString(),
      windowDays: rentang.days,
      runId: `run_${randomUUID()}`,
    };
    await setAppConfig(CURSOR_KEY, JSON.stringify(cursor));
  }

  const c = cursor!;

  // Halaman 0 sekaligus memberi tahu jumlah halaman seluruhnya. Selama ia belum
  // terbaca, belum ada yang bisa dikerjakan selain mencoba mengambilnya.
  if (c.totalItems === 0) {
    const hal0 = await esbBacaHalamanMenu(c.url, 0, Math.max(3_000, sisa() - 6_000));
    if (!hal0) return { menus: 0, complete: false, nextPage: 0, menunggu: true, dari: c.from, sampai: c.to };
    await simpanHalaman(c.runId, [{ page: 0, rows: hal0.rows }]);
    c.totalItems = hal0.totalItems;
    c.pageSize = Math.max(1, hal0.pageSize);
    c.nextPage = 1;
    await setAppConfig(CURSOR_KEY, JSON.stringify(c));
  }

  const totalPages = Math.max(1, Math.ceil(c.totalItems / Math.max(1, c.pageSize)));

  if (c.nextPage < totalPages && sisa() > 4_000) {
    const read = await esbReadMenuPages(c.url, c.nextPage, totalPages, sisa() - 2_000);
    await simpanHalaman(c.runId, read.pages);
    c.nextPage = read.nextPage;
    await setAppConfig(CURSOR_KEY, JSON.stringify(c));
  }

  const complete = c.nextPage >= totalPages;
  let menus = 0;
  if (complete) {
    menus = await pindahkanKeKatalog(c);
    await setAppConfig(CURSOR_KEY, "");
  }
  return { menus, complete, nextPage: c.nextPage, totalPages, dari: c.from, sampai: c.to };
}

