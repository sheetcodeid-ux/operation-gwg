/** Tiruan aksi server `kejar-daily` untuk pratinjau. Angkanya CONTOH. */
export interface HasilKejar {
  cabang: number;
  terisi: number;
  gagal: number;
  sisa: number;
  persen: number;
  konkuren: number;
  lanjut: boolean;
  tunggu?: number;
  error?: string;
}

const WAJIB = 14_706;
let sisa = 10_845;

/** Satu jendela ditiru 2 detik, bukan 45 — supaya kemajuannya terlihat berjalan
 *  saat pratinjau dibuka, tanpa harus menunggui. */
export async function kejarDailyAction(): Promise<HasilKejar> {
  await new Promise((r) => setTimeout(r, 2_000));
  const terisi = Math.min(sisa, 318);
  sisa -= terisi;
  return {
    cabang: 57,
    terisi,
    gagal: 0,
    sisa,
    persen: ((WAJIB - sisa) / WAJIB) * 100,
    konkuren: 6,
    lanjut: sisa > 0,
  };
}
