import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { SEED } from "./seed";
import { loadCredentials, snapshotCredentials } from "./credentials";
import {
  areaFromRow,
  areaToRow,
  complaintFromRow,
  complaintToRow,
  eventFromRow,
  eventToRow,
  hospitalityFromRow,
  hospitalityToRow,
  hygieneFromRow,
  hygieneToRow,
  notificationFromRow,
  notificationToRow,
  outletFromRow,
  outletToRow,
  taskFromRow,
  taskToRow,
  userFromRow,
  userToRow,
} from "./rows";

/**
 * Boot-time hydration for the persistent data layer.
 *
 * - First boot (empty DB): pushes the generated demo seed to Supabase once.
 * - Every later boot: loads all tables and REPLACES the contents of the SEED
 *   arrays in place, so every existing reference (store.ts, mutations.ts, the
 *   globalThis seed cache) sees the persisted data with zero signature changes.
 *
 * Called from `getSessionUser()` — the single entry point every server render
 * and action goes through — so reads never observe a pre-hydration store.
 */

const g = globalThis as typeof globalThis & {
  __GWG_HYDRATION__?: { at: number; inflight: Promise<void> | null };
  /** Reference tables refresh on their own slower clock (see REFERENCE_TTL_MS). */
  __GWG_REF_AT__?: number;
  /** Avatars refresh slowest of all — they are large and change rarely. */
  __GWG_AVATARS__?: { at: number; map: Map<string, string | null> };
};

/**
 * Re-read from the database at most once per window. Hydration dulu berjalan
 * sekali per proses, sehingga satu instance melayani cuplikan saat boot dan
 * tidak pernah melihat tulisan instance lain. Dengan TTL, larik di memori jadi
 * singgahan segar dan basis data tetap sumber kebenaran: setiap instance
 * menyusul dalam satu TTL setelah tulisan mana pun.
 *
 * NILAINYA PERNAH 3 DETIK, DAN ITU MEMATIKAN PRODUKSI.
 *
 * Sekali hidrasi menarik seluruh isi enam tabel: hospitality, tasks, events,
 * hygiene, complaints, notifications — sekitar 1,5 MB mentah, dan lebih besar
 * lagi setelah jadi JSON di kabel. Pada 3 detik, SATU instance yang dipakai
 * terus-menerus menarik ±30 MB per menit; Vercel menjalankan banyak instance
 * sekaligus. Jatah egress Supabase paket gratis 5 GB bisa habis dalam hitungan
 * jam, dan begitu habis SELURUH project diblokir: aplikasi tidak bisa membaca
 * apa pun, tidak ada yang bisa login, dan layarnya jatuh ke data contoh.
 *
 * Itu benar-benar terjadi — 38,5 GB terpakai dari jatah 5 GB, produksi mati.
 *
 * Angkanya kini disamakan dengan REFERENCE_TTL_MS. Konsekuensinya jujur:
 * perubahan yang dibuat orang lain baru terlihat di instance lain paling lama
 * satu TTL kemudian. Untuk aplikasi operasional internal, tertinggal setengah
 * menit jauh lebih murah daripada seluruh sistem berhenti. Yang menulis tetap
 * melihat hasilnya seketika lewat `markLocalWrite` + `revalidatePath`.
 *
 * Bisa disetel lewat GWG_HYDRATION_TTL_MS bila perlu diubah tanpa deploy —
 * tapi JANGAN dikecilkan lagi tanpa mengukur egress-nya lebih dulu.
 */
const HYDRATION_TTL_MS = Math.max(5_000, Number(process.env.GWG_HYDRATION_TTL_MS) || 30_000);

/**
 * Reference data — users, credentials, areas, outlets — only changes when an
 * admin edits it, and those paths call `revalidatePath`. Re-reading it every
 * 3 seconds on every instance was ~20k needless full-table reads a day, so it
 * gets its own slow clock.
 */
const REFERENCE_TTL_MS = 30_000;

/**
 * Avatars are by far the heaviest thing in `users` (legacy rows hold base64
 * data URIs of 200 kB+). They are fetched separately and merged back in, so the
 * per-request hydration never carries them.
 */
const AVATAR_TTL_MS = 5 * 60_000;

/** Columns pulled per table — never `*`. Heavy columns are fetched on demand
 *  instead (users.avatar_url here; hygiene.photos on the Hygiene page). */
const USER_COLUMNS =
  "id,name,email,role,area_id,outlet_ids,phone,country,department,jabatan,grants,active,created_at";
