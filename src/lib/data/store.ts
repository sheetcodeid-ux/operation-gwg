/**
 * Repository layer over the seed dataset.
 *
 * Every read the UI performs goes through these functions. In Phase 11 the
 * bodies are reimplemented against Supabase while signatures stay stable, so
 * pages and server actions never change.
 *
 * `server-only`: this module holds the full dataset (incl. every user's email
 * and role). The guard makes any accidental *value* import from a client
 * component a build-time error. Type-only imports remain fine (elided).
 */
import "server-only";

import { hasGlobalScope, scopeOutlets } from "../rbac";
import type {
  AppNotification,
  Area,
  Complaint,
  HospitalityAssessment,
  HygieneAudit,
  OpsEvent,
  Outlet,
  UserProfile,
  WorkTask,
} from "../types";
import { SEED } from "./seed";
import { db, dbEnabled } from "./db";
import { notificationFromRow } from "./rows";
import { canVerifyHpp } from "../hpp/access";
import { complaintCategoryScope } from "../complaints-access";
import { nowMs } from "../now";
import { buildCompareData, type CompareData } from "../compare-data";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------------- org lookups ---------------- */
export function getAreas(): Area[] {
  return SEED.areas;
}
export function getOutlets(): Outlet[] {
  return SEED.outlets;
}
export function getUsers(): UserProfile[] {
  return SEED.users;
}
export function getUser(id: string): UserProfile | undefined {
  return SEED.users.find((u) => u.id === id);
}
export function getOutlet(id: string): Outlet | undefined {
  return SEED.outlets.find((o) => o.id === id);
}
export function getArea(id: string): Area | undefined {
  return SEED.areas.find((a) => a.id === id);
}
export function outletName(id: string): string {
  return getOutlet(id)?.name ?? "—";
}
export function areaName(id: string): string {
  return getArea(id)?.name ?? "—";
}
/**
 * Area Coordinator responsible for an outlet, derived from User Management
 * assignments (a coordinator's outletIds may hold the app id OR the POS code).
 * This is the source of truth for coverage, so it stays in sync with what the
 * admin actually assigned — unlike the legacy `areas` table.
 */
export function outletCoordinatorName(outletId: string): string {
  const code = getOutlet(outletId)?.code;
  const coord = getUsers().find(
    (u) =>
      u.role === "area_coordinator" &&
      (u.outletIds ?? []).some((oid) => oid === outletId || (code != null && oid === code)),
  );
  return coord?.name ?? "—";
}
export function userName(id: string): string {
  return getUser(id)?.name ?? "—";
}

/** Outlets visible to a given user (row-level scoping). */
export function visibleOutlets(user: UserProfile): Outlet[] {
  return scopeOutlets(user, SEED.outlets);
}
function visibleOutletIdSet(user: UserProfile): Set<string> {
  return new Set(visibleOutlets(user).map((o) => o.id));
}

/* ---------------- scoped module reads ---------------- */
export function listHospitality(user: UserProfile): HospitalityAssessment[] {
  const ids = visibleOutletIdSet(user);
  return SEED.hospitality.filter((h) => ids.has(h.outletId)).sort(byDateDesc("date"));
}
/**
 * SELURUH tugas Work Tracker, tanpa pembatasan cabang.
 *
 * Dipakai perhitungan yang memang lintas cabang — indikator KPI Problem Solver
 * dihitung dari pekerjaan satu orang di mana pun cabangnya, dan menyaringnya
 * lewat cakupan pembaca akan membuat dua orang melihat skor berbeda untuk
 * orang yang sama.
 */
export function semuaTugas(): WorkTask[] {
  return SEED.tasks;
}

export function listTasks(user: UserProfile): WorkTask[] {
  const ids = visibleOutletIdSet(user);
  return SEED.tasks.filter((t) => t.outletId === null || ids.has(t.outletId)).sort(byDateDesc("createdAt"));
}

/** Work Tracker is department-scoped: a member sees ONLY their own department's
 *  tasks (Business Development sees Business Development, etc.). Super Admin sees
 *  every department. Users without a department fall back to outlet scope. */
