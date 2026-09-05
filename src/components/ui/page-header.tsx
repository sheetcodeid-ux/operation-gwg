import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Kepala halaman — sekarang HANYA memuat tombol aksinya.
 *
 * Judul besar beserta ikon dan keterangannya sudah dicabut dari SELURUH
 * halaman. Alasannya satu: remah roti di bilah atas sudah menyebut nama
 * halaman yang sama persis, dan judul yang mengulanginya memakan sekitar
 * sepertiga layar pertama — yang terdorong turun justru grafik, tabel, dan
 * isian yang jadi alasan halaman itu dibuka.
 *
 * Propertinya TIDAK dihapus meski tidak lagi tercetak. Empat puluh tujuh
 * halaman memanggilnya, dan `title` masih dipakai: ia dirender sebagai
 * judul tingkat satu yang tak terlihat, supaya susunan heading halaman tetap
 * utuh bagi pembaca layar dan mesin telusur. Yang hilang hanya ruangnya.
 */
export function PageHeader({
  title,
  actions,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}) {
  // Tanpa tombol, tidak ada yang perlu digambar sama sekali — sebuah kotak
  // kosong ber-margin tetap mendorong isinya turun tanpa alasan.
  if (!actions) return <h1 className="sr-only">{title}</h1>;
  return (
    <div className={cn("mb-4 flex items-center justify-end gap-3", className)}>
      <h1 className="sr-only">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      {Icon && (
        <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-muted/40 ring-1 ring-border">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