// `ratings` sengaja TIDAK ikut: 772 kB untuk 1.089 audit, hanya ditulis saat
// membuat audit dan tidak pernah dibaca satu pun tampilan. Menariknya tiap
// hidrasi membuat respons hygiene membengkak sampai koneksinya putus
// ("TypeError: terminated"), dan begitu hidrasi gagal SELURUH modul menyajikan
// data lama — audit yang baru diunggah seolah hilang dari tabel.
const HYGIENE_COLUMNS =
  "id,outlet_id,area_id,date,shift,inspector_name,supervisor_name,findings,is_clean,hygiene_score,created_at";

/**
 * Apakah instance ini PERNAH berhasil memuat data dari basis data?
 *
 * Bedanya besar, dan inilah yang membedakan data basi dari data palsu:
 *
 *  • Pernah berhasil, lalu penyegaran berikutnya gagal → yang tersaji adalah
 *    data SUNGGUHAN yang agak lama. Itu masih layak disajikan; memang begitu
 *    cara singgahan ini dirancang.
 *  • BELUM PERNAH berhasil → larik di memori masih berisi data contoh bawaan,
 *    59 nama karangan lengkap dengan outlet dan nilainya. Menyajikannya sama
 *    saja dengan berbohong, dan tidak ada satu pun tanda di layar yang
 *    membedakannya dari data perusahaan.
 *
 * Yang kedua itulah yang terjadi 20 Agustus 2026: Supabase memblokir project
 * karena egress habis, hidrasi gagal di setiap instance baru, dan aplikasi
 * menyajikan data contoh seolah tidak terjadi apa-apa. Pemiliknya menyimpulkan
 * seluruh datanya terhapus.
 */
export function hidrasiPernahBerhasil(): boolean {
  return (g.__GWG_HYDRATION__?.at ?? 0) > 0;
}

export function ensureHydrated(): Promise<void> {
  if (!dbEnabled) return Promise.resolve();
  const state = (g.__GWG_HYDRATION__ ??= { at: 0, inflight: null });
  // First-ever load has no data yet → must block. Once we have a snapshot
  // (at > 0) reads are served from the in-memory cache immediately and the
  // refresh runs in the background (stale-while-revalidate), so navigating
  // between pages never waits on the 10-table re-read.
  const firstLoad = state.at === 0;
  if (state.inflight) return firstLoad ? state.inflight : Promise.resolve();
  if (Date.now() - state.at < HYDRATION_TTL_MS) return Promise.resolve(); // fresh enough
  const p = hydrate()
    .then(() => {
      state.at = Date.now();
    })
    .catch((err) => {
      // Leave `at` unchanged so the next request retries; serve last-known data.
      console.error("[hydrate] failed — serving last-known data:", err);
    })
    .finally(() => {
      state.inflight = null;
    });
  state.inflight = p;
  return firstLoad ? p : Promise.resolve();
}

/**
 * Called by the persistence layer right after a local write. It marks the cache
 * fresh so the next re-hydration is deferred by one TTL — giving the async DB
 * write time to land before we reload, which prevents a just-created row from
 * momentarily flickering out of view on the instance that created it.
 */
export function markLocalWrite() {
  const state = (g.__GWG_HYDRATION__ ??= { at: 0, inflight: null });
  state.at = Date.now();
  // A write may have touched reference data (users, outlets, areas, logins), so
  // expire its slower clock: the next hydration reloads it instead of serving a
  // snapshot up to REFERENCE_TTL_MS old on the instance that just wrote.
  g.__GWG_REF_AT__ = 0;
  g.__GWG_AVATARS__ = undefined;
}

function replaceInPlace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

/** Avatar map, refreshed on its own slow clock. */
async function avatarMap(): Promise<Map<string, string | null>> {
  const cached = g.__GWG_AVATARS__;
  if (cached && Date.now() - cached.at < AVATAR_TTL_MS) return cached.map;
  let rows: { id: string; avatar_url: string | null }[];
  try {
    rows = await selectAll<{ id: string; avatar_url: string | null }>("avatars", (from, to) =>
      db().from("users").select("id,avatar_url").order("id", { ascending: true }).range(from, to),
    );
  } catch {
    return cached?.map ?? new Map();
  }
  const map = new Map<string, string | null>(rows.map((r) => [r.id, r.avatar_url ?? null]));
  g.__GWG_AVATARS__ = { at: Date.now(), map };
  return map;
}

