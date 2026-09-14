/** Tiruan aksi server `kejar-daily` untuk pratinjau. Angkanya CONTOH. */
export interface HasilKejar {
  cabang: number;
  terisi: number;
  sisa: number;
  persen: number;
  error?: string;
}

export async function kejarDailyAction(): Promise<HasilKejar> {
  await new Promise((r) => setTimeout(r, 1200));
  return { cabang: 9, terisi: 214, sisa: 10_845, persen: 25.9 };
}
