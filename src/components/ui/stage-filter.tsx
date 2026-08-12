"use client";

import { cn } from "@/lib/utils";

/**
 * Deretan chip penyaring tahap untuk SEMUA antrian pengajuan.
 *
 * Tiap antrian dulu menggambar barisan tombolnya sendiri: Antrian System
 * memakai chip berhitung, antrian Design memakai dua tab "Antrian / Selesai",
 * dan keduanya berbeda bentuk maupun perilaku. Akibatnya "Selesai" di satu
 * halaman tidak berarti sama dengan "Selesai" di halaman lain, dan tahap
 * seperti "Revisi" tidak punya tempat sama sekali.
 *
 * Komponennya sengaja generik atas tipe nilainya: jenis tahapnya berbeda antar
 * modul (pengajuan punya `RequestStage`, System punya statusnya sendiri), tapi
 * bentuk dan cara pakainya harus persis sama.
 */
export function StageFilterChips<T extends string>({
  options,
  value,
  onChange,
  count,
  className,
}: {
  options: readonly { value: T | "all"; label: string }[];
  value: T | "all";
  onChange: (v: T | "all") => void;
  /** Jumlah baris untuk satu pilihan — ditampilkan di sebelah labelnya. */
  count: (v: T | "all") => number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const n = count(o.value);
        const aktif = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={aktif}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              aktif ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70",
              // Tahap kosong diredupkan, bukan disembunyikan: hilang-timbulnya
              // tombol membuat posisi tombol lain bergeser saat data berubah.
              !aktif && n === 0 && "opacity-50",
            )}
          >
            {o.label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
