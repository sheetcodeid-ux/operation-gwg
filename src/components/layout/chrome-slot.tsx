"use client";

import { usePathname } from "next/navigation";

/**
 * Menyembunyikan kerangka aplikasi di halaman yang mengambil alih seluruh layar.
 *
 * Di ponsel, Pesan berdiri sendiri seperti aplikasi pesan biasa: hanya panah
 * kembali di kepala percakapan, tanpa topbar aplikasi di atasnya. Dua baris
 * kepala bertumpuk memakan sepertiga layar dan membuat keduanya terasa sesak.
 *
 * Di layar lebar topbar tetap ada — di sana ruangnya memang cukup, dan
 * kehilangan navigasi utama justru membingungkan.
 */
const FULL_BLEED = ["/pesan"];

export function ChromeSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const full = FULL_BLEED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return <div className={full ? "hidden lg:contents" : "contents"}>{children}</div>;
}
