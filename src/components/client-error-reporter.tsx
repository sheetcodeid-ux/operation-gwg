"use client";

import { useEffect } from "react";

/**
 * Pelapor galat sisi peramban.
 *
 * Dipasang di tata letak akar supaya menyala sejak halaman pertama, termasuk
 * halaman login. Tanpa ini, layar "Terjadi kesalahan sistem" di perangkat
 * seseorang tidak meninggalkan jejak apa pun — dan sudah terbukti sekali bahwa
 * menebak penyebab kegagalan yang hanya muncul di satu perangkat itu membuang
 * waktu berhari-hari.
 *
 * Dua sumber galat ditangkap, karena keduanya nyata dan berbeda:
 *  • `error` — galat yang dilempar saat kode berjalan (termasuk gagal memuat
 *    potongan kode setelah penerapan versi baru).
 *  • `unhandledrejection` — janji yang gagal tanpa penangkap, bentuk galat
 *    paling umum pada pemanggilan jaringan.
 *
 * Pengirimannya dibatasi supaya satu galat yang berulang cepat tidak mengubah
 * tabel jejak jadi ribuan baris yang sama.
 */
const BATAS_KIRIM = 5;

/**
 * Bukan galat — alur kendali Next.js yang memang dilempar sebagai pengecualian.
 *
 * `redirect()` dan `notFound()` bekerja dengan MELEMPAR. Itu keputusan
 * rancangan Next, dan artinya setiap kali sebuah halaman mengalihkan
 * pengunjung — misalnya karena izinnya kurang atau sesinya habis — sebuah
 * "galat" bernama NEXT_REDIRECT muncul di peramban.
 *
 * Mencatatnya bukan sekadar mubazir, tapi merugikan: pengalihan terjadi
 * puluhan kali sehari pada pemakaian yang sepenuhnya normal, dan catatan galat
 * jadi penuh olehnya. Saat suatu hari ada kerusakan sungguhan, ia tenggelam di
 * antara ratusan baris yang tidak berarti apa-apa — dan yang mencari jadi
 * berhenti mempercayai catatan itu sama sekali.
 */
const ALUR_KENDALI = ["NEXT_REDIRECT", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK"];

const alurKendali = (pesan: string): boolean => ALUR_KENDALI.some((k) => pesan.includes(k));

export function ClientErrorReporter() {
  useEffect(() => {
    let terkirim = 0;
    const sudah = new Set<string>();

    const kirim = (kind: string, message: string, stack?: string) => {
      if (terkirim >= BATAS_KIRIM) return;
      if (alurKendali(message)) return;
      // Pesan yang persis sama cukup dicatat sekali per kunjungan.
      const kunci = `${kind}:${message}`;
      if (sudah.has(kunci)) return;
      sudah.add(kunci);
      terkirim += 1;

      try {
        const isi = JSON.stringify({
          kind,
          message,
          stack,
          path: window.location.pathname + window.location.search,
        });
        // `sendBeacon` tetap terkirim walau halamannya langsung ditutup —
        // dan galat berat sering diikuti pengguna yang menutup tabnya.
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/galat-klien", new Blob([isi], { type: "application/json" }));
        } else {
          void fetch("/api/galat-klien", { method: "POST", body: isi, headers: { "content-type": "application/json" }, keepalive: true });
        }
      } catch {
        /* pencatat tidak boleh ikut melempar galat */
      }
    };

    const onError = (e: ErrorEvent) => {
      kirim("client error", e.message || String(e.error), e.error instanceof Error ? e.error.stack : undefined);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | undefined;
      kirim("client rejection", r?.message ?? String(e.reason), r?.stack);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

/** Dipakai layar galat untuk melaporkan galat yang sudah ditangkap React. */
export function laporkanGalat(kind: string, error: unknown) {
  try {
    const e = error as { message?: string; stack?: string; digest?: string };
    // Pengalihan yang sampai ke layar galat pun tetap bukan kerusakan.
    if (alurKendali(e?.message ?? String(error))) return;
    void fetch("/api/galat-klien", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind,
        digest: e?.digest,
        message: e?.message ?? String(error),
        stack: e?.stack,
        path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      }),
    });
  } catch {
    /* diabaikan */
  }
}
