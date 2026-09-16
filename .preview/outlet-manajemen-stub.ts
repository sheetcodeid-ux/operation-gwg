/** Tiruan aksi server `outlet-manajemen` untuk pratinjau. Tidak menyimpan apa pun. */
export interface HasilSimpanOutlet {
  ok: boolean;
  error?: string;
}

export async function simpanOutletAction(): Promise<HasilSimpanOutlet> {
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true };
}
