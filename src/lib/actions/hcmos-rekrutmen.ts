"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import {
  hapusKandidat,
  hapusOnboarding,
  simpanKandidat,
  simpanOnboarding,
  type SimpanKandidatInput,
  type SimpanOnboardingInput,
} from "@/lib/data/hcmos-rekrutmen";
import type { UserProfile } from "@/lib/types";

/**
 * Data kandidat memuat nomor telepon dan email orang yang bahkan belum bekerja
 * di sini. Karena itu hanya Human Capital dan Super Admin yang boleh
 * membukanya — bukan semua orang yang bisa membuka HC-MOS.
 */
const bolehHc = (u: UserProfile | null) =>
  !!u && (u.role === "super_admin" || u.role === "legal" || u.department === "Human Capital") && canReachMenu(u, "hcmos");

function segarkan() {
  revalidatePath("/hc-mos/rekrutmen");
  revalidatePath("/hc-mos");
}

export async function simpanKandidatAction(input: SimpanKandidatInput): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehHc(user)) return { error: "Hanya Human Capital yang boleh mengelola kandidat." };
  if (!input.nama.trim()) return { error: "Nama kandidat wajib diisi." };
  try {
    await simpanKandidat(input, user!.id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function hapusKandidatAction(id: string): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehHc(user)) return { error: "Hanya Human Capital yang boleh menghapus kandidat." };
  try {
    await hapusKandidat(id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
}

export async function simpanOnboardingAction(input: SimpanOnboardingInput): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehHc(user)) return { error: "Hanya Human Capital yang boleh mengelola onboarding." };
  if (!input.nama.trim()) return { error: "Nama karyawan wajib diisi." };
  try {
    await simpanOnboarding(input, user!.id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function hapusOnboardingAction(id: string): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehHc(user)) return { error: "Hanya Human Capital yang boleh menghapus data onboarding." };
  try {
    await hapusOnboarding(id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
}
