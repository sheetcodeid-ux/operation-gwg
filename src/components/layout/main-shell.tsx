"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";

/**
 * Isi halaman + kerangka di sekitarnya.
 *
 * Sebagian halaman adalah APLIKASI, bukan dokumen: Pesan, Bagan Struktur
 * Organisasi, dan Matriks RACI mengisi seluruh layar dan mengatur gulirannya
 * sendiri. Untuk halaman seperti itu, breadcrumb, padding, dan footer justru
 * merugikan — halaman jadi lebih tinggi dari layar, seluruh isinya ikut
 * bergeser saat digulir, dan kepala tabel yang seharusnya menempel ikut
 * terbawa naik. Di sini kerangka itu dilepas, bukan dilawan dengan margin
 * negatif.
 */
const FULL_BLEED = ["/pesan", "/hc-mos/bagan", "/hc-mos/raci"];

export function MainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const full = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (full) {
    // min-h-0 penting: tanpa itu anak flex menolak menyusut dan gulirannya
    // bocor ke halaman, bukan ke dalam panel.
    return <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>;
  }

  return (
    <>
      {/* Remah roti sudah pindah ke bilah atas — lihat `topbar.tsx`. Di sini
          ia memakan satu baris penuh pada SETIAP halaman, padahal bilah atas
          punya ruang kosong yang lebarnya berkali-kali lipat. */}
      <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      <Footer />
    </>
  );
}
