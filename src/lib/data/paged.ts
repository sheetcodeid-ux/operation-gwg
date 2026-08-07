import "server-only";

/**
 * Pembacaan tabel bertahap — pagar terhadap batas diam-diam PostgREST.
 *
 * API Supabase memotong SETIAP permintaan pada 1.000 baris. Pemotongan itu
 * TIDAK memunculkan error: `data` cuma berisi seribu baris dan sisanya hilang
 * tanpa jejak. `.limit(10000)` juga tidak menaikkan batas itu — ia hanya
 * terlihat seperti sudah menaikkannya, dan itulah yang paling berbahaya.
 *
 * Bug inilah yang membuat audit hygiene 7 Agustus tidak muncul di tabel:
 * tabelnya sudah 1.103 baris, jadi 103 baris dibuang, dan karena kuerinya tanpa
 * ORDER BY seribu baris yang tersisa pun potongan sembarang — bukan yang
 * terbaru. Datanya tidak pernah hilang; aplikasinya yang berhenti membacanya.
 *
 * Aturan yang berlaku sekarang: setiap pembacaan yang hasilnya BISA melewati
 * seribu baris wajib lewat `selectAll`, dan kueri di dalamnya wajib memakai
 * urutan yang stabil (kolom unik / kunci utama) supaya batas antar halaman
 * tidak menggeser baris — tanpa itu, satu baris bisa terlewat atau terbaca dua
 * kali. `src/lib/data/paged.test.ts` menjaga aturan ini.
 */

/** Batas keras satu permintaan PostgREST — bukan pilihan kita, tidak bisa dinaikkan dari klien. */
export const PAGE_SIZE = 1000;

/** Pagar supaya tabel yang membengkak tidak diam-diam menghabiskan memori. */
export const MAX_ROWS = 100_000;

export interface PageResponse {
  data: unknown[] | null;
  error: { message: string } | null;
}

/**
 * Membangun satu halaman kueri.
 *
 * WAJIB memakai `.order(...)` pada kolom yang unik — lihat catatan di atas.
 */
export type PageFetcher = (from: number, to: number) => PromiseLike<PageResponse>;

/**
 * Baca seluruh baris sebuah kueri, halaman demi halaman, sampai habis.
 *
 * `label` hanya untuk pesan error/log supaya tabel penyebabnya kelihatan.
 * Melempar bila salah satu halaman gagal — pemanggil yang memutuskan apakah itu
 * fatal atau cukup dicatat.
 */
export async function selectAll<T>(label: string, page: PageFetcher, maxRows = MAX_ROWS): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    // Halaman tidak penuh ⇒ sudah sampai baris terakhir.
    if (rows.length < PAGE_SIZE) return out;
  }
  console.error(`[paged] ${label} melewati ${maxRows} baris — sisanya tidak dibaca.`);
  return out;
}
