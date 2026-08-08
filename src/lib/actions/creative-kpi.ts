"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import {
  getCreativeKpiBoard,
  getCreativeSettings,
  saveCreativeSettings,
  saveSosmedMetrics,
  type CreativeKpiBoard,
} from "@/lib/data/creative-kpi";
import { getUsers } from "@/lib/data/store";
import { mergeCreativeSettings, type CreativeKpiSettings, type SosmedMetrics } from "@/lib/creative-kpi";
import type { UserProfile } from "@/lib/types";

/**
 * Aksi KPI Creative — Social Media.
 *
 * Semua aksi mengambil sesi sendiri; tidak satu pun menerima id pengguna dari
 * argumen. Kalau menerima, siapa pun yang memanggil server bisa menyimpan angka
 * atas nama orang lain.
 */

const canSee = (u: UserProfile | null) => !!u && canReachMenu(u, "creative_kpi");

/**
 * Yang boleh MENGUBAH angka Instagram & pengaturan — bukan seluruh tim.
 *
 * Anggota tim melihat KPI-nya sendiri tapi tidak boleh mengetik angka yang
 * menentukan nilainya sendiri. Kalau boleh, angkanya berhenti berarti apa pun.
 *
 * Selain Super Admin: Head dari dua departemen yang menaungi kerja sosmed —
 * tim ini memang lintas departemen (Social Media & Digital Marketing ada di
 * Marketing Communication, Graphic Designer & Videography di Creative).
 */
const HEAD_DEPARTMENTS = ["Creative", "Marketing Communication"];

const canEdit = (u: UserProfile | null): u is UserProfile =>
  !!u &&
  canSee(u) &&
  (u.role === "super_admin" || (u.jabatan === "Head" && HEAD_DEPARTMENTS.includes(u.department ?? "")));

const validPeriod = (p: string) => /^\d{4}-\d{2}$/.test(p);

function revalidate() {
  revalidatePath("/creative/kpi");
  revalidatePath("/dashboard");
}

export async function getCreativeKpiBoardAction(period: string): Promise<CreativeKpiBoard | { error: string }> {
  const user = await getSessionUser();
  if (!canSee(user)) return { error: "Tidak punya akses." };
  if (!validPeriod(period)) return { error: "Periode tidak valid." };
  try {
    return await getCreativeKpiBoard(period);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memuat KPI." };
  }
}

export async function saveSosmedMetricsAction(
  period: string,
  metrics: SosmedMetrics,
): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!canEdit(user)) return { error: "Tidak berwenang mengubah angka Instagram." };
  if (!validPeriod(period)) return { error: "Periode tidak valid." };

  const values = Object.values(metrics);
  if (values.some((v) => !Number.isFinite(Number(v)))) return { error: "Semua angka harus berupa bilangan." };
  if (values.some((v) => Number(v) < 0)) return { error: "Angka tidak boleh negatif." };

  try {
    const res = await saveSosmedMetrics(period, metrics, user!.id);
    if (res.error) return { error: res.error };
    revalidate();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function saveCreativeSettingsAction(
  settings: CreativeKpiSettings,
): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!canEdit(user)) return { error: "Tidak berwenang mengubah pengaturan." };

  // Dibersihkan lebih dulu supaya bobot atau id asing dari klien tidak tersimpan.
  const clean = mergeCreativeSettings(settings);
  const known = new Set(getUsers().map((u) => u.id));
  clean.teamIds = clean.teamIds.filter((id) => known.has(id));

  try {
    const res = await saveCreativeSettings(clean);
    if (res.error) return { error: res.error };
    revalidate();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan pengaturan." };
  }
}

/** Kandidat anggota tim sosmed — dipakai pemilih di Pengaturan. */
export async function creativeTeamOptionsAction(): Promise<{ id: string; name: string; jabatan: string }[]> {
  const user = await getSessionUser();
  if (!canSee(user)) return [];
  return getUsers()
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, jabatan: u.jabatan ?? u.department ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Pengaturan saja — dipakai halaman lain tanpa menghitung seluruh papan. */
export async function creativeSettingsAction(): Promise<CreativeKpiSettings | null> {
  const user = await getSessionUser();
  if (!canSee(user)) return null;
  return getCreativeSettings();
}
