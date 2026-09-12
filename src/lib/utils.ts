import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { nowMs } from "./now";

/** Tailwind-aware className merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number with thousands separators (id-ID). */
export function formatNumber(value: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("id-ID", opts).format(value);
}

/** Format currency in IDR. */
export function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact IDR (e.g. Rp 12,5 jt). */
export function formatIDRShort(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value}`;
}

/** Format a 0-100 score as a one-decimal percentage-like value. */
export function formatScore(value: number) {
  return value.toFixed(1);
}

/** Short, human date (e.g. 23 Jun 2026). */
export function formatDate(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Rentang dua tanggal sebagai satu kalimat pendek: "1 Jun – 31 Agu 2026".
 *
 * DIPAKAI MENGGANTIKAN kalimat "30 hari terakhir" yang diketik tangan di enam
 * layar. Kalimat yang diketik tangan akan tetap berbunyi 30 hari lama setelah
 * jendelanya diubah — tidak ada yang gagal saat itu terjadi, hanya enam layar
 * yang berbohong dengan tenang. Yang ini dibaca dari tanggal datanya sendiri.
 */
export function formatRentang(dari: string | null, sampai: string | null): string | null {
  if (!dari || !sampai) return null;
  const a = new Date(dari);
  const b = new Date(sampai);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const tahunSama = a.getFullYear() === b.getFullYear();
  const kiri = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", ...(tahunSama ? {} : { year: "numeric" }) }).format(a);
  const kanan = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(b);
  return `${kiri} – ${kanan}`;
}

/** Relative time from the demo "now" (e.g. "3 days ago", "in 2 days").
 *  Dihitung dari jam nyata, sehingga "2 hari lagi" benar-benar dua hari lagi. */
export function fromNow(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = d.getTime() - nowMs();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
}

/**
 * Waktu relatif dalam BAHASA INDONESIA — "12 hari lalu", "24 menit lalu".
 *
 * Berdiri sendiri di samping `fromNow` yang berbahasa Inggris, bukan
 * menggantikannya: `fromNow` dipakai belasan layar lain, dan mengubah
 * bahasanya diam-diam di satu tempat ini berarti mengubahnya di semua tempat
 * tanpa ada yang meminta.
 */
export function sejakKini(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = d.getTime() - nowMs();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "baru saja";
}

/** Clamp a number to a [min, max] range. */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Deterministic initials from a name. */
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

/** Apakah tenggat sudah lewat dibanding waktu sekarang, sehingga
 *  overdue flags stay consistent with the seeded data regardless of the real
 *  wall clock. */
export function isOverdue(due: string | Date | null | undefined) {
  if (!due) return false;
  return new Date(due).getTime() < nowMs();
}
