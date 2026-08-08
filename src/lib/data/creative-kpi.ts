import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getUser } from "./store";
import {
  CREATIVE_KPI_INDICATORS,
  DEFAULT_CREATIVE_SETTINGS,
  EMPTY_METRICS,
  creativeAktual,
  creativeCapaian,
  classifyContent,
  creativeTotalScore,
  growthTarget,
  mergeCreativeSettings,
  metricValue,
  previousPeriod,
  type CreativeKpiRow,
  type CreativeKpiSettings,
  type SosmedMetrics,
} from "@/lib/creative-kpi";

/**
 * Perhitungan KPI Creative — Social Media.
 *
 * Jumlah konten dan Kecepatan & Ketepatan dibaca dari `hc_requests` (Pengajuan
 * Design) yang sudah ada; angka Instagram dari `creative_sosmed_metrics`.
 *
 * Yang dibaca dari basis data hanya kolom yang dipakai, dan hanya untuk bulan
 * yang diminta — bukan seluruh tabel lalu disaring di memori.
 */

/** Batas bulan "YYYY-MM" sebagai rentang tanggal setengah terbuka. */
export function periodBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

interface DesignRow {
  id: string;
  design_type: string | null;
  planned_date: string | null;
  completed_at: string | null;
  assignee_id: string | null;
}

/**
 * Pengajuan design SOSMED yang selesai pada satu bulan.
 *
 * Disaring di basis data pada `completed_at`, bukan `created_at`: konten yang
 * diminta bulan lalu tapi baru rampung bulan ini adalah hasil kerja bulan ini.
 */
async function completedContent(period: string): Promise<DesignRow[]> {
  if (!dbEnabled) return [];
  const { from, to } = periodBounds(period);
  const rows = await selectAll<DesignRow>("creative_kpi_design", (a, b) =>
    db()
      .from("hc_requests")
      .select("id,design_type,planned_date,completed_at,assignee_id")
      .eq("kind", "design")
      .eq("status", "terlaksana")
      .gte("completed_at", from)
      .lt("completed_at", to)
      .order("completed_at")
      .order("id")
      .range(a, b),
  );
  // Penyaringan jenis dilakukan DI SINI, bukan di kueri: `design_type` adalah
  // teks bebas (form punya pilihan "Lainnya"), jadi pencocokan persis di basis
  // data akan melewatkan "IG Story" dan sejenisnya.
  return rows.filter((r) => classifyContent(r.design_type) !== null);
}

/* ─────────────────────────── pengaturan ─────────────────────────── */

export async function getCreativeSettings(): Promise<CreativeKpiSettings> {
  if (!dbEnabled) return DEFAULT_CREATIVE_SETTINGS;
  try {
    const { data } = await db().from("creative_kpi_settings").select("data").eq("id", "default").maybeSingle();
    return mergeCreativeSettings((data as { data: unknown } | null)?.data);
  } catch {
    return DEFAULT_CREATIVE_SETTINGS;
  }
}

