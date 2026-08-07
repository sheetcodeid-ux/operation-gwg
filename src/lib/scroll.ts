/**
 * Yang menggulir di aplikasi ini adalah SATU wadah, bukan halaman.
 *
 * Kerangka aplikasi dikunci setinggi layar (topbar dan sidebar tidak ikut
 * bergerak) dan isinya menggulir di dalam wadah bertanda `data-scroll-root`.
 * Itu yang membuat halaman seperti Pesan bisa mengisi layar penuh dengan kotak
 * tulis yang selalu terlihat.
 *
 * Akibatnya `window.scrollTo(0, 0)` tidak lagi menggerakkan apa pun. Semua kode
 * yang ingin "kembali ke atas" harus lewat sini.
 */

export const SCROLL_ROOT_ATTR = "data-scroll-root";

/** Wadah yang benar-benar menggulir; null saat dipanggil di server. */
export function scrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(`[${SCROLL_ROOT_ATTR}]`);
}

/** Kembali ke atas. Jatuh ke gulir halaman kalau wadahnya belum ada. */
export function scrollToTop(behavior: ScrollBehavior = "auto"): void {
  const root = scrollRoot();
  if (root) {
    root.scrollTo({ top: 0, behavior });
    return;
  }
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior });
}
