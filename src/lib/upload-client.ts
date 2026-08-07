"use client";

import { presignAttachmentAction, type UploadScope } from "@/lib/actions/uploads";

/**
 * Unggah berkas dari browser tanpa melewati batas ukuran fungsi serverless.
 *
 * Badan permintaan menuju server action dibatasi beberapa MB dan ditolak di
 * lapisan platform — sebelum kode kita sempat jalan — jadi berkas besar gagal
 * dengan pesan generik "an unexpected response was received from the server".
 * Berkas di atas ambang ini naik langsung ke R2 lewat presigned URL; sisanya
 * tetap lewat server action supaya jalur lama tidak berubah perilakunya.
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

  const res = await fetch(signed.url, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Gagal mengunggah "${file.name}" (${res.status}).`);
  return { path: signed.path, name: file.name };
}

/** Unggah satu berkas: langsung ke R2 bila besar, selain itu lewat `legacy`. */
export async function uploadOne(scope: UploadScope, file: File, legacy: LegacyUpload): Promise<UploadedFile> {
  if (file.size > DIRECT_MIN) {
    const up = await direct(scope, file);
    if (up) return up;
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
