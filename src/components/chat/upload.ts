"use client";

import { chatPresignAction, chatUploadAction } from "@/lib/actions/chat";
import type { ChatAttachment } from "@/lib/chat-shared";

/**
 * Unggah lampiran obrolan.
 *
 * Berkas besar naik LANGSUNG ke R2 lewat presigned URL. Melewatkannya ke server
 * action akan ditolak lapisan platform sebelum kode kita sempat jalan — yang
 * terlihat pengguna hanyalah galat generik tanpa sebab. Berkas kecil tetap
 * lewat server action supaya jalur ini tetap bekerja saat R2 belum aktif.
 */
const DIRECT_MIN = 3 * 1024 * 1024;

async function direct(file: File): Promise<ChatAttachment | null> {
  const signed = await chatPresignAction({
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  if (signed.error || !signed.url || !signed.path) return null;

  let res: Response;
  try {
    res = await fetch(signed.url, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type || "application/octet-stream" },
    });
  } catch {
    // fetch gagal tanpa status = permintaan diblokir browser, hampir selalu
    // karena CORS bucket belum mengizinkan PUT dari domain ini.
    throw new Error(`Gagal mengunggah "${file.name}" — koneksi ke penyimpanan ditolak (cek izin CORS bucket R2).`);
  }
  if (!res.ok) throw new Error(`Gagal mengunggah "${file.name}" — penyimpanan menolak (${res.status}).`);
  // Tipe MIME ikut disimpan: nama berkas dari kamera ponsel sering tanpa
  // ekstensi, dan tanpa tipe ini foto tampil sebagai kartu berkas — juga
  // membuat saringan "bukti wajib foto" kehilangan dasarnya.
  return { path: signed.path, name: file.name, type: file.type || undefined };
}

export async function uploadChatFiles(files: File[]): Promise<ChatAttachment[]> {
  const out: ChatAttachment[] = [];
  for (const f of files) {
    if (f.size > DIRECT_MIN) {
      const up = await direct(f);
      if (up) {
        out.push(up);
        continue;
      }
    }
    const fd = new FormData();
    fd.append("file", f);
    const res = await chatUploadAction(fd);
    if (res.error) throw new Error(res.error);
    if (!res.path) throw new Error(`Gagal mengunggah "${f.name}".`);
    out.push({ path: res.path, name: res.name ?? f.name, type: f.type || undefined });
  }
  return out;
}
