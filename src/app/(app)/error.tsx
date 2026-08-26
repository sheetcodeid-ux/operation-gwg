"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, isGalatUrutanHook, recoverFromChunkError } from "@/lib/chunk-recovery";
import { laporkanGalat } from "@/components/client-error-reporter";

/**
 * Segment-level error boundary for the authenticated app. Catches render/data
 * errors in any page under (app) and offers a recovery action instead of a
 * blank screen. `digest` correlates with the server log entry.
 *
 * A common cause of a *stuck* error here is a stale page shell after a deploy:
 * the cached HTML references JS chunks whose hashed filenames no longer exist,
 * so a dynamic import 404s (ChunkLoadError). A soft "restart" doesn't fix it —
 * only a hard reload does — so we detect that case and reload once automatically
 * instead of stranding a supervisor mid-task on an error they can't clear.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error);
    // Dicatat ke jejak server supaya kegagalan di perangkat seseorang bisa
    // ditelusuri tanpa menunggu ia sempat memotret layarnya.
    laporkanGalat("app-error", error);
    recoverFromChunkError(error);
  }, [error]);

  const chunk = isChunkLoadError(error);
  // Galat urutan hook juga dipulihkan dengan muat ulang, tapi sebabnya BUKAN
  // versi lama — menyebutnya begitu akan menyesatkan yang membaca layarnya.
  const hook = !chunk && isGalatUrutanHook(error);
  const memuatUlang = chunk || hook;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">
        {chunk ? "Memuat versi terbaru…" : hook ? "Memulihkan halaman…" : "Terjadi kesalahan"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {chunk
          ? "Aplikasi baru saja diperbarui. Halaman dimuat ulang otomatis — mohon tunggu sebentar."
          : hook
            ? "Halaman ini tersendat saat digambar. Dimuat ulang otomatis — mohon tunggu sebentar."
            : "Halaman ini gagal dimuat. Coba muat ulang — jika masih bermasalah, hubungi administrator."}
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground/70">Ref: {error.digest}</p>}
      {/* Pesan aslinya ikut ditampilkan (kecuali saat sekadar memuat versi baru)
          supaya foto layar dari perangkat siapa pun langsung bisa dibaca
          penyebabnya, tanpa harus menunggu jejak servernya. */}
      {!memuatUlang && error.message && (
        <p className="mt-3 w-full break-words rounded-lg border border-border bg-muted/40 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
          {String(error.message).slice(0, 300)}
        </p>
      )}
      <Button onClick={() => (memuatUlang ? window.location.reload() : reset())} className="mt-5">
        <RotateCcw className="size-4" /> {memuatUlang ? "Muat ulang sekarang" : "Coba lagi"}
      </Button>
    </div>
  );
}
