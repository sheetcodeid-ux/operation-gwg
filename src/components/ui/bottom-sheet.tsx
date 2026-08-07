"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panel yang naik dari bawah layar.
 *
 * Di ponsel, panel dari samping terasa asing dan bagian bawahnya sulit
 * dijangkau ibu jari. Panel yang naik dari bawah adalah bentuk yang sudah
 * dikenal semua orang dari aplikasi sehari-hari, dan tumpuan aksinya berada
 * tepat di jangkauan.
 *
 * Di layar lebar ia menjadi kartu di tengah, karena "naik dari bawah" pada
 * monitor lebar hanya membuat isinya jauh dari pandangan.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    // Kunci gulir latar supaya menggeser panel tidak ikut menggeser halaman.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div
        className="animate-overlay-in absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-sheet-up relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl",
          "sm:max-h-[85dvh] sm:max-w-md sm:rounded-3xl",
          className,
        )}
      >
        {/* Pegangan geser — penanda visual bahwa panel ini bisa ditutup. */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>

        {(title || description) && (
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3">
            <div className="min-w-0">
              {title && <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Tutup"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
