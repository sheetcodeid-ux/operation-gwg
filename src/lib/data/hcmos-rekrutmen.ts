import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getOutlets } from "./store";
import type { HcScope } from "@/lib/hcmos/pillars";
import type { TahapKandidat } from "@/lib/hcmos/rekrutmen";

/** Rekrutmen & Onboarding — dibaca langsung dari basis data. */

export interface KandidatRow {
  id: string;
  nama: string;
  posisi: string | null;
  scope: HcScope;
  outletId: string | null;
  outletName: string | null;
  sumber: string | null;
  telepon: string | null;
  email: string | null;
  tahap: TahapKandidat;
  jadwalInterview: string | null;
  pewawancara: string | null;
  catatan: string | null;
}

export interface OnboardingRow {
  id: string;
  nama: string;
  posisi: string | null;
  scope: HcScope;
  outletId: string | null;
  outletName: string | null;
  tglMulai: string | null;
  mentor: string | null;
  ceklis: Record<string, boolean>;
  catatan: string | null;
}

const namaOutlet = () => new Map(getOutlets().map((o) => [o.id, o.name]));

export async function listKandidat(): Promise<KandidatRow[]> {
  if (!dbEnabled) return [];
  const nama = namaOutlet();
  const rows = await selectAll<Record<string, unknown>>("hc_candidates", (from, to) =>
    db()
      .from("hc_candidates")
      .select("id,nama,posisi,scope,outlet_id,sumber,telepon,email,tahap,jadwal_interview,pewawancara,catatan")
      .order("updated_at", { ascending: false })
      .range(from, to),
  );
  return rows.map((r) => ({
    id: String(r.id),
    nama: String(r.nama ?? ""),
    posisi: (r.posisi as string | null) ?? null,
    scope: ((r.scope as HcScope) ?? "manajemen") as HcScope,
    outletId: (r.outlet_id as string | null) ?? null,
    outletName: r.outlet_id ? (nama.get(String(r.outlet_id)) ?? null) : null,
    sumber: (r.sumber as string | null) ?? null,
    telepon: (r.telepon as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    tahap: ((r.tahap as TahapKandidat) ?? "baru") as TahapKandidat,
    jadwalInterview: (r.jadwal_interview as string | null) ?? null,
    pewawancara: (r.pewawancara as string | null) ?? null,
    catatan: (r.catatan as string | null) ?? null,
  }));
}

export async function listOnboarding(): Promise<OnboardingRow[]> {
  if (!dbEnabled) return [];
  const nama = namaOutlet();
  const rows = await selectAll<Record<string, unknown>>("hc_onboarding", (from, to) =>
    db()
      .from("hc_onboarding")
      .select("id,nama,posisi,scope,outlet_id,tgl_mulai,mentor,ceklis,catatan")
      .order("tgl_mulai", { ascending: false })
      .range(from, to),
  );
  return rows.map((r) => ({
    id: String(r.id),
    nama: String(r.nama ?? ""),
    posisi: (r.posisi as string | null) ?? null,
    scope: ((r.scope as HcScope) ?? "manajemen") as HcScope,
    outletId: (r.outlet_id as string | null) ?? null,
    outletName: r.outlet_id ? (nama.get(String(r.outlet_id)) ?? null) : null,
    tglMulai: (r.tgl_mulai as string | null) ?? null,
    mentor: (r.mentor as string | null) ?? null,
    ceklis: (r.ceklis as Record<string, boolean> | null) ?? {},
    catatan: (r.catatan as string | null) ?? null,
  }));
}

export interface SimpanKandidatInput {
  id?: string;
  nama: string;
  posisi: string;
  scope: HcScope;
  outletId: string;
  sumber: string;
  telepon: string;
  email: string;
  tahap: TahapKandidat;
  jadwalInterview: string;
  pewawancara: string;
  catatan: string;
}

const nol = (v: string) => (v.trim() === "" ? null : v.trim());

export async function simpanKandidat(input: SimpanKandidatInput, olehId: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const baris = {
    nama: input.nama.trim(),
    posisi: nol(input.posisi),
    scope: input.scope,
    outlet_id: nol(input.outletId),
    sumber: nol(input.sumber),
    telepon: nol(input.telepon),
    email: nol(input.email),
    tahap: input.tahap,
    jadwal_interview: nol(input.jadwalInterview),
    pewawancara: nol(input.pewawancara),
    catatan: nol(input.catatan),
    updated_at: new Date().toISOString(),
    updated_by: olehId,
  };
  const q = input.id
    ? db().from("hc_candidates").update(baris).eq("id", input.id)
    : db().from("hc_candidates").insert(baris);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function hapusKandidat(id: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const { error } = await db().from("hc_candidates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface SimpanOnboardingInput {
  id?: string;
  nama: string;
  posisi: string;
  scope: HcScope;
  outletId: string;
  tglMulai: string;
  mentor: string;
  ceklis: Record<string, boolean>;
  catatan: string;
}

export async function simpanOnboarding(input: SimpanOnboardingInput, olehId: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const baris = {
    nama: input.nama.trim(),
    posisi: nol(input.posisi),
    scope: input.scope,
    outlet_id: nol(input.outletId),
    tgl_mulai: nol(input.tglMulai),
    mentor: nol(input.mentor),
    ceklis: input.ceklis,
    catatan: nol(input.catatan),
    updated_at: new Date().toISOString(),
    updated_by: olehId,
  };
  const q = input.id
    ? db().from("hc_onboarding").update(baris).eq("id", input.id)
    : db().from("hc_onboarding").insert(baris);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function hapusOnboarding(id: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const { error } = await db().from("hc_onboarding").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
