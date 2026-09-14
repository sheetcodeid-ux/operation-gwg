import type { Tone } from "@/lib/constants";

/**
 * Lambang tiap merek — berkas logonya, dan warna cadangannya.
 *
 * SATU TEMPAT, supaya memasang logo baru cukup satu baris. Taruh berkasnya di
 * `public/merek/`, lalu tulis jalurnya di `LOGO_MEREK`.
 *
 * Selama berkasnya belum ada, yang tampil huruf depan merek di atas WARNA
 * MEREKNYA SENDIRI — bukan warna acak. Keempat kartu tetap terbedakan dari
 * kejauhan, halamannya utuh sejak hari pertama, dan begitu logonya masuk yang
 * berubah hanya berkas ini.
 *
 * Ukuran yang dipakai 20–28 piksel dan dipotong bulat, jadi logo yang SUDAH
 * bulat (lambang di atas piringan warna) paling rapi — persis bentuk PNG yang
 * dikirim. Simpan minimal 128×128 supaya tetap tajam di layar retina.
 *
 * Nama berkas yang ditunggu, tinggal ditaruh lalu barisnya dibuka:
 *   public/merek/nordu.png · cattu.png · busari.png · lesung-pipi.png
 */
export const LOGO_MEREK: Record<string, string> = {
  // Nordu: "/merek/nordu.png",
  // Cattu: "/merek/cattu.png",
  // Busari: "/merek/busari.png",
  // "Lesung Pipi": "/merek/lesung-pipi.png",
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
