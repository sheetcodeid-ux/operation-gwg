"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary for the authenticated app. Catches render/data
 * errors in any page under (app) and offers a recovery action instead of a
 * blank screen. `digest` correlates with the server log entry.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">Terjadi kesalahan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Halaman ini gagal dimuat. Coba muat ulang — jika masih bermasalah, hubungi administrator.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted-foreground/70">Ref: {error.digest}</p>}
      <Button onClick={reset} className="mt-5">
        <RotateCcw className="size-4" /> Coba lagi
      </Button>
    </div>
  );
}
