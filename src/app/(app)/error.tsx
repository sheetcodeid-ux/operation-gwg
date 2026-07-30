"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunk-recovery";

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
    recoverFromChunkError(error);
  }, [error]);

  const chunk = isChunkLoadError(error);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">
        {chunk ? "Memuat versi terbaru…" : "Terjadi kesalahan"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {chunk
          ? "Aplikasi baru saja diperbarui. Halaman dimuat ulang otomatis — mohon tunggu sebentar."
          : "Halaman ini gagal dimuat. Coba muat ulang — jika masih bermasalah, hubungi administrator."}
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground/70">Ref: {error.digest}</p>}
      <Button onClick={() => (chunk ? window.location.reload() : reset())} className="mt-5">
        <RotateCcw className="size-4" /> {chunk ? "Muat ulang sekarang" : "Coba lagi"}
      </Button>
    </div>
  );
}
