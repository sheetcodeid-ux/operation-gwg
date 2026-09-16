import { scopeOutlets } from "@/lib/rbac";
import { bidangOrang } from "./bidang";
import type { Outlet, UserProfile } from "@/lib/types";

/**
 * SATU PINTU CAKUPAN OUTLET UNTUK OPERATIONAL V.1.
 *
 * Bukan RBAC baru. Bukan hierarki baru. Yang memutuskan tetap aturan yang sudah
 * berlaku — `scopeOutlets` di `@/lib/rbac` dan `bidangOrang` di `./bidang`.
 * Berkas ini cuma menyatukan keduanya jadi satu panggilan, supaya seluruh fitur
 * V.1 menanyakan cakupan ke tempat yang sama.
 *
 * KENAPA PERLU SATU PINTU, padahal aturannya sudah ada.
 *
 * Basis data ini punya RLS aktif di 110 tabel dan NOL policy; data layer
 * memakai service role, jadi setiap pembacaan mem-bypass RLS
 * (`src/lib/data/db.ts`). Artinya tidak ada jaring pengaman di tingkat basis
 * data sama sekali: satu query V.1 yang lupa menyaring outlet akan
 * mengembalikan omzet seluruh perusahaan kepada siapa pun yang memanggilnya,
 * dan tidak ada apa pun di bawahnya yang akan menolak.
 *
 * Selama keadaan itu berlaku, satu-satunya pengganti jaring itu adalah
 * disiplin: satu fungsi yang dipakai semua, yang bisa dibaca sekali dan diuji
 * sekali. Tersebar di puluhan pemanggil, yang terlewat satu tidak akan pernah
 * ketahuan dari layar.
 *
 * MURNI — tanpa basis data. Daftar outlet dan pengguna disuntikkan pemanggil,
 * jadi bisa diuji tanpa Supabase.
 */

/** Alasan cakupan seseorang jadi seperti itu — ikut dikembalikan supaya bisa
 *  ditampilkan dan bisa diuji. */
export type AlasanCakupan =
  /** Peran kantor pusat: melihat semuanya menurut `hasGlobalScope`. */
  | "global"
  /** Dibatasi outlet yang ditugaskan padanya (`users.outlet_ids`). */
  | "ditugaskan"
  /** Supervisor: outlet yang disupervisinya. */
  | "supervisi"
  /** Coordinator Area lama: lewat `areas`, bukan penugasan. */
  | "area"
  /** Tidak dibatasi apa pun oleh aturan existing — lihat catatan di bawah. */
  | "tanpa-batas";

export interface Cakupan {
  /** Outlet yang boleh dibaca orang ini. */
  outlet: Outlet[];
  /** Id-nya saja — bentuk yang paling sering dipakai penyaring query. */
  ids: string[];
  /** Cabang ESB milik outlet itu. Outlet tanpa cabang tidak menyumbang apa pun. */
  cabang: string[];
  alasan: AlasanCakupan;
  /** Benar bila cakupannya SELURUH outlet yang diberikan. */
  seluruhnya: boolean;
}

/**
 * ATURAN EXISTING YANG DIIKUTI APA ADANYA, TERMASUK YANG MENGEJUTKAN.
 *
 * Dibaca dari `scopeOutlets` (`src/lib/rbac.ts:95-107`), bukan dari nama peran:
 *
 *  1. `super_admin`, `data_operation`, `admin_operation` → seluruh outlet.
 *  2. SIAPA PUN yang punya `outletIds` → hanya outlet itu, apa pun perannya.
 *     Pencocokannya pada `o.id` ATAU `o.code`, karena penugasan lama menyimpan
 *     kode POS.
 *  3. `supervisor` tanpa penugasan → outlet yang `supervisorId`-nya dia.
 *  4. `area_coordinator` tanpa penugasan tapi punya `areaId` → outlet area itu.
 *  5. SISANYA → SELURUH OUTLET.
 *
 * Nomor 5 yang perlu disebut terang-terangan: `member`, `head_operation`, dan
 * `area_coordinator` yang belum ditugasi apa pun TIDAK dibatasi oleh
 * `scopeOutlets`. Itu memang keadaan yang berlaku hari ini, dan V.1 mengikutinya
 * — bukan karena baik, melainkan karena mengubahnya di sini berarti dua aturan
 * cakupan yang berbeda di satu aplikasi, dan yang kedua akan tampak seperti bug
 * pada halaman lama.
 *
 * Yang menahan mereka bukan `scopeOutlets` melainkan pintu menu
 * (`canReachMenu`) yang dijalankan lebih dulu di tiap halaman. Kalau V.1 kelak
 * memutuskan nomor 5 harus ditutup, itu perubahan kebijakan yang menyentuh
 * seluruh aplikasi — dicatat sebagai temuan, bukan diam-diam diperbaiki di
 * fondasi.
 */