export function listDeptTasks(user: UserProfile): WorkTask[] {
  const all = [...SEED.tasks].sort(byDateDesc("createdAt"));
  if (hasGlobalScope(user.role)) return all;
  if (user.department) return all.filter((t) => t.division === user.department);
  return listTasks(user);
}
export function listEvents(user: UserProfile): OpsEvent[] {
  const ids = visibleOutletIdSet(user);
  return SEED.events.filter((e) => ids.has(e.outletId)).sort(byDateDesc("startDate"));
}
export function listHygiene(user: UserProfile): HygieneAudit[] {
  const ids = visibleOutletIdSet(user);
  return SEED.hygiene.filter((h) => ids.has(h.outletId)).sort(byDateDesc("date"));
}
export function listComplaints(user: UserProfile): Complaint[] {
  const ids = visibleOutletIdSet(user);
  // Sebagian departemen hanya berkepentingan pada sebagian kategori (PDQ =
  // mutu makanan saja). Disaring di sini, di satu-satunya pintu baca komplain,
  // supaya tidak ada halaman yang kelupaan menerapkannya.
  const kategori = complaintCategoryScope(user);
  return SEED.complaints
    .filter((c) => ids.has(c.outletId))
    .filter((c) => kategori === null || kategori.includes(c.category))
    .sort(byDateDesc("createdAt"));
}
export function getComplaint(id: string): Complaint | undefined {
  return SEED.complaints.find((c) => c.id === id);
}
/**
 * Notifikasi yang benar-benar untuk satu pengguna.
 *
 * Aturan penerimanya dipusatkan di `forMe` dan dipakai untuk SEMUA sumber —
 * itu yang paling penting di sini.
 *
 * Dulu hanya hasil kueri berpenyaring yang diperiksa, sementara
 * `SEED.notifications` ikut dikembalikan apa adanya. Di produksi `SEED` bukan
 * data contoh: `hydrate` mengisinya dengan SELURUH tabel notifikasi. Karena
 * kebanyakan notifikasi tidak punya `outletId`, syarat `!n.outletId` meloloskan
 * semuanya — sehingga setiap orang melihat notifikasi milik SETIAP orang lain.
 * Akun Creative melihat penyelesaian dokumen HC dan tiket System Support yang
 * ditujukan ke orang lain.
 */
export async function listNotifications(user: UserProfile) {
  const ids = visibleOutletIdSet(user);
  const canVerify = canVerifyHpp(user);
  const dept = user.department ?? "";

  const forMe = (n: AppNotification): boolean => {
    if (n.dismissed) return false;
    // Berpenerima jelas: hanya dia yang boleh melihatnya.
    if (n.targetUser) return n.targetUser === user.id;
    if (n.department) return !!dept && n.department === dept;
    // Permintaan verifikasi HPP memang tanpa penerima — hanya untuk yang berhak.
    if (n.kind === "hpp_review") return canVerify;
    // Sisanya notifikasi lama bercakupan outlet (peringatan operasional).
    return !n.outletId || ids.has(n.outletId);
  };

  const base = SEED.notifications.filter(forMe);
  if (!dbEnabled) return base;

  // Cabang kueri dibuat PERSIS seperti `forMe`, bukan lebih longgar.
  //
  // Versi longgar ("ambil semua yang `target_user` kosong, saring belakangan")
  // kelihatan sama hasilnya, tapi tidak: jendela 60 baris terakhir bisa habis
  // terisi notifikasi departemen lain yang kemudian dibuang `forMe`, dan
  // orangnya melihat daftar kosong padahal ada notifikasi untuknya.
  //
  // Nilainya dikutip ganda karena nama departemen boleh mengandung koma atau
  // tanda kurung — karakter yang justru memisahkan cabang di PostgREST.
  const cabang = [`target_user.eq."${user.id}"`];
  if (dept) cabang.push(`department.eq."${dept.replace(/"/g, "")}"`);
  if (canVerify) cabang.push("kind.eq.hpp_review");
  // Siaran lama bercakupan outlet: tanpa penerima perorangan maupun tim.
  cabang.push("and(target_user.is.null,department.is.null,kind.neq.hpp_review)");

  const { data } = await db()
    .from("notifications")
    .select("*")
    .eq("dismissed", false)
    .or(cabang.join(","))
    .order("created_at", { ascending: false })
    .limit(60);

  const extra = (data ?? []).map(notificationFromRow).filter(forMe);

  // `base` dan `extra` bersumber dari tabel yang sama di produksi, jadi tanpa
  // penyaringan ganda ini tiap notifikasi tampil dua kali.
  const seen = new Set(extra.map((n) => n.id));
  return [...extra, ...base.filter((n) => !seen.has(n.id))];
}

