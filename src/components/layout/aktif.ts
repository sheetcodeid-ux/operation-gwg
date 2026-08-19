"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Baris sidebar mana yang sedang terbuka.
 *
 * Dulu perbandingannya cuma alamat halaman, dan itu cukup selama satu menu =
 * satu halaman. Kerangka HC-MOS mematahkan anggapan itu: "Payroll",
 * "BPJS & Benefit", dan "Struktur Kompensasi" adalah tiga baris menuju halaman
 * YANG SAMA dengan tab berbeda. Tanpa ikut membandingkan tab-nya, ketiganya
 * menyala bersamaan — atau yang menyala justru bukan yang sedang dibuka.
 *
 * Aturannya berlapis, dari yang paling khusus:
 *  1. Alamatnya harus cocok (sama persis, atau halaman ini ada di dalamnya).
 *  2. Bila barisnya menyebut tab tertentu, tab yang sedang aktif harus sama.
 *  3. Di antara yang lolos, yang menyebut tab menang atas yang tidak — supaya
 *     "Attendance & Cuti" tidak ikut menyala saat yang dibuka "Payroll".
 *
 * Dipakai bersama sidebar dan menu ponsel. Keduanya pernah menyalin logika ini
 * masing-masing; satu yang tertinggal berarti baris yang menyala di layar besar
 * berbeda dengan di ponsel, untuk halaman yang sama persis.
 */
export function useActiveHref(items: { href: string }[]): (href: string) => boolean {
  const pathname = usePathname();
  const search = useSearchParams();

  const aktif = useMemo(() => {
    let terbaik = "";
    let skorTerbaik = -1;
    for (const { href } of items) {
      const [dasar, kueri] = href.split("?");
      if (pathname !== dasar && !pathname.startsWith(dasar + "/")) continue;
      let skor = dasar.length;
      if (kueri) {
        const minta = new URLSearchParams(kueri);
        let cocok = true;
        for (const [k, v] of minta) if (search.get(k) !== v) cocok = false;
        if (!cocok) continue;
        // Yang menyebut tab lebih khusus daripada yang tidak — selalu menang.
        skor += 1000 + kueri.length;
      }
      if (skor > skorTerbaik) {
        skorTerbaik = skor;
        terbaik = href;
      }
    }
    return terbaik;
  }, [items, pathname, search]);

  return (href: string) => href === aktif;
}
