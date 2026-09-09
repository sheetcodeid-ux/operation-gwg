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

/**
 * PUT ke R2 lewat XHR, bukan `fetch`.
 *
 * `fetch` tidak melaporkan kemajuan unggahan sama sekali. Untuk berkas 40 MB
 * dari ponsel itu berarti tombol yang diam satu menit penuh — dan yang
 * menunggunya menekan ulang, mengira aplikasinya menggantung. XHR punya
 * `upload.onprogress`, satu-satunya cara mendapatkan persentase yang benar.
 */
function putBerkas(url: string, file: File, onMaju?: (persen: number) => void): Promise<number> {
  return new Promise((selesai, gagal) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onMaju) onMaju(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => selesai(xhr.status);
    xhr.onerror = () => gagal(new Error("jaringan"));
    xhr.onabort = () => gagal(new Error("dibatalkan"));
    xhr.send(file);
  });
}

async function direct(scope: UploadScope, file: File, onMaju?: (persen: number) => void): Promise<UploadedFile | null> {
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

  let status: number;
  try {
    status = await putBerkas(signed.url, file, onMaju);
  } catch {
    // Permintaan ditolak browser tanpa status — hampir selalu karena CORS
    // bucket belum mengizinkan PUT dari domain ini. Sebutkan itu supaya tidak
    // terbaca sebagai gangguan acak.
    throw new Error(`Gagal mengunggah "${file.name}" — koneksi ke penyimpanan ditolak (cek izin CORS bucket R2).`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Gagal mengunggah "${file.name}" — penyimpanan menolak (${status}).`);
  }
  onMaju?.(100);
  return { path: signed.path, name: file.name };
}

/** Unggah satu berkas: langsung ke R2, dan hanya mundur ke `legacy` bila perlu. */
export async function uploadOne(
  scope: UploadScope,
  file: File,
  legacy: LegacyUpload,
  onMaju?: (persen: number) => void,
): Promise<UploadedFile> {
  try {
    const up = await direct(scope, file, onMaju);
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

/**
 * Batas berkas yang diunggah BERSAMAAN.
 *
 * Berurutan satu per satu membuat sepuluh foto memakan sepuluh kali waktu satu
 * foto, padahal jaringan menganggur di antaranya. Tidak semuanya sekaligus
 * juga: koneksi seluler yang dipaksa membuka sepuluh unggahan besar justru
 * melambat, dan kegagalannya menyeret semuanya.
 */
const SERENTAK = 3;

/**
 * Unggah beberapa berkas, tiga sekaligus; melempar pada kegagalan pertama.
 *
 * `onMaju` menerima persentase GABUNGAN — dihitung dari byte, bukan dari
 * jumlah berkas yang selesai. Sepuluh foto berukuran sangat berbeda akan
 * membuat bar berbasis hitungan melompat-lompat dan berhenti lama di satu
 * angka; yang berbasis byte bergerak sehalus unggahannya sendiri.
 */
export async function uploadMany(
  scope: UploadScope,
  files: File[],
  legacy: LegacyUpload,
  onMaju?: (persen: number) => void,
): Promise<UploadedFile[]> {
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  const majuPer = new Array(files.length).fill(0);
  const lapor = () => {
    if (!onMaju) return;
    const naik = files.reduce((s, f, i) => s + (f.size * majuPer[i]) / 100, 0);
    onMaju(Math.min(100, Math.round((naik / total) * 100)));
  };

  const hasil = new Array<UploadedFile>(files.length);
  let berikut = 0;
  const pekerja = async () => {
    for (;;) {
      const i = berikut++;
      if (i >= files.length) return;
      hasil[i] = await uploadOne(scope, files[i], legacy, (p) => {
        majuPer[i] = p;
        lapor();
      });
      majuPer[i] = 100;
      lapor();
    }
  };
  await Promise.all(Array.from({ length: Math.min(SERENTAK, files.length) }, pekerja));
  return hasil;
}
