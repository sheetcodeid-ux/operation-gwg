import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Daftar "label — isi" yang rapi: label di kiri, isi rata kanan, baris ganjil
 * diberi latar tipis supaya mudah dipindai. Baris otomatis menumpuk di layar
 * sempit sehingga isi yang panjang tidak pernah terpotong.
 */
export interface DetailRow {
  label: string;
  value: React.ReactNode;
  /** Sembunyikan baris bila isinya kosong. */
  skipEmpty?: boolean;
}

export function DetailRows({ rows, className }: { rows: DetailRow[]; className?: string }) {
  const shown = rows.filter((r) => !(r.skipEmpty && (r.value === null || r.value === undefined || r.value === "")));
  if (shown.length === 0) return null;
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border", className)}>
      {shown.map((r, i) => (
        <div
          key={r.label}
          className={cn(
            "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-xs",
            i % 2 === 0 && "bg-muted/40",
          )}
        >
          <span className="shrink-0 text-muted-foreground">{r.label}</span>
          <span className="min-w-0 text-right font-medium text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Judul kecil di atas satu blok rincian. */
export function DetailTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}
