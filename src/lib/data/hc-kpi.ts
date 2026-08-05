import "server-only";

import { db, dbEnabled } from "./db";
import { userName } from "./store";
import { isR2Key, presignGet, r2KeyOf } from "@/lib/storage/r2";
import type { KpiAttachment, KpiEntry, KpiKey } from "@/lib/hc-kpi";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * KPI Human Capital — satu baris per (periode, indikator). Bukti pendukung
 * disimpan sebagai path storage dan ditandatangani saat dibaca.
 */

const SIGN_TTL = 60 * 60;

const memEntries = new Map<string, KpiEntry>(); // key `${period}|${indicator}`

const rawAttachments = (v: any): KpiAttachment[] =>
  (Array.isArray(v) ? v : [])
    .filter((a: any) => a && a.path && a.name)
    .map((a: any) => ({ path: String(a.path), name: String(a.name) }));

/** Ubah path storage menjadi URL bertanda tangan (R2 utama, Supabase cadangan). */
async function signAttachments(entries: KpiEntry[]): Promise<void> {
  const paths = [...new Set(entries.flatMap((e) => e.attachments.map((a) => a.path).filter((p): p is string => !!p)))];
  if (paths.length === 0) return;
  const map = new Map<string, string>();
  const sb: string[] = [];
  for (const p of paths) {
    if (isR2Key(p)) {
      try {
        const url = await presignGet(r2KeyOf(p), SIGN_TTL);
        if (url) map.set(p, url);
      } catch {
        /* lewati berkas ini */
      }
    } else sb.push(p);
  }
  if (dbEnabled && sb.length > 0) {
    try {
      const { data } = await db().storage.from("system-attachments").createSignedUrls(sb, SIGN_TTL);
      for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
    } catch {
      /* signing tidak tersedia */
    }
  }
  for (const e of entries) for (const a of e.attachments) if (a.path) a.url = map.get(a.path);
}

export async function listKpiEntries(period: string): Promise<KpiEntry[]> {
  let rows: KpiEntry[];
  if (!dbEnabled) {
    rows = [...memEntries.entries()]
      .filter(([k]) => k.startsWith(`${period}|`))
      .map(([, v]) => ({ ...v, attachments: [...v.attachments] }));
  } else {
    const { data } = await db().from("hc_kpi_entries").select("*").eq("period", period);
    rows = ((data ?? []) as any[]).map((r) => ({
      key: r.indicator_key as KpiKey,
      target: Number(r.target ?? 0),
      realisasi: Number(r.realisasi ?? 0),
      note: r.note ?? "",
      attachments: rawAttachments(r.attachments),
      updatedByName: r.updated_by ? userName(r.updated_by) : null,
      updatedAt: r.updated_at ?? null,
    }));
  }
  await signAttachments(rows);
  return rows;
}

export interface SaveKpiInput {
  period: string;
  key: KpiKey;
  target: number;
  realisasi: number;
  note: string;
  attachments: KpiAttachment[];
  updatedBy: string;
}

export async function saveKpiEntry(input: SaveKpiInput): Promise<{ error?: string }> {
  const clean: KpiEntry = {
    key: input.key,
    target: Number.isFinite(input.target) ? input.target : 0,
    realisasi: Number.isFinite(input.realisasi) ? input.realisasi : 0,
    note: (input.note ?? "").slice(0, 2000),
    attachments: input.attachments.filter((a) => a?.path && a?.name).slice(0, 10),
  };
  if (!dbEnabled) {
    memEntries.set(`${input.period}|${input.key}`, clean);
    return {};
  }
  const { error } = await db().from("hc_kpi_entries").upsert(
    {
      period: input.period,
      indicator_key: clean.key,
      target: clean.target,
      realisasi: clean.realisasi,
      note: clean.note,
      attachments: clean.attachments.map((a) => ({ path: a.path, name: a.name })),
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period,indicator_key" },
  );
  return error ? { error: error.message } : {};
}

/** Periode yang sudah punya data — untuk tren beberapa bulan terakhir. */
export async function listKpiPeriods(): Promise<string[]> {
  if (!dbEnabled) return [...new Set([...memEntries.keys()].map((k) => k.split("|")[0]))].sort();
  const { data } = await db().from("hc_kpi_entries").select("period");
  return [...new Set(((data ?? []) as { period: string }[]).map((r) => r.period))].sort();
}

/** Total realisasi/target per periode — dipakai chart tren. */
export async function kpiTrend(periods: string[]): Promise<Record<string, KpiEntry[]>> {
  if (periods.length === 0) return {};
  const out: Record<string, KpiEntry[]> = {};
  if (!dbEnabled) {
    for (const p of periods) out[p] = await listKpiEntries(p);
    return out;
  }
  const { data } = await db().from("hc_kpi_entries").select("*").in("period", periods);
  for (const p of periods) out[p] = [];
  for (const r of (data ?? []) as any[]) {
    (out[r.period] ??= []).push({
      key: r.indicator_key as KpiKey,
      target: Number(r.target ?? 0),
      realisasi: Number(r.realisasi ?? 0),
      note: "",
      attachments: [],
    });
  }
  return out;
}
