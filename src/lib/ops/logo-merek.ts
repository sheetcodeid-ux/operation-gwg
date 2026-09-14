import type { Tone } from "@/lib/constants";

/**
 * Lambang tiap merek — berkas logonya, dan warna cadangannya.
 *
 * SATU TEMPAT, supaya memasang logo baru cukup satu baris. Taruh berkasnya di
 * `public/merek/`, lalu tulis jalurnya di `LOGO_MEREK`.
 *
 * Merek yang belum punya berkas tetap tampil: huruf depannya di atas WARNA
 * MEREKNYA SENDIRI, bukan warna acak. Jadi outlet merek baru tidak pernah
 * membuat halamannya bolong sebelum logonya dibuat.
 *
 * Keempat berkasnya PIRINGAN UTUH — lambang di atas lingkaran warna, sudutnya
 * bening. Itu sebabnya lambangnya dipasang tanpa latar putih dan tanpa cincin:
 * bentuk bulatnya sudah dibawa gambarnya sendiri, dan latar putih di baliknya
 * cuma menyisakan rambut putih di tepi kalau layarnya gelap.
 *
 * Aslinya 2000×2000 (total 885 KB) dan dipakai pada 20–28 piksel. Disimpan
 * ulang pada 128×128 — masih dua kali lipat ukuran terbesarnya di layar
 * retina, tapi seluruhnya jadi 23 KB.
 */
export const LOGO_MEREK: Record<string, string> = {
  Nordu: "/merek/nordu.png",
  Cattu: "/merek/cattu.png",
  Busari: "/merek/busari.png",
  "Lesung Pipi": "/merek/lesung-pipi.png",
};

/** Warna dasar tiap nada merek — dipakai lambang cadangan dan penanda brand. */
export const WARNA_MEREK: Record<Tone, string> = {
  brand: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  neutral: "bg-slate-400",
  amber: "bg-amber-500",
  cyan: "bg-sky-500",
};
