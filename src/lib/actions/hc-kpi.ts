"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { db, dbEnabled } from "@/lib/data/db";
import { canReachMenu } from "@/lib/nav";
import { persistMessage } from "@/lib/data/persist";
import { listKpiEntries, saveKpiEntry, kpiTrend } from "@/lib/data/hc-kpi";
import { r2Enabled, r2Put, R2_PREFIX } from "@/lib/storage/r2";
import { buildRows, kpiPeriod, totalScore, type KpiAttachment, type KpiEntry, type KpiKey } from "@/lib/hc-kpi";
import type { UserProfile } from "@/lib/types";

/** KPI HC dikelola oleh siapa pun yang boleh membuka menu KPI Human Capital. */
const canManage = (u: UserProfile | null) => !!u && canReachMenu(u, "hc_kpi");

const MAX_BYTES = 10 * 1024 * 1024;

/** Unggah satu bukti pendukung (PDF / gambar) untuk indikator KPI. */
export async function uploadKpiEvidenceAction(formData: FormData): Promise<{ path?: string; name?: string; error?: string }> {
  const user = await getSessionUser();
  if (!canManage(user)) return { error: "Tidak punya akses." };
  if (!dbEnabled) return { error: "Storage belum aktif." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Tidak ada berkas." };
  if (file.size > MAX_BYTES) return { error: `Berkas "${file.name}" melebihi 10 MB.` };
  const ok = file.type === "application/pdf" || file.type.startsWith("image/");
  if (!ok) return { error: `"${file.name}" harus PDF atau gambar (JPG/PNG).` };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const name = `kpi/${user!.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  if (r2Enabled()) {
    try {
      const key = `hc/${name}`;
      await r2Put(key, await file.arrayBuffer(), file.type || "application/octet-stream");
      return { path: `${R2_PREFIX}${key}`, name: file.name };
    } catch (e) {
      console.error("[hc-kpi] R2 upload gagal, fallback ke Supabase:", e);
    }
  }
  const { error } = await db().storage.from("system-attachments").upload(`hc/${name}`, file, { contentType: file.type });
  if (error) return { error: `Upload gagal: ${error.message}` };
  return { path: `hc/${name}`, name: file.name };
}

export interface KpiBoard {
  period: string;
  entries: KpiEntry[];
  /** Total skor beberapa periode terakhir (untuk chart tren). */
  trend: { period: string; score: number }[];
}

/** Data satu periode + tren 6 bulan terakhir. */
export async function getKpiBoardAction(period: string): Promise<KpiBoard | { error: string }> {
  const user = await getSessionUser();
  if (!canManage(user)) return { error: "Tidak punya akses." };
  try {
    const entries = await listKpiEntries(period);

    // Enam periode terakhir sampai bulan yang dipilih.
    const [y, m] = period.split("-").map(Number);
    const periods: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      periods.push(kpiPeriod(d.getFullYear(), d.getMonth()));
    }
    const byPeriod = await kpiTrend(periods);
    const trend = periods.map((p) => {
      const map = Object.fromEntries((byPeriod[p] ?? []).map((e) => [e.key, e])) as Partial<Record<KpiKey, KpiEntry>>;
      return { period: p, score: totalScore(buildRows(map)) };
    });

    return { period, entries, trend };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

export interface SaveKpiActionInput {
  period: string;
  key: KpiKey;
  target: number;
  realisasi: number;
  note: string;
  attachments: KpiAttachment[];
}

export async function saveKpiEntryAction(input: SaveKpiActionInput): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!canManage(user)) return { error: "Tidak punya akses." };
  if (!/^\d{4}-\d{2}$/.test(input.period)) return { error: "Periode tidak valid." };
  if (input.target < 0 || input.realisasi < 0) return { error: "Target & realisasi tidak boleh negatif." };
  try {
    const res = await saveKpiEntry({ ...input, updatedBy: user!.id });
    if (res.error) return { error: res.error };
    revalidatePath("/hc/kpi");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
