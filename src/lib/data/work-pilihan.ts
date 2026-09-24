import "server-only";

import { papanCommandCenter } from "./command-center";
import { getOutlets, getUsers } from "./store";
import { getUserDepartments } from "./user-departments";
import { canReachMenu, MENU_COMMAND_CENTER, MENU_WORK } from "@/lib/nav";
import { persempit } from "@/lib/ops/scope-v1";
import type { UserProfile } from "@/lib/types";

/**
 * PILIHAN UNTUK FORM WORK BARU — ORANG, DEPARTEMEN, DAN SIGNAL.
 *
 * ┌─ DUA KONTRAK CAKUPAN YANG BERBEDA, DAN TIDAK BOLEH TERTUKAR ─────────────┐
 * │                                                                          │
 * │   WORK     tidak dipersempit outlet. `works` tidak punya `outlet_id`,    │
 * │            dan satu Work bisa menangani Signal beberapa outlet (D3).     │
 * │            VIEW-nya akses menu ATAU pelaksana aktif (O-06 · OD-01 = A).  │
 * │                                                                          │
 * │   SIGNAL   DIPERSEMPIT outlet, persis seperti Command Center. Signal     │
 * │            korporat tidak punya `outlet_id` sehingga tidak pernah lewat  │
 * │            penyaring itu; gerbangnya `canReachMenu` (Z-01 · O10 = B).    │
 * │                                                                          │
 * │ `persempit()` karena itu dipakai di berkas ini — untuk daftar SIGNAL,    │
 * │ tidak pernah untuk Work. Menyamakan keduanya berarti salah satu kontrak  │
 * │ dilanggar, dan yang dilanggar tidak akan terlihat dari layar.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ INI BUKAN OTORISASI ────────────────────────────────────────────────────┐
 * │                                                                          │
 * │ Daftar di sini menentukan apa yang ENAK DIPILIH, bukan apa yang BOLEH.   │
 * │ `buatWorkAction` memeriksa izin pemanggilnya, dan `gwg_buat_work`        │
 * │ memvalidasi setiap id yang benar-benar dikirim. Menyempitkan daftar di   │
 * │ sini tidak menambah keamanan, dan melebarkannya tidak menguranginya.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * TIDAK MENULIS APA PUN.
 */

export interface Opsi {
  value: string;
  label: string;
}

export interface OpsiSignal {
  id: number;
  /** Baris yang terbaca orang: KPI, cakupan, periode, severity. */
  label: string;
  severity: string;
}

export interface PilihanWork {
  /** Kandidat Owner — aktif DAN boleh melihat Work (O-06). */
  owner: Opsi[];
  /** Kandidat pelaksana — aktif DAN punya departemen untuk di-snapshot. */
  pelaksana: Opsi[];
  /** Registry departemen yang berwenang (O-01): `user_departments`. */
  departemen: Opsi[];
  /** Signal yang boleh dilihat orang ini, dalam cakupan Signal — bukan Work. */
  signal: OpsiSignal[];
}

const nama = (u: UserProfile): string => (u.department ? `${u.name} · ${u.department}` : u.name);

/**
 * Kandidat Owner.
 *
 * O-06: "Menjadi OWNER — siapa pun yang punya akses VIEW Work, dan aktif."
 * Work yang baru belum punya pelaksana, jadi cabang "pelaksana aktif" dari
 * VIEW tidak berlaku pada saat pembuatan; yang tersisa akses menunya.
 */
export function kandidatOwner(semua: readonly UserProfile[] = getUsers()): Opsi[] {
  return semua
    .filter((u) => u.active && canReachMenu(u, MENU_WORK))
    .map((u) => ({ value: u.id, label: nama(u) }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/**
 * Kandidat pelaksana.
 *
 * TIDAK dibatasi peran: D4 mengizinkan pelaksana lintas departemen, dan tidak
 * ada keputusan mana pun yang mempersempitnya. Departemen wajib terisi karena
 * `gwg_buat_work` menolak snapshot departemen yang kosong — orang tanpa
 * departemen akan ditolak basis data, dan menawarkannya di sini hanya
 * memindahkan penolakan itu ke tempat yang lebih membingungkan.
 */
export function kandidatPelaksana(semua: readonly UserProfile[] = getUsers()): Opsi[] {
  return semua
    .filter((u) => u.active && (u.department ?? "").trim() !== "")
    .map((u) => ({ value: u.id, label: nama(u) }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

/** Satu baris Signal sebagaimana terbaca di daftar pilihan. */
export function labelSignal(s: {
  kpiDefinitionId: string;
  cakupan: string;
  outletNama: string | null;
  periode: string;
  severity: string;
}): string {
  const tempat = s.cakupan === "korporat" ? "korporat" : (s.outletNama ?? "—");
  return `#${s.kpiDefinitionId} · ${tempat} · ${s.periode} · ${s.severity}`;
}

/**
 * Seluruh pilihan yang dibutuhkan form, dalam SATU pembacaan.
 *
 * Empat sumber, empat kali tarik — bukan satu kueri per baris:
 *   orang       `getUsers()`            dari memori, nol kueri
 *   departemen  `getUserDepartments()`  satu kueri
 *   Signal      `papanCommandCenter()`  pembaca yang sudah ada, ber-`selectAll`
 *   outlet      `getOutlets()`          dari memori, nol kueri
 */
export async function pilihanWork(user: UserProfile, pada?: number): Promise<PilihanWork> {
  const semuaOrang = getUsers();

  const [departemen, papan] = await Promise.all([
    getUserDepartments(),
    papanCommandCenter({
      periode: null,
      // Cakupan SIGNAL — dan hanya Signal. Lihat catatan kepala berkas.
      outletIds: persempit(user, getOutlets()).ids,
      sertakanKorporat: canReachMenu(user, MENU_COMMAND_CENTER),
      pada,
    }),
  ]);

  const signal = [...papan.kelompok.flatMap((k) => k.outlet.flatMap((o) => o.signal)), ...papan.korporat].map((s) => ({
    id: s.id,
    label: labelSignal(s),
    severity: s.severity,
  }));

  return {
    owner: kandidatOwner(semuaOrang),
    pelaksana: kandidatPelaksana(semuaOrang),
    departemen: departemen
      .map((d) => ({ value: d.name, label: d.name }))
      .sort((a, b) => a.label.localeCompare(b.label, "id")),
    signal,
  };
}