function byDateDesc<T>(key: keyof T) {
  return (a: T, b: T) => +new Date(b[key] as string) - +new Date(a[key] as string);
}

/* ---------------- score helpers ---------------- */
function latestByOutlet<T extends { outletId: string; date?: string; createdAt?: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const it of items) {
    const cur = map.get(it.outletId);
    const t = +new Date((it.date ?? it.createdAt) as string);
    if (!cur || t > +new Date((cur.date ?? cur.createdAt) as string)) map.set(it.outletId, it);
  }
  return map;
}

/**
 * ┌─ RATA-RATA SKOR AUDIT: KOSONG BERARTI BELUM DINILAI ────────────────────┐
 * │                                                                        │
 * │ `avg` di berkas ini mengembalikan 0 untuk daftar kosong, dan itu BENAR  │
 * │ untuk hal-hal yang memang terhitung: jumlah task, jumlah komplain,      │
 * │ anggaran. Nol di sana adalah pengukuran.                                │
 * │                                                                        │
 * │ Untuk SKOR AUDIT tidak. Outlet tanpa satu pun audit bukan outlet        │
 * │ bernilai nol — ia outlet yang belum diperiksa. Keduanya tidak boleh     │
 * │ memakai rata-rata yang sama, dan mengubah `avg` global akan menyeret    │
 * │ jumlah task ikut menjadi null.                                          │
 * │                                                                        │
 * │ Kontraknya:                                                             │
 * │   []            → null   (belum ada bukti sama sekali)                  │
 * │   [0]           → 0      (dinilai, dan nilainya nol)                    │
 * │   [80, null, 90]→ 85     (yang hilang tidak ikut menarik turun)         │
 * │   [null, null]  → null                                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 */
export function rataAudit(xs: readonly (number | null | undefined)[]): number | null {
  const ada = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return ada.length ? round1(ada.reduce((a, b) => a + b, 0) / ada.length) : null;
}

/** Skor hospitality outlet sepanjang masa. `null` = belum pernah dinilai. */
export function hospitalityScoreFor(outletId: string): number | null {
  const xs = SEED.hospitality.filter((h) => h.outletId === outletId).map((h) => h.overallScore);
  return rataAudit(xs);
}
/** Skor hygiene outlet sepanjang masa. `null` = belum pernah dinilai. */
export function hygieneScoreFor(outletId: string): number | null {
  const xs = SEED.hygiene.filter((h) => h.outletId === outletId).map((h) => h.hygieneScore);
  return rataAudit(xs);
}


/** Ambang atas jendela periode dashboard. Fungsi, bukan konstanta: instance
 *  server hidup berjam-jam, dan konstanta akan membeku di waktu boot. */
export const NOW = () => nowMs();


function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / prev) * 100);
}


/* ---------------- rankings ---------------- */

