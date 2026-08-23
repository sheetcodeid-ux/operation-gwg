"use client";

import { presignAttachmentAction, type UploadScope } from "@/lib/actions/uploads";

/**
 * Unggah berkas dari browser tanpa menyinggahkannya di fungsi serverless.
 *
 * R2 dicoba lebih dulu untuk SEMUA ukuran, bukan hanya berkas besar.
 *
 * Sebelumnya hanya berkas di atas 3 MB yang naik langsung; sisanya dibawa
 * melalui server action. Itu terdengar aman, tapi justru menyisakan lubang yang
 * paling sering kena: foto KTP dari HP hampir selalu 1–3 MB — persis di bawah
 * ambang. Berkas sebesar itu tetap harus menempuh badan permintaan fungsi
 * serverless, dan kegagalan apa pun di sana (batas platform, koneksi seluler
 * yang putus di tengah, waktu habis) ditolak SEBELUM kode kita sempat jalan.
 * Yang sampai ke layar hanyalah pesan bawaan yang isinya disunting, sehingga
 * `try/catch` di dalam aksinya tidak pernah kebagian menjelaskan apa pun.
 *
 * Jalur Pengajuan Design sudah diperbaiki begini lebih dulu dan berhenti
 * bermasalah; jalur dokumen HC memakai penolong ini dan tertinggal. Ambangnya
 * kini hanya menentukan apa yang boleh MUNDUR ke server saat R2 tidak aktif —
 * bukan lagi apa yang boleh naik langsung.
 */
const DIRECT_MIN = 3 * 1024 * 1024;

export type LegacyUpload = (fd: FormData) => Promise<{ path?: string; name?: string; error?: string }>;

/** Hasil unggah satu berkas: path tersimpan + nama aslinya. */
export interface UploadedFile {
  path: string;
  name: string;
}

async function direct(scope: UploadScope, file: File): Promise<UploadedFile | null> {
  const signed = await presignAttachmentAction({
    scope,
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  // R2 belum aktif ⇒ jatuh ke jalur lama, bukan gagal.
  if (signed.unavailable) return null;
  if (signed.error) throw new Error(signed.error);
  if (!signed.url || !signed.path) return null;

  let res: Response;
  try {
    res = await fetch(signed.url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type || "application/octet-stream" },
    });
  } catch {
    // fetch menolak tanpa status = permintaan diblokir browser, hampir selalu
    // karena CORS bucket belum mengizinkan PUT dari domain ini. Sebutkan itu
    // supaya tidak terbaca sebagai gangguan acak.
    throw new Error(`Gagal mengunggah "${file.name}" — koneksi ke penyimpanan ditolak (cek izin CORS bucket R2).`);
  }
  if (!res.ok) throw new Error(`Gagal mengunggah "${file.name}" — penyimpanan menolak (${res.status}).`);
  return { path: signed.path, name: file.name };
}

/** Unggah satu berkas: langsung ke R2, dan hanya mundur ke `legacy` bila perlu. */
export async function uploadOne(scope: UploadScope, file: File, legacy: LegacyUpload): Promise<UploadedFile> {
  try {
    const up = await direct(scope, file);
    if (up) return up;
  } catch (e) {
    // Berkas besar TIDAK boleh mundur ke server action: di sana ia pasti
    // ditolak lagi, dan penolakannya kali ini tanpa alasan yang bisa dibaca.
    // Yang kecil boleh mencoba jalur lama — itu jaring pengaman saat R2 sedang
    // menolak, bukan jalur utama.
    if (file.size > DIRECT_MIN) throw e;
  }

  const fd = new FormData();
  fd.append("file", file);
  const res = await legacy(fd);
  if (res.error) throw new Error(res.error);
  if (!res.path) throw new Error(`Gagal mengunggah "${file.name}".`);
  return { path: res.path, name: res.name ?? file.name };
}

/** Unggah beberapa berkas berurutan; melempar pada kegagalan pertama. */
export async function uploadMany(scope: UploadScope, files: File[], legacy: LegacyUpload): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  for (const f of files) out.push(await uploadOne(scope, f, legacy));
  return out;
}