async function hydrate() {
  const supabase = db();

  /**
   * Satu tabel gagal TIDAK boleh menjatuhkan seluruh hidrasi.
   *
   * Sebelumnya `get` melempar, dan karena semua tabel diambil dalam satu
   * Promise.all, satu respons yang putus membuat users/tasks/complaints ikut
   * tidak diperbarui — pengguna melihat data lama di mana-mana tanpa tanda
   * apa pun. Sekarang tabel yang gagal dilewati (isinya dipertahankan), yang
   * berhasil tetap diperbarui.
   */
  const failed: string[] = [];

  /**
   * Baca satu tabel UTUH, halaman demi halaman (lihat `paged.ts`).
   *
   * `key` adalah kolom pengurut dan harus unik di tabelnya — hampir semua tabel
   * memakai `id`, tapi `credentials` tidak punya kolom itu sama sekali, dan
   * mengurutkan pakai kolom yang tidak ada membuat SELURUH tabel gagal dimuat.
   */
  const get = async (table: string, columns = "*", key = "id") => {
    try {
      return await selectAll<Record<string, unknown>>(`hydrate ${table}`, (from, to) =>
        supabase.from(table).select(columns).order(key, { ascending: true }).range(from, to),
      );
    } catch (e) {
      console.error(`[hydrate] ${table} gagal dimuat — mempertahankan data sebelumnya:`, e);
      failed.push(table);
      return null;
    }
  };

  // Reference data changes only through admin actions, so it rides a slower
  // clock. `at === 0` (cold instance) always loads it.
  const refDue = Date.now() - (g.__GWG_REF_AT__ ?? 0) >= REFERENCE_TTL_MS;

  const [hospitality, tasks, events, hygiene, complaints, notifications] = await Promise.all([
    get("hospitality"),
    get("tasks"),
    get("events"),
    get("hygiene", HYGIENE_COLUMNS),
    get("complaints"),
    get("notifications"),
  ]);

  if (refDue) {
    const [users, creds, areas, outlets, avatars] = await Promise.all([
      get("users", USER_COLUMNS),
      get("credentials", "*", "user_id"),
      get("areas"),
      get("outlets"),
      avatarMap(),
    ]);

    // Empty database (first ever boot) → publish the demo seed once.
    if (users && users.length === 0) {
      await pushSeed();
      g.__GWG_REF_AT__ = Date.now();
      return;
    }

    if (users) {
      replaceInPlace(
        SEED.users,
        users.map((r) => {
          const u = userFromRow(r);
          u.avatarUrl = avatars.get(u.id) ?? null;
          return u;
        }),
      );
    }
    if (areas) replaceInPlace(SEED.areas, areas.map(areaFromRow));
    if (outlets) replaceInPlace(SEED.outlets, outlets.map(outletFromRow));
    if (creds) {
      loadCredentials(
        (creds as unknown as { user_id: string; username: string; password_hash: string }[]).map((r) => ({
          userId: r.user_id,
          username: r.username,
          passwordHash: r.password_hash,
        })),
      );
    }
    if (users && areas && outlets && creds) g.__GWG_REF_AT__ = Date.now();
  }

  if (hospitality) replaceInPlace(SEED.hospitality, hospitality.map(hospitalityFromRow));
  if (tasks) {
    replaceInPlace(
      SEED.tasks,
      tasks.map(taskFromRow).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  }
  if (events) replaceInPlace(SEED.events, events.map(eventFromRow));
  if (hygiene) replaceInPlace(SEED.hygiene, hygiene.map(hygieneFromRow));
  if (complaints) replaceInPlace(SEED.complaints, complaints.map(complaintFromRow));
  if (notifications) {
    replaceInPlace(
      SEED.notifications,
      notifications.map(notificationFromRow).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  }
  // Gagal sebagian ⇒ jangan tandai segar, supaya permintaan berikutnya mencoba
  // lagi alih-alih menunggu satu TTL penuh dengan data yang belum lengkap.
  if (failed.length > 0) throw new Error(`tabel gagal dimuat: ${failed.join(", ")}`);
}

async function pushSeed() {
  const supabase = db();
  // Upsert (not insert) so concurrent first boots — e.g. several build workers
  // racing the empty-table check — converge on the same rows instead of failing.
  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500));
      if (error) throw new Error(`seed ${table}: ${error.message}`);
    }
  };

  // FK order: users → areas → outlets → everything referencing outlets.
  await insert("users", SEED.users.map(userToRow));
  await insert(
    "credentials",
    snapshotCredentials().map((c) => ({ user_id: c.userId, username: c.username, password_hash: c.passwordHash })),
  );
  await insert("areas", SEED.areas.map(areaToRow));
  await insert("outlets", SEED.outlets.map(outletToRow));
  await insert("hospitality", SEED.hospitality.map(hospitalityToRow));
  await insert("tasks", SEED.tasks.map(taskToRow));
  await insert("events", SEED.events.map(eventToRow));
  await insert("hygiene", SEED.hygiene.map(hygieneToRow));
  await insert("complaints", SEED.complaints.map(complaintToRow));
  await insert("notifications", SEED.notifications.map(notificationToRow));

  console.log("[hydrate] first boot — demo seed pushed to Supabase");
}
