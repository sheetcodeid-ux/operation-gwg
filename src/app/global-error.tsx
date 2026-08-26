"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Replaces the whole document when an error escapes the
 * root layout, so it must render its own <html>/<body>. Kept dependency-free
 * (no shared components) because those may be what failed.
 */
/**
 * Galat yang hanya bisa dipulihkan dengan MUAT ULANG KERAS — ditulis ulang di
 * sini, bukan diimpor, karena batas ini sengaja tanpa ketergantungan: modul
 * bersama justru bisa jadi yang gagal dimuat.
 *
 * Dua kelas:
 *  • kerangka halaman versi lama (ChunkLoadError dan kerabatnya);
 *  • galat urutan hook React (#300/#301/#310). Jejaknya menunjuk ke dalam
 *    Router App milik Next sendiri, jadi tidak ada yang bisa ditambal di kode
 *    kita — yang bisa dikerjakan adalah berhenti meninggalkan orang di layar
 *    mati. Menyusun ulang pohon yang sama akan gagal lagi; hanya memulai dari
 *    awal yang menolong.
 */
function isChunkError(error: unknown): boolean {
  const err = error as { name?: string; message?: string } | null;
  if (!err) return false;
  if (err.name === "ChunkLoadError") return true;
  const msg = String(err.message ?? error);
  return (
    /ChunkLoadError|Loading (chunk|CSS chunk)|dynamically imported module|module script failed/i.test(msg) ||
    /Minified React error #3(00|01|10)\b|Rendered more hooks than during the previous render/i.test(msg)
  );
}

/**
 * Buang service worker beserta seluruh isi cache-nya, lalu muat ulang.
 *
 * Ini pintu keluar untuk kegagalan yang TIDAK sembuh dengan menyegarkan
 * halaman — persis yang dialami di lapangan: sudah di-refresh, sudah keluar
 * masuk, tetap layar galat. Penyebab tersering kelas ini adalah sisa berkas
 * versi lama yang masih dilayani dari cache perangkat itu sendiri, dan tidak
 * ada satu pun tombol di peramban yang bisa ditekan pengguna biasa untuk
 * membersihkannya.
 */
async function bersihkanLaluMuatUlang() {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const daftar = await navigator.serviceWorker.getRegistrations();
      await Promise.all(daftar.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const kunci = await caches.keys();
      await Promise.all(kunci.map((k) => caches.delete(k)));
    }
  } catch {
    /* tetap lanjut memuat ulang walau pembersihannya gagal */
  }
  // `true` sudah tidak berpengaruh di peramban modern; menambahkan penanda
  // waktu memastikan permintaannya benar-benar baru.
  window.location.replace(window.location.pathname + "?segar=" + Date.now());
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);

    // Kirim galatnya ke jejak server. Ditulis langsung di sini, bukan lewat
    // modul bersama, karena batas galat ini sengaja tidak bergantung pada
    // modul mana pun — modul itulah yang mungkin gagal dimuat.
    try {
      void fetch("/api/galat-klien", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          kind: "global-error",
          digest: error?.digest,
          message: error?.message ?? String(error),
          stack: error?.stack,
          path: window.location.pathname + window.location.search,
        }),
      });
    } catch {
      /* diabaikan */
    }

    // Kerangka versi lama, atau galat urutan hook → muat ulang sekali
    // (dijaga supaya tidak berputar).
    if (typeof window !== "undefined" && isChunkError(error)) {
      try {
        const last = Number(sessionStorage.getItem("gwg_chunk_reload_at") || 0);
        if (Date.now() - last > 20_000) {
          sessionStorage.setItem("gwg_chunk_reload_at", String(Date.now()));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0f19",
          color: "#e5e7eb",
          margin: 0,
          padding: "1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Terjadi kesalahan sistem</h1>
          <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#9ca3af" }}>
            Aplikasi mengalami masalah tak terduga. Silakan muat ulang halaman.
          </p>
          <p style={{ marginTop: 8, fontSize: "0.75rem", color: "#6b7280" }}>
            {/* Kode rujukan hanya ada pada galat sisi server. Tulisan "tanpa
                kode" bukan hiasan: itulah yang membedakan galat server dari
                galat peramban, dan menentukan ke mana penelusurannya diarahkan. */}
            Ref: {error.digest || "tanpa kode (galat peramban)"}
          </p>

          {/* Pesan galatnya ditampilkan apa adanya, bukan disembunyikan.
              Layar ini hanya muncul di perangkat orang lain, sering di kota
              lain, dan satu-satunya laporan yang sampai ke sini adalah foto
              layar. Kalau fotonya cuma berisi "Terjadi kesalahan sistem",
              penelusurannya berubah jadi tebak-tebakan berhari-hari — sudah
              terbukti. Dengan pesan aslinya ikut terfoto, satu kiriman WhatsApp
              sudah cukup untuk tahu penyebabnya. */}
          {error.message ? (
            <p
              style={{
                marginTop: 12,
                fontSize: "0.7rem",
                lineHeight: 1.5,
                color: "#9ca3af",
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: 8,
                padding: "8px 10px",
                textAlign: "left",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {String(error.message).slice(0, 300)}
            </p>
          ) : null}
          <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: "#6366f1",
                color: "white",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
            <button
              onClick={() => void bersihkanLaluMuatUlang()}
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid #374151",
                background: "transparent",
                color: "#e5e7eb",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Bersihkan &amp; Muat Ulang
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.6 }}>
            Kalau menekan &ldquo;Coba lagi&rdquo; tidak menolong, tekan &ldquo;Bersihkan &amp; Muat Ulang&rdquo;.
            Tombol itu membuang berkas versi lama yang masih tersimpan di perangkat ini.
          </p>
        </div>
      </body>
    </html>
  );
}