/**
 * ┌─ SKOR YANG BELUM PUNYA BUKTI AUDIT ADALAH `null`, BUKAN NOL ────────────┐
 * │                                                                        │
 * │ Dulu `?? 0`. Outlet yang BELUM PERNAH diaudit mendapat skor 0, lalu     │
 * │ compositenya jatuh dan ia mengendap di dasar peringkat — tidak bisa     │
 * │ dibedakan dari outlet yang sudah diaudit dan hasilnya memang buruk.     │
 * │ Layarnya pun sama: `toFixed(1)` menulis "0.0" untuk keduanya.           │
 * │                                                                        │
 * │ Tiga hal yang dijaga sekarang:                                          │
 * │   bukti audit hilang  ≠  skor 0                                         │
 * │   bukti audit hilang  ≠  performa terburuk                              │
 * │   bukti audit hilang  ≠  outlet terburuk                                │
 * │                                                                        │
 * │ `number | null`, bukan `Terukur` dari `@/lib/ops/mingguan`: berkas ini   │
 * │ lapisan store lama yang melayani /dashboard dan /outlets, dan menyeret  │
 * │ tipe Operational V.1 ke sini berarti menyeret domainnya juga. `null`    │
 * │ sudah menjadi idiom di tetangganya (`ops/harian.ts`,                     │
 * │ `data/performa-outlet.ts`) dan TypeScript strict tetap memaksa          │
 * │ pemeriksaannya di setiap pembaca.                                       │
 * └────────────────────────────────────────────────────────────────────────┘
 */
export interface OutletRankRow {
  outlet: Outlet;
  /** `null` = belum ada bukti audit hospitality. BUKAN nol. */
  hospitality: number | null;
  /** `null` = belum ada bukti audit hygiene. BUKAN nol. */
  hygiene: number | null;
  /** Jumlah komplain terbuka. Nol di sini BENAR-BENAR nol — lihat `hitungKomplain`. */
  complaints: number;
  /** `null` bila salah satu komponen skornya belum ada buktinya. */
  composite: number | null;
}

/** Skor satu outlet, atau `null` bila belum pernah diaudit. */
const skorAtauNull = (v: number | undefined): number | null => (v === undefined ? null : round1(v));

/**
 * Composite HANYA lahir dari bukti yang lengkap.
 *
 * DIEKSPOR supaya kontraknya bisa diuji langsung. Seluruh outlet di data contoh
 * punya kedua auditnya, jadi jalur UNKNOWN tidak pernah terjadi lewat
 * `outletRanking()` di lingkungan uji — dan kontrak yang tidak bisa diuji adalah
 * kontrak yang akan dilanggar diam-diam.
 *
 * Formulanya tidak berubah sedikit pun — bobot 0,45 / 0,45 dan penalti komplain
 * 2 tetap seperti sebelumnya. Yang berubah cuma satu: ia menolak menghitung
 * ketika salah satu komponennya tidak punya bukti, alih-alih memperlakukan
 * ketiadaan itu sebagai nol.
 */
export function skorKomposit(hospitality: number | null, hygiene: number | null, complaints: number): number | null {
  if (hospitality === null || hygiene === null) return null;
  return round1(hospitality * 0.45 + hygiene * 0.45 - complaints * 2);
}

/**
 * Urutan peringkat: yang BERSKOR lebih dulu, menurun. Yang belum berskor
 * menyusul, urut nama.
 *
 * `UNKNOWN` sampai di belakang sebagai akibat penyajian, BUKAN karena diberi
 * angka terendah. Tidak ada `?? 0` dan tidak ada `-Infinity` di sini — keduanya
 * akan membuatnya kembali bisa dibandingkan sebagai angka, dan itu persis yang
 * dilarang.
 */
export function urutkanPeringkat<T extends { composite: number | null; outlet: Outlet }>(a: T, b: T): number {
  if (a.composite === null && b.composite === null) return a.outlet.name.localeCompare(b.outlet.name, "id");
  if (a.composite === null) return 1;
  if (b.composite === null) return -1;
  return b.composite - a.composite;
}

export function outletRanking(user: UserProfile): OutletRankRow[] {
  const outlets = visibleOutlets(user);
  const hospLatest = latestByOutlet(SEED.hospitality);
  const hygLatest = latestByOutlet(SEED.hygiene);
  const complaintsByOutlet = new Map<string, number>();
  for (const c of SEED.complaints) {
    if (c.status !== "close") {
      complaintsByOutlet.set(c.outletId, (complaintsByOutlet.get(c.outletId) ?? 0) + 1);
    }
  }
  return outlets
    .map((outlet) => {
      const hospitality = skorAtauNull(hospLatest.get(outlet.id)?.overallScore);
      const hygiene = skorAtauNull(hygLatest.get(outlet.id)?.hygieneScore);
      // Nol di sini SAH: tidak ada komplain terbuka adalah pengukuran, bukan
      // ketiadaan bukti. Akumulatornya berjalan di atas daftar yang memang ada.
      const complaints = complaintsByOutlet.get(outlet.id) ?? 0;
      return { outlet, hospitality, hygiene, complaints, composite: skorKomposit(hospitality, hygiene, complaints) };
    })
    .sort(urutkanPeringkat);
}

