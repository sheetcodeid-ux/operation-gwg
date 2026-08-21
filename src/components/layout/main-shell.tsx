"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "./breadcrumbs";
import { Footer } from "./footer";

/**
 * Isi halaman + kerangka di sekitarnya.
 *
 * Sebagian halaman adalah APLIKASI, bukan dokumen: Pesan dan Bagan Struktur
 * Organisasi mengisi seluruh layar dan mengatur gulirannya sendiri. Untuk halaman seperti itu, breadcrumb,
 * padding, dan footer justru merugikan — halaman jadi lebih tinggi dari layar,
 * seluruh isinya ikut bergeser saat digulir, dan kotak tulis hilang dari
 * pandangan. Di sini kerangka itu dilepas, bukan dilawan dengan margin negatif.
 */
const FULL_BLEED = ["/pesan", "/hc-mos/bagan"];

export function MainShell({ children, showHome }: { children: React.ReactNode; showHome: boolean }) {
  const pathname = usePathname();
  const full = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (full) {
    // min-h-0 penting: tanpa itu anak flex menolak menyusut dan gulirannya
    // bocor ke halaman, bukan ke dalam panel.
    return <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>;
  }

  return (
    <>
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Home menunjuk /dashboard — hanya untuk yang memang bisa membukanya. */}
        <Breadcrumbs showHome={showHome} />
        {children}
      </main>
      <Footer />
    </>
  );
}