export async function saveCreativeSettings(settings: CreativeKpiSettings): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Basis data belum aktif." };
  const clean = mergeCreativeSettings(settings);
  const { error } = await db()
    .from("creative_kpi_settings")
    .upsert({ id: "default", data: clean, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return error ? { error: error.message } : {};
}

/* ─────────────────────────── angka Instagram ─────────────────────────── */

const metricsFromRow = (r: Record<string, unknown> | null | undefined): SosmedMetrics =>
  r
    ? {
        likes: Number(r.likes ?? 0),
        comments: Number(r.comments ?? 0),
        shares: Number(r.shares ?? 0),
        saves: Number(r.saves ?? 0),
        followerGrowth: Number(r.follower_growth ?? 0),
        views: Number(r.views ?? 0),
        profileVisits: Number(r.profile_visits ?? 0),
      }
    : { ...EMPTY_METRICS };

/** Angka Instagram dua bulan sekaligus: bulan berjalan + baseline sebelumnya. */
async function metricsPair(period: string): Promise<{ now: SosmedMetrics; prev: SosmedMetrics | null }> {
  if (!dbEnabled) return { now: { ...EMPTY_METRICS }, prev: null };
  const prevPeriod = previousPeriod(period);
  const { data } = await db()
    .from("creative_sosmed_metrics")
    .select("*")
    .in("period", [period, prevPeriod])
    .eq("brand", "");
  const rows = (data ?? []) as Record<string, unknown>[];
  const nowRow = rows.find((r) => r.period === period);
  const prevRow = rows.find((r) => r.period === prevPeriod);
  // `prev: null` (baris belum ada) BEDA dengan baris berisi nol: yang pertama
  // berarti "belum ada baseline, jangan dinilai", yang kedua berarti "bulan lalu
  // memang nol". Membedakan keduanya menentukan apakah indikatornya ikut skor.
  return { now: metricsFromRow(nowRow), prev: prevRow ? metricsFromRow(prevRow) : null };
}

export async function saveSosmedMetrics(
  period: string,
  m: SosmedMetrics,
  userId: string,
): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Basis data belum aktif." };
  const n = (v: number) => Math.max(0, Math.round(Number(v) || 0));
  const { error } = await db().from("creative_sosmed_metrics").upsert(
    {
      period,
      brand: "",
      likes: n(m.likes),
      comments: n(m.comments),
      shares: n(m.shares),
      saves: n(m.saves),
      follower_growth: n(m.followerGrowth),
      views: n(m.views),
      profile_visits: n(m.profileVisits),
      source: "manual",
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period,brand" },
  );
  return error ? { error: error.message } : {};
}

/* ─────────────────────────── papan KPI ─────────────────────────── */

/** Sumbangan satu orang pada bulan itu. */
export interface CreativeMemberRow {
  userId: string;
  name: string;
  post: number;
  reels: number;
  story: number;
  total: number;
  onTime: number;
  late: number;
  noDeadline: number;
  onTimePct: number;
}

export interface CreativeKpiBoard {
  period: string;
  rows: CreativeKpiRow[];
  score: number;
  metrics: SosmedMetrics;
  /** Bulan sebelumnya belum terisi — empat indikator Instagram tidak dinilai. */
  hasBaseline: boolean;
  members: CreativeMemberRow[];
  /**
   * Pengajuan selesai yang tidak punya deadline.
   *
   * Ditampilkan terpisah karena konten tanpa deadline TIDAK bisa dinilai tepat
   * waktu — kalau diam-diam dihitung sebagai tepat waktu, cara termudah
   * mendapat nilai 100 adalah dengan tidak pernah mengisi deadline.
   */
  withoutDeadline: number;
  settings: CreativeKpiSettings;
}

export async function getCreativeKpiBoard(period: string): Promise<CreativeKpiBoard> {
  const [settings, content, { now, prev }] = await Promise.all([
    getCreativeSettings(),
    completedContent(period),
    metricsPair(period),
  ]);

  // Daftar tim kosong berarti "semua PIC yang mengerjakan" — supaya KPI tetap
  // ada isinya sebelum sempat diatur.
  const team = new Set(settings.teamIds);
  const mine = team.size > 0 ? content.filter((r) => r.assignee_id && team.has(r.assignee_id)) : content;

  const countOf = (key: string) => mine.filter((r) => classifyContent(r.design_type) === key).length;

  // Tepat waktu = selesai pada atau sebelum deadline. Yang tanpa deadline
  // dikeluarkan dari pembagi, bukan dianggap tepat waktu.
  const judged = mine.filter((r) => r.planned_date && r.completed_at);
  const onTime = judged.filter((r) => onOrBefore(r.completed_at!, r.planned_date!)).length;
  const onTimePct = judged.length > 0 ? Math.round((onTime / judged.length) * 10000) / 100 : 0;

  const rows: CreativeKpiRow[] = CREATIVE_KPI_INDICATORS.map((indicator) => {
    const weight = settings.weights[indicator.key] ?? 0;

    let target: number;
    let realisasi: number;
    let scored = true;

    if (indicator.source === "design") {
      target = indicator.fixedTarget ?? 0;
      realisasi = indicator.key === "kecepatan" ? onTimePct : countOf(indicator.key);
      // Bulan tanpa satu pun konten berdeadline: tidak ada yang bisa dinilai
      // tepat waktu, jadi jangan beri nol yang menyesatkan.
      if (indicator.key === "kecepatan" && judged.length === 0) scored = false;
    } else {
      realisasi = metricValue(indicator.key, now);
      target = prev ? growthTarget(metricValue(indicator.key, prev)) : 0;
      scored = prev !== null;
    }

    const capaian = scored ? creativeCapaian(target, realisasi) : 0;
    return { indicator, weight, target, realisasi, capaian, aktual: creativeAktual(weight, capaian), scored };
  });

  return {
    period,
    rows,
    score: creativeTotalScore(rows),
    metrics: now,
    hasBaseline: prev !== null,
    members: membersOf(mine),
    withoutDeadline: mine.length - judged.length,
    settings,
  };
}

/** Selesai pada atau sebelum deadline — dibandingkan per TANGGAL, bukan per jam. */
function onOrBefore(completedAt: string, plannedDate: string): boolean {
  // `planned_date` tersimpan sebagai tanggal ("2026-08-20") tanpa jam. Kalau
  // dibandingkan mentah sebagai waktu, ia berarti tengah malam — sehingga
  // pekerjaan yang selesai pada hari deadline itu sendiri terhitung TERLAMBAT.
  return completedAt.slice(0, 10) <= plannedDate.slice(0, 10);
}

function membersOf(rows: DesignRow[]): CreativeMemberRow[] {
  const map = new Map<string, CreativeMemberRow>();
  for (const r of rows) {
    const id = r.assignee_id ?? "";
    if (!id) continue;
    const m =
      map.get(id) ??
      map
        .set(id, {
          userId: id,
          name: getUser(id)?.name ?? "—",
          post: 0,
          reels: 0,
          story: 0,
          total: 0,
          onTime: 0,
          late: 0,
          noDeadline: 0,
          onTimePct: 0,
        })
        .get(id)!;

    const kind = classifyContent(r.design_type);
    if (kind === "konten_post") m.post++;
    else if (kind === "konten_reels") m.reels++;
    else if (kind === "konten_story") m.story++;
    m.total++;

    if (!r.planned_date || !r.completed_at) m.noDeadline++;
    else if (onOrBefore(r.completed_at, r.planned_date)) m.onTime++;
    else m.late++;
  }

  for (const m of map.values()) {
    const judged = m.onTime + m.late;
    m.onTimePct = judged > 0 ? Math.round((m.onTime / judged) * 10000) / 100 : 0;
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