/** Ranked outlet with scores computed inside a date window (fallback to latest), plus area + coordinator name. */
export interface RankedOutletRow {
  outlet: Outlet;
  area: string;
  coordinator: string;
  /** `null` = belum ada bukti audit hospitality, baik di jendela ini maupun sebelumnya. */
  hospitality: number | null;
  /** `null` = belum ada bukti audit hygiene. */
  hygiene: number | null;
  complaints: number;
  /** `null` bila salah satu komponen skornya belum ada buktinya. */
  composite: number | null;
}

export function outletRankingInRange(outletIds: string[], endMs: number, days: number): RankedOutletRow[] {
  const idSet = new Set(outletIds);
  const outlets = SEED.outlets.filter((o) => idSet.has(o.id));
  const startMs = endMs - days * 86_400_000;
  const inWin = (t: number) => t >= startMs && t <= endMs;

  const hospLatest = latestByOutlet(SEED.hospitality);
  const hygLatest = latestByOutlet(SEED.hygiene);

  const coordOf = new Map<string, string>();
  for (const u of SEED.users) {
    if (u.role === "area_coordinator") for (const oid of u.outletIds ?? []) coordOf.set(oid, u.name);
  }

  return outlets
    .map((outlet) => {
      const hosp = SEED.hospitality
        .filter((h) => h.outletId === outlet.id && inWin(+new Date(h.date)))
        .map((h) => h.overallScore);
      const hyg = SEED.hygiene
        .filter((h) => h.outletId === outlet.id && inWin(+new Date(h.date)))
        .map((h) => h.hygieneScore);
      // Semantik yang SAMA PERSIS dengan `outletRanking`: rata-rata jendela bila
      // ada, kalau tidak jatuh ke audit terakhir, kalau tidak ada juga → null.
      // Keduanya wajib sepakat — satu outlet tidak boleh terbaca UNKNOWN di
      // /outlets dan berskor 0 di /dashboard.
      const hospitality = hosp.length ? round1(avg(hosp)) : skorAtauNull(hospLatest.get(outlet.id)?.overallScore);
      const hygiene = hyg.length ? round1(avg(hyg)) : skorAtauNull(hygLatest.get(outlet.id)?.hygieneScore);
      const complaints = SEED.complaints.filter((c) => c.outletId === outlet.id && inWin(+new Date(c.createdAt))).length;
      return {
        outlet,
        area: getArea(outlet.areaId)?.name ?? "—",
        coordinator: coordOf.get(outlet.id) ?? "—",
        hospitality,
        hygiene,
        complaints,
        composite: skorKomposit(hospitality, hygiene, complaints),
      };
    })
    .sort(urutkanPeringkat);
}

export interface AreaRankRow {
  area: Area;
  outlets: number;
  hospitality: number;
  hygiene: number;
  complaintsOpen: number;
  composite: number;
}


/* ---------------- trends (last N days, bucketed weekly) ---------------- */


/* ---------------- Complaint comparison (this period vs previous) ---------------- */
export type { DayComparePoint, MonthComparePoint } from "../compare-data";
export type ComplaintCompareData = CompareData;

/** Combo-chart data for the Complaint Trend card (scoped to outletIds). "Received" = complaint createdAt. */
export function complaintCompareData(outletIds: string[]): ComplaintCompareData {
  const ids = new Set(outletIds);
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  return buildCompareData(comp.map((c) => c.createdAt), NOW());
}

/* ---------------- analytics aggregations ---------------- */
export interface AreaMetricRow {
  area: Area;
  hospitality: number;
  hygiene: number;
  taskCompletion: number;
  resolution: number;
}