export function cakupanOutlet(user: UserProfile, semua: readonly Outlet[]): Cakupan {
  const daftar = semua as Outlet[];
  const outlet = scopeOutlets(user, daftar);
  return {
    outlet,
    ids: outlet.map((o) => o.id),
    cabang: [...new Set(outlet.map((o) => o.esbBranchId).filter((b): b is string => !!b))],
    alasan: alasanCakupan(user, daftar),
    seluruhnya: outlet.length === daftar.length,
  };
}

function alasanCakupan(user: UserProfile, semua: Outlet[]): AlasanCakupan {
  // Urutannya HARUS sama dengan `scopeOutlets`; kalau tidak, alasan yang
  // ditampilkan bisa berbeda dari cakupan yang benar-benar diberikan.
  if (user.role === "super_admin" || user.role === "data_operation" || user.role === "admin_operation") return "global";
  if ((user.outletIds ?? []).length > 0) return "ditugaskan";
  if (user.role === "supervisor") return "supervisi";
  if (user.role === "area_coordinator" && user.areaId) return "area";
  void semua;
  return "tanpa-batas";
}

/**
 * Cakupan orang bidang Performance V.1 — Finance dan Marketing.
 *
 * Bedanya dari `cakupanOutlet`: wilayah mereka datang dari DEPARTEMEN, bukan
 * dari peran. Perannya `member`, sama dengan seluruh staf kantor, jadi
 * `scopeOutlets` melepas mereka lewat aturan nomor 5 di atas.
 *
 * Aturannya sudah ada di `./bidang` dan dipakai halaman Finance V.1 sejak
 * sebelum Operational V.1 — yang di sini cuma memanggilnya, supaya V.1 tidak
 * menuliskan versi keduanya.
 */
export function cakupanBidang(user: UserProfile, semua: readonly Outlet[]): Cakupan | null {
  if (!bidangOrang(user)) return null;
  return cakupanOutlet(user, semua);
}

/** Apakah orang ini boleh membaca satu outlet tertentu. */
export function bolehBacaOutlet(user: UserProfile, outletId: string, semua: readonly Outlet[]): boolean {
  return cakupanOutlet(user, semua).ids.includes(outletId);
}

/**
 * Persempit permintaan outlet dari peramban ke cakupan yang sah.
 *
 * `?area=` dan pilihan apa pun dari layar TIDAK boleh dipercaya. Yang diminta
 * disaring terhadap cakupan; yang di luar cakupan dibuang tanpa pesan — bukan
 * ditolak dengan galat, karena galat yang menyebut outlet orang lain sudah
 * membocorkan keberadaannya.
 *
 * Tanpa `diminta`, yang dikembalikan seluruh cakupannya.
 */
export function persempit(user: UserProfile, semua: readonly Outlet[], diminta?: readonly string[]): Cakupan {
  const penuh = cakupanOutlet(user, semua);
  if (!diminta || diminta.length === 0) return penuh;
  const boleh = new Set(penuh.ids);
  const outlet = penuh.outlet.filter((o) => diminta.includes(o.id) && boleh.has(o.id));
  return {
    outlet,
    ids: outlet.map((o) => o.id),
    cabang: [...new Set(outlet.map((o) => o.esbBranchId).filter((b): b is string => !!b))],
    alasan: penuh.alasan,
    seluruhnya: outlet.length === (semua as Outlet[]).length,
  };
}
