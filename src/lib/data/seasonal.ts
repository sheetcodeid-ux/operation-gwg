import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { esbConfigured, esbFetchSales, esbListBranches, esbEnsureDeadline } from "@/lib/integrations/esb-client";

/**
 * Seasonal (Musiman) sales — daily gross & net sales for a whole year, cached in
 * `seasonal_daily` so the overlay chart renders instantly. Data comes from ESB
 * (the sales-dashboard highlight, all outlets or one branch). Days are pulled one
 * at a time (on demand + hourly cron); a day synced after it ended is FINAL and
 * never re-pulled, so the year converges and stays fast.
 *
 * branch '' = all outlets; otherwise the ESB branchID.
 */

export interface SeasonalDayValue { gross: number; net: number }
export interface SeasonalReport {
  configured: boolean;
  year: number;
  branch: string;
  /** month 0..11 → day 1..31 → { gross, net } */
  months: Record<number, Record<number, SeasonalDayValue>>;
  /** days in the year not yet synced — the client drains these in the background */
  pendingDays: string[];
  error?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayWib = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Every YYYY-MM-DD in [from, to] (capped at 400 for a full year). */
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  while (ymd(d) <= to && out.length < 400) {
    out.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const FRESH_TTL_MS = 60 * 60 * 1000;
/** A day is FINAL once synced after it ended (WIB); a still-running day is fresh
 *  for an hour. */
function fresh(syncedAt: string, day: string): boolean {
  const syncedMs = Date.parse(syncedAt);
  const endMs = Date.parse(`${day}T17:00:00Z`); // next 00:00 WIB
  if (syncedMs >= endMs) return true;
  return Date.now() - syncedMs < FRESH_TTL_MS;
}

interface Row { day: string; gross: number | string; net: number | string; synced_at: string }

/** The ESB branches for the outlet filter (id + name). Empty when ESB is off. */
export async function getSeasonalBranches(): Promise<{ id: string; name: string }[]> {
  if (!esbConfigured()) return [];
  try {
    return await esbListBranches();
  } catch {
    return [];
  }
}

/** Read the cached year for a branch and report which days still need a pull. */
export async function getSeasonal(year: number, branch = ""): Promise<SeasonalReport> {
  if (!esbConfigured()) return { configured: false, year, branch, months: {}, pendingDays: [], error: "Integrasi ESB belum dikonfigurasi." };
  if (!dbEnabled) return { configured: true, year, branch, months: {}, pendingDays: [] };
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  let rows: Row[];
  try {
    rows = await selectAll<Row>("seasonal_daily", (a, b) =>
      db().from("seasonal_daily").select("day,gross,net,synced_at").eq("branch", branch).gte("day", from).lte("day", to).order("day").range(a, b),
    );
  } catch (e) {
    return { configured: true, year, branch, months: {}, pendingDays: [], error: e instanceof Error ? e.message : String(e) };
  }

  const months: Record<number, Record<number, SeasonalDayValue>> = {};
  const have = new Map<string, string>();
  for (const r of rows) {
    const d = new Date(`${r.day}T00:00:00`);
    (months[d.getMonth()] ??= {})[d.getDate()] = { gross: Number(r.gross) || 0, net: Number(r.net) || 0 };
    have.set(r.day, r.synced_at);
  }
  const today = todayWib();
  const pendingDays: string[] = [];
  for (const day of eachDay(from, to)) {
    if (day > today) continue;
    const s = have.get(day);
    if (!s || !fresh(s, day)) pendingDays.push(day);
  }
  return { configured: true, year, branch, months, pendingDays };
}

/** Pull the next batch of missing/stale days of [from, to] for a branch from ESB
 *  into the cache, newest first, stopping near the budget. */
export async function syncSeasonalDays(from: string, to: string, branch = "", budgetMs = 42_000, force = false): Promise<{ synced: number; remaining: number; error?: string }> {
  if (!dbEnabled || !esbConfigured()) return { synced: 0, remaining: 0 };
  const cached = await selectAll<{ day: string; synced_at: string; bills: number | null }>("seasonal_daily", (a, b) =>
    db().from("seasonal_daily").select("day,synced_at,bills").eq("branch", branch).gte("day", from).lte("day", to).order("day").range(a, b),
  );
  const have = new Map(cached.map((r) => [r.day, r.synced_at]));
  // Hari yang jumlah struknya belum pernah ditarik dianggap belum lengkap —
  // hanya untuk cabang gabungan, karena dari situlah Average Transaction
  // dihitung. Tanpa ini, hari yang sudah tersimpan sebelum kolomnya ada tidak
  // akan pernah ditarik ulang: hari yang sudah lewat memang dianggap FINAL,
  // dan bulan-bulan lama akan selamanya kosong tanpa satu pun tanda.
  const perluStruk = new Set(branch === "" ? cached.filter((r) => r.bills === null).map((r) => r.day) : []);
  const today = todayWib();
  // `force` re-pulls every past day (used once to overwrite data synced from an
  // old source); otherwise only missing/stale days are fetched.
  const pending = eachDay(from, to).filter(
    (d) => d <= today && (force || !have.get(d) || !fresh(have.get(d)!, d) || perluStruk.has(d)),
  );
  if (force) {
    // Re-pull the LEAST-recently-synced days first so a repeated loop advances
    // through the whole year instead of redoing the newest days every call.
    pending.sort((a, b) => (have.get(a) ?? "").localeCompare(have.get(b) ?? ""));
  } else {
    pending.sort().reverse(); // newest day first
  }
  if (pending.length === 0) return { synced: 0, remaining: 0 };
  const started = Date.now();
  esbEnsureDeadline(budgetMs); // batas waktu ikut berlaku di dalam klien ESB
  let synced = 0;
  let fails = 0;
  let error: string | undefined;
  for (const day of pending) {
    if (synced > 0 && Date.now() - started > budgetMs) break;
    try {
      const sales = await esbFetchSales(day, day, branch);
      // Jumlah tamu dan struk ikut disimpan: Average Transaction sebulan
      // dihitung dari total struk sebulan, dan angka itu tidak bisa direka
      // ulang dari gross/net yang sudah tersimpan.
      const up = await db().from("seasonal_daily").upsert({
        day,
        branch,
        gross: sales.gross,
        net: sales.net,
        pax: sales.pax,
        bills: sales.bills,
        synced_at: new Date().toISOString(),
      });
      if (up.error) throw new Error(up.error.message);
      synced += 1;
      fails = 0;
    } catch (e) {
      // ESB menolak sebentar setelah puluhan permintaan beruntun, dan bentuknya
      // bukan pesan yang jelas melainkan balasan yang tidak bisa diuraikan.
      // Menunggu sejenak sebelum mencoba lagi: tanpa jeda, lima kegagalan
      // berturut-turut datang dalam dua detik dan sisa anggaran waktunya
      // terbuang tanpa satu hari pun bertambah.
      error = e instanceof Error ? e.message : "Gagal memuat data ESB.";
      fails += 1;
      if (fails >= 5) break;
      await new Promise((r) => setTimeout(r, fails * 1_500));
    }
  }
  return { synced, remaining: pending.length - synced, error };
}

/* ------------------------- Penarikan borongan (kejar) ------------------------- */

/** Satu pekerjaan tarik: satu cabang, satu tanggal. Itulah satuan terkecil yang
 *  dilayani ESB — tidak ada panggilan yang memulangkan rincian per hari. */
export interface TugasTarik { branch: string; day: string }

/**
 * Pasangan cabang×tanggal yang MASIH kurang di rentang ini.
 *
 * Dibaca sekali untuk seluruh cabang, bukan sekali per cabang. Yang lama
 * membaca ulang tiap cabang — 57 perjalanan bolak-balik ke basis data hanya
 * untuk menyusun daftar kerjanya, dan itu terjadi di dalam anggaran waktu yang
 * sama dengan penarikannya sendiri.
 *
 * URUTANNYA TANGGAL DULU, BARU CABANG. Dengan begitu panggilan-panggilan yang
 * berjalan berbarengan selalu mengenai cabang yang berbeda, bukan menumpuk di
 * satu cabang yang sama.
 */
export async function lubangSeasonal(from: string, to: string, cabang: readonly string[]): Promise<TugasTarik[]> {
  if (!dbEnabled || cabang.length === 0) return [];
  const rows = await selectAll<{ day: string; branch: string; synced_at: string }>("seasonal_daily", (a, b) =>
    db().from("seasonal_daily").select("day,branch,synced_at").in("branch", cabang as string[])
      .gte("day", from).lte("day", to).order("day").order("branch").range(a, b),
  );
  const punya = new Map(rows.map((r) => [`${r.day}|${r.branch}`, r.synced_at]));
  const today = todayWib();
  const out: TugasTarik[] = [];
  for (const day of eachDay(from, to)) {
    if (day > today) continue;
    for (const branch of cabang) {
      const s = punya.get(`${day}|${branch}`);
      if (!s || !fresh(s, day)) out.push({ branch, day });
    }
  }
  return out;
}

export interface HasilTarik {
  /** Baris yang benar-benar masuk ke basis data. */
  terisi: number;
  /** Panggilan ESB yang gagal — hari itu tetap kosong dan akan dicoba lagi. */
  gagal: number;
  /** Berapa banyak panggilan yang jalan berbarengan di akhir jalan ini. */
  konkuren: number;
  /** Berapa yang dipakai saat mulai — pembandingnya, supaya terlihat apakah
   *  ESB memaksa turun. */
  konkurenAwal: number;
  /** Berapa kali ESB dipanggil, berhasil maupun tidak. Angka inilah yang
   *  menentukan kapan remnya datang, jadi tanpa mencatatnya bentuk remnya cuma
   *  bisa ditebak. */
  panggilan: number;
  /** Berapa kali harus menunggu rem lepas. */
  jeda: number;
  error?: string;
}

/** Berapa panggilan ESB yang boleh jalan berbarengan saat mulai. */
export const KONKUREN_AWAL = 4;
/** Batas atas yang tidak pernah dilewati, berapa pun yang diminta pemanggil. */
export const KONKUREN_MAKS = 10;
/** Berapa baris dikumpulkan sebelum ditulis sekaligus ke basis data. */
const BORONGAN = 25;
/** Jeda terpanjang saat menunggu rem ESB lepas. */
const JEDA_MAKS_MS = 8_000;
/** Kegagalan beruntun pada kecepatan terendah yang berarti ESB benar-benar
 *  sedang menutup pintu — bukan sekadar mengerem. */
const BATAS_MENYERAH = 12;

/**
 * TARIK BANYAK PASANGAN SEKALIGUS, dengan beberapa panggilan berjalan bersamaan.
 *
 * Inilah yang membuat penarikan Januari–hari ini selesai dalam hitungan menit
 * alih-alih hari. Satu panggilan highlight ke ESB memakan 0,6–1 detik, dan
 * hampir seluruhnya adalah MENUNGGU JARINGAN — bukan pekerjaan kita. Menunggu
 * satu per satu berarti 11.000 panggilan × 1 detik ≈ tiga jam murni menunggu,
 * dipotong-potong jadi ratusan jendela 40 detik.
 *
 * Yang DULU menghalangi bukan aturan ESB melainkan salah paham: "ESB melayani
 * satu panggilan pada satu waktu" itu berlaku untuk EKSPOR (berkas yang
 * dibangkitkan di sisi ESB lalu diambil per halaman — dan memang pernah
 * tertukar antar hari). Highlight bukan ekspor: satu permintaan, satu balasan,
 * di sambungan yang sama. Tidak ada yang bisa tertukar.
 *
 * Yang tetap harus dijaga ada dua, dan keduanya dijaga di sini:
 *  - SESI. ESB satu sesi per akun, jadi login dibuat tunggal di klien ESB;
 *    tanpa itu rombongan pertama saling mematikan sesi masing-masing.
 *  - REM ESB. Sesudah beberapa puluh permintaan, ESB berhenti menjawab data dan
 *    membalas halaman HTML. TERUKUR dari catatan cron: penarikan bulanan yang
 *    masih satu-satu pun kena di tarikan ke-49 dan ke-39. Jadi yang dibatasi
 *    JUMLAH PERMINTAAN, bukan kebersamaannya — dan menyerah saat kena rem
 *    berarti membuang sisa jendela waktunya percuma.
 *
 * Maka saat kena rem, yang dilakukan BUKAN berhenti: jumlah panggilan
 * berbarengan langsung turun ke satu, ditunggu sebentar, lalu diteruskan. Satu
 * jendela dengan demikian bisa melewati beberapa kali rem, bukan mati di rem
 * yang pertama.
 */
export async function tarikPasangan(
  tugas: readonly TugasTarik[],
  opts: { budgetMs: number; konkuren?: number },
): Promise<HasilTarik> {
  if (!dbEnabled || !esbConfigured() || tugas.length === 0) {
    return { terisi: 0, gagal: 0, konkuren: 0, konkurenAwal: 0, panggilan: 0, jeda: 0 };
  }
  const mulai = Date.now();
  const habis = () => Date.now() - mulai > opts.budgetMs;
  esbEnsureDeadline(opts.budgetMs);

  let berikut = 0;
  let terisi = 0;
  let gagal = 0;
  let gagalBeruntun = 0;
  let panggilan = 0;
  let jeda = 0;
  const konkurenAwal = Math.max(1, Math.min(KONKUREN_MAKS, opts.konkuren ?? KONKUREN_AWAL));
  let hidup = konkurenAwal;
  let berhenti = false;
  let error: string | undefined;

  interface Baris { day: string; branch: string; gross: number; net: number; pax: number; bills: number; synced_at: string }
  let tampung: Baris[] = [];

  /** Tulis yang sudah terkumpul. Satu perjalanan untuk 25 baris, bukan 25. */
  const tuang = async () => {
    if (tampung.length === 0) return;
    const kirim = tampung;
    tampung = [];
    const up = await db().from("seasonal_daily").upsert(kirim);
    if (up.error) {
      // Baris yang gagal ditulis BUKAN baris yang terisi. Menghitungnya sebagai
      // terisi membuat layar melaporkan kemajuan yang tidak ada di basis data.
      gagal += kirim.length;
      error = up.error.message;
      return;
    }
    terisi += kirim.length;
  };

  const pekerja = async () => {
    for (;;) {
      if (berhenti || habis() || berikut >= tugas.length) break;
      const t = tugas[berikut];
      berikut += 1;
      panggilan += 1;
      try {
        const sales = await esbFetchSales(t.day, t.day, t.branch);
        gagalBeruntun = 0;
        tampung.push({
          day: t.day, branch: t.branch,
          gross: sales.gross, net: sales.net, pax: sales.pax, bills: sales.bills,
          synced_at: new Date().toISOString(),
        });
        if (tampung.length >= BORONGAN) await tuang();
      } catch (e) {
        gagal += 1;
        gagalBeruntun += 1;
        error = e instanceof Error ? e.message : "Gagal memuat data ESB.";

        // Hari yang gagal SENGAJA TIDAK diulang di jendela ini. Lubangnya akan
        // ditemukan lagi oleh jendela berikutnya, jadi tidak ada yang hilang —
        // sedangkan mengulanginya di sini berisiko berputar selamanya pada hari
        // yang memang tidak bisa ditarik.

        // Pekerja yang berlebih mundur dulu — tapi yang terakhir TIDAK pernah
        // mundur, supaya jendelanya tidak mati di rem yang pertama.
        if (gagalBeruntun >= 3 && hidup > 1) {
          hidup -= 1;
          gagalBeruntun = 0; // beri jatah baru pada kecepatan yang lebih rendah
          break;
        }
        if (gagalBeruntun >= BATAS_MENYERAH) { berhenti = true; break; }

        // Jedanya memanjang, dan di sinilah rem ESB benar-benar ditunggu.
        // Anggaran waktu tetap yang menentukan: percuma tidur melewati batas.
        jeda += 1;
        const tidur = Math.min(gagalBeruntun * 1_500, JEDA_MAKS_MS);
        const sisa = opts.budgetMs - (Date.now() - mulai);
        if (sisa <= tidur + 1_000) break;
        await new Promise((r) => setTimeout(r, tidur));
      }
    }
  };

  // Pekerja yang mundur karena rem tidak boleh meninggalkan antreannya begitu
  // saja: selama masih ada waktu dan masih ada yang kurang, yang tersisa
  // diteruskan. Tanpa putaran ini, satu rem di detik ke-12 menyisakan tiga
  // puluh detik yang tidak dipakai — persis yang terjadi pada jalan pertama.
  await Promise.all(Array.from({ length: hidup }, () => pekerja()));
  while (!berhenti && !habis() && berikut < tugas.length) {
    await Promise.all(Array.from({ length: hidup }, () => pekerja()));
  }
  await tuang();
  return { terisi, gagal, konkuren: hidup, konkurenAwal, panggilan, jeda, error };
}