/* ---------------- Outlet 360° ---------------- */
export interface OutletDetail {
  outlet: Outlet;
  areaName: string;
  supervisorName: string;
  picName: string;
  coordinatorName: string;
  /** `null` = outlet ini belum pernah diaudit hospitality. Bukan nol. */
  hospitality: number | null;
  /** `null` = outlet ini belum pernah diaudit hygiene. Bukan nol. */
  hygiene: number | null;
  tasksOpen: number;
  tasksDone: number;
  taskCompletion: number;
  complaintsOpen: number;
  eventsRunning: number;
  tasks: WorkTask[];
  events: OpsEvent[];
  hygieneAudits: HygieneAudit[];
  complaints: Complaint[];
  hospitalityAssessments: HospitalityAssessment[];
}

export function getOutletDetail(outletId: string): OutletDetail | null {
  const outlet = getOutlet(outletId);
  if (!outlet) return null;
  const tasks = SEED.tasks.filter((t) => t.outletId === outletId).sort(byDateDesc("createdAt"));
  const events = SEED.events.filter((e) => e.outletId === outletId).sort(byDateDesc("startDate"));
  const hygieneAudits = SEED.hygiene.filter((h) => h.outletId === outletId).sort(byDateDesc("date"));
  const complaints = SEED.complaints.filter((c) => c.outletId === outletId).sort(byDateDesc("createdAt"));
  const hospitalityAssessments = SEED.hospitality.filter((h) => h.outletId === outletId).sort(byDateDesc("date"));
  const done = tasks.filter((t) => t.status === "done").length;
  const area = getArea(outlet.areaId);
  return {
    outlet,
    areaName: area?.name ?? "—",
    supervisorName: userName(outlet.supervisorId),
    picName: userName(outlet.picId),
    coordinatorName: area ? userName(area.coordinatorId) : "—",
    hospitality: hospitalityScoreFor(outletId),
    hygiene: hygieneScoreFor(outletId),
    tasksOpen: tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length,
    tasksDone: done,
    taskCompletion: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    complaintsOpen: complaints.filter((c) => c.status !== "close").length,
    eventsRunning: events.filter((e) => e.status === "running").length,
    tasks,
    events,
    hygieneAudits,
    complaints,
    hospitalityAssessments,
  };
}

/* ---------------- Reports: month-over-month comparison ---------------- */
export interface MetricCompare {
  cur: number;
  prev: number;
  delta: number;
}

/**
 * Pembanding untuk SKOR AUDIT. Bentuknya sama dengan `MetricCompare`, tipenya
 * tidak: jumlah komplain dan task selalu terhitung, skor audit belum tentu ada.
 * Dipisah supaya kolom yang memang selalu berangka tidak ikut dipaksa
 * diperiksa null di setiap pembacanya.
 *
 * `delta` null ketika salah satu sisinya tidak diketahui — perubahan terhadap
 * sesuatu yang tidak terukur tidak bisa dihitung, dan 0% akan terbaca "stabil".
 */
export interface SkorCompare {
  cur: number | null;
  prev: number | null;
  delta: number | null;
}

export interface ReportData {
  hospitality: SkorCompare;
  hygiene: SkorCompare;
  complaintsReceived: MetricCompare;
  complaintsResolved: MetricCompare;
  tasksCompleted: MetricCompare;
  perOutlet: {
    name: string;
    code: string;
    /** Seluruh skor di bawah ini `null` bila jendelanya tidak punya bukti audit. */
    hospCur: number | null;
    hospPrev: number | null;
    hygCur: number | null;
    hygPrev: number | null;
  }[];
}

