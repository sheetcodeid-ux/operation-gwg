/**
 * Tiruan pengunggah untuk pratinjau.
 *
 * Yang asli menarik `@/lib/actions/uploads`, dan berkas itu membaca `node:crypto`.
 * Di peramban benda itu tidak ada, dan yang terjadi bukan unggahan yang gagal
 * melainkan SELURUH halaman berhenti dirender — layarnya kosong tanpa satu pun
 * petunjuk kenapa.
 */
export interface UploadedFile {
  path: string;
  name: string;
}

export async function uploadMany(): Promise<UploadedFile[]> {
  throw new Error("Pratinjau — berkas tidak benar-benar diunggah.");
}