/** Current window vs previous equal window across a set of outlets (default 30 days, ending now). */
export function reportPeriodCompare(outletIds: string[], days = 30, endMs = NOW()): ReportData {
  const ids = new Set(outletIds);
  const win = days * 86_400_000;
  const end = endMs;
  const curStart = end - win;
  const prevStart = end - 2 * win;
  const inW = (t: number, s: number, e: number) => t >= s && t < e;

  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId));
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId));
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const tasks = SEED.tasks.filter((t) => t.outletId !== null && ids.has(t.outletId));

  const mc = (cur: number, prev: number): MetricCompare => ({ cur, prev, delta: pctDelta(cur, prev) });
  // Delta skor hanya lahir kalau KEDUA sisinya terukur.
  const sc = (cur: number | null, prev: number | null): SkorCompare => ({
    cur,
    prev,
    delta: cur === null || prev === null ? null : pctDelta(cur, prev),
  });
  const avgWin = (recs: { date: string; v: number }[], s: number, e: number) =>
    // Rata-rata SKOR di sebuah jendela: tanpa satu pun audit di dalamnya
    // hasilnya null — jendela itu tidak punya bukti, bukan bernilai nol.
    rataAudit(recs.filter((r) => inW(+new Date(r.date), s, e)).map((r) => r.v));

  const hospRecs = hosp.map((h) => ({ date: h.date, v: h.overallScore }));
  const hygRecs = hyg.map((h) => ({ date: h.date, v: h.hygieneScore }));

  const perOutlet = outletIds
    .map((id) => getOutlet(id))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map((o) => {
      const h = hosp.filter((x) => x.outletId === o.id).map((x) => ({ date: x.date, v: x.overallScore }));
      const g = hyg.filter((x) => x.outletId === o.id).map((x) => ({ date: x.date, v: x.hygieneScore }));
      return {
        name: o.name,
        code: o.code,
        // `??`, BUKAN `||`. Dengan `||` outlet yang jendela ini benar-benar
        // dinilai 0 dianggap tidak punya data dan diam-diam diganti skor
        // sepanjang masanya - angka periode lain yang tampil sebagai angka
        // periode ini. Yang boleh memicu cadangan hanya ketiadaan bukti.
        hospCur: avgWin(h, curStart, end) ?? hospitalityScoreFor(o.id),
        hospPrev: avgWin(h, prevStart, curStart),
        hygCur: avgWin(g, curStart, end) ?? hygieneScoreFor(o.id),
        hygPrev: avgWin(g, prevStart, curStart),
      };
    });

  return {
    hospitality: sc(avgWin(hospRecs, curStart, end) ?? rataAudit(hospRecs.map((r) => r.v)), avgWin(hospRecs, prevStart, curStart)),
    hygiene: sc(avgWin(hygRecs, curStart, end) ?? rataAudit(hygRecs.map((r) => r.v)), avgWin(hygRecs, prevStart, curStart)),
    complaintsReceived: mc(
      comp.filter((c) => inW(+new Date(c.createdAt), curStart, end)).length,
      comp.filter((c) => inW(+new Date(c.createdAt), prevStart, curStart)).length,
    ),
    complaintsResolved: mc(
      comp.filter((c) => c.closedAt && inW(+new Date(c.closedAt), curStart, end)).length,
      comp.filter((c) => c.closedAt && inW(+new Date(c.closedAt), prevStart, curStart)).length,
    ),
    tasksCompleted: mc(
      tasks.filter((t) => t.completionDate && inW(+new Date(t.completionDate), curStart, end)).length,
      tasks.filter((t) => t.completionDate && inW(+new Date(t.completionDate), prevStart, curStart)).length,
    ),
    perOutlet,
  };
}

/* ---------------- Reports: aggregation over a set of outlets ---------------- */
export interface OutletsAggregate {
  outlets: number;
  /** `null` = tak satu pun outlet dalam cakupan ini punya audit hospitality. */
  hospitality: number | null;
  /** `null` = tak satu pun outlet dalam cakupan ini punya audit hygiene. */
  hygiene: number | null;
  tasksTotal: number;
  tasksDone: number;
  taskCompletion: number;
  complaintsTotal: number;
  complaintsOpen: number;
  complaintsClosed: number;
  resolution: number;
  eventsTotal: number;
  eventsRunning: number;
  totalBudget: number;
}

export function aggregateOutlets(outletIds: string[]): OutletsAggregate {
  const ids = new Set(outletIds);
  const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => h.overallScore);
  const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => h.hygieneScore);
  const tasks = SEED.tasks.filter((t) => t.outletId !== null && ids.has(t.outletId));
  const tasksDone = tasks.filter((t) => t.status === "done").length;
  const comp = SEED.complaints.filter((c) => ids.has(c.outletId));
  const closed = comp.filter((c) => c.status === "close").length;
  const events = SEED.events.filter((e) => ids.has(e.outletId));
  return {
    outlets: ids.size,
    hospitality: rataAudit(hosp),
    hygiene: rataAudit(hyg),
    tasksTotal: tasks.length,
    tasksDone,
    taskCompletion: tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0,
    complaintsTotal: comp.length,
    complaintsOpen: comp.length - closed,
    complaintsClosed: closed,
    resolution: comp.length ? Math.round((closed / comp.length) * 100) : 0,
    eventsTotal: events.length,
    eventsRunning: events.filter((e) => e.status === "running").length,
    totalBudget: events.reduce((a, b) => a + b.budget, 0),
  };
}

/** Per-outlet rows (scoped) for report listings. */
export function outletReportRows(user: UserProfile) {
  return visibleOutlets(user).map((o) => ({
    outlet: o,
    areaName: areaName(o.areaId),
    hospitality: hospitalityScoreFor(o.id),
    hygiene: hygieneScoreFor(o.id),
  }));
}

/** Area coordinators visible to the user, with their assigned-outlet aggregate. */
export function coordinatorReportRows(user: UserProfile) {
  const visibleIds = new Set(visibleOutlets(user).map((o) => o.id));
  return SEED.users
    .filter((u) => u.role === "area_coordinator")
    .map((c) => {
      const outletIds = (c.outletIds ?? []).filter((id) => visibleIds.has(id));
      return { coordinator: c, outletIds, agg: aggregateOutlets(outletIds) };
    })
    .filter((r) => r.outletIds.length > 0);
}

/** Areas visible to the user, with aggregate. */
export function areaReportRows(user: UserProfile) {
  const visible = visibleOutlets(user);
  const byArea = new Map<string, string[]>();
  for (const o of visible) byArea.set(o.areaId, [...(byArea.get(o.areaId) ?? []), o.id]);
  return [...byArea.entries()].map(([areaId, outletIds]) => ({
    area: getArea(areaId)!,
    outletIds,
    agg: aggregateOutlets(outletIds),
  }));
}

/* ---------------- Performance Metrics (monthly completion tracking) ---------------- */
export interface MonthPoint {
  label: string;
  value: number;
}

/* ---------------- Performance by coordinator area ---------------- */
export interface CoordinatorPerf {
  id: string;
  name: string;
  /** `null` = belum ada audit hospitality di outlet binaannya. */
  hospitality: number | null;
  /** `null` = belum ada audit hygiene di outlet binaannya. */
  hygiene: number | null;
  complaints: number;
}

/** One row per area coordinator (scoped to the given outlet ids). */
export function coordinatorPerformance(outletIds: string[]): CoordinatorPerf[] {
  const scope = new Set(outletIds);
  return SEED.users
    .filter((u) => u.role === "area_coordinator")
    .map((c) => ({ c, ids: new Set((c.outletIds ?? []).filter((id) => scope.has(id))) }))
    .filter(({ ids }) => ids.size > 0)
    .map(({ c, ids }) => {
      const hosp = SEED.hospitality.filter((h) => ids.has(h.outletId)).map((h) => h.overallScore);
      const hyg = SEED.hygiene.filter((h) => ids.has(h.outletId)).map((h) => h.hygieneScore);
      const complaints = SEED.complaints.filter(
        (c2) => ids.has(c2.outletId) && c2.status !== "close",
      ).length;
      return {
        id: c.id,
        name: c.name,
        hospitality: rataAudit(hosp),
        hygiene: rataAudit(hyg),
        complaints,
      };
    });
}

/* ---------------- Quality trend (hospitality vs hygiene over time) ---------------- */
export interface QualityPoint {
  label: string;
  hospitality: number;
  hygiene: number;
}
export interface QualitySeries {
  daily: QualityPoint[];
  weekly: QualityPoint[];
  monthly: QualityPoint[];
  yearly: QualityPoint[];
}

