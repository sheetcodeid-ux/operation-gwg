import "server-only";

import { NextResponse } from "next/server";
import { db, dbEnabled } from "@/lib/data/db";
import { isR2Key, presignGet, r2KeyOf } from "@/lib/storage/r2";

/**
 * Bagian bersama rute pembuka berkas.
 *
 * MENGAPA ADA RUTE SEPERTI INI SAMA SEKALI.
 *
 * Dulu daftar pengajuan dan daftar tiket menanam presigned URL langsung ke
 * dalam halaman. Tanda tangannya berumur satu jam, sementara halamannya tidak:
 * aplikasi ini dipasang sebagai PWA dan tabnya bisa menganggur berhari-hari.
 * Yang terjadi kemudian persis seperti yang dilaporkan — foto hasil design
 * diklik beberapa hari setelah selesai, dan yang muncul bukan gambarnya
 * melainkan
 *
 *   <Error><Code>ExpiredRequest</Code><Message>Request has expired</Message></Error>
 *
 * yaitu jawaban mentah dari penyimpanan, dalam bahasa yang tidak berarti apa
 * pun bagi orang yang cuma ingin melihat berkasnya.
 *
 * Memperpanjang masa berlaku tanda tangan bukan perbaikan, hanya penundaan:
 * berapa pun angkanya, selalu ada tab yang lebih tua dari itu — dan tautan yang
 * lebih panjang umurnya juga lebih lama bisa dipakai orang yang tidak berhak
 * bila sempat tersalin keluar.
 *
 * Maka yang ditanam di halaman sekarang adalah ALAMAT APLIKASI yang tetap. Ia
 * tidak pernah kedaluwarsa karena ia bukan tanda tangan; tanda tangannya baru
 * dibuat pada detik berkasnya diklik, dan hanya setelah hak aksesnya diperiksa
 * ulang terhadap sesi yang sedang berjalan saat itu. Tautan lama yang bocor pun
 * tidak membuka apa-apa.
 */

/** Umur tanda tangan — hanya perlu bertahan selama satu kali pengalihan. */
export const BERKAS_TTL = 60 * 5;

/**
 * Berapa lama peramban boleh memakai ulang satu pengalihan.
 *
 * HARUS lebih pendek dari `BERKAS_TTL`. Kalau lebih panjang, peramban akan
 * memakai kembali pengalihan ke tanda tangan yang sudah mati — mengembalikan
 * persis kegagalan yang sedang diperbaiki, hanya dengan jeda yang lebih pendek.
 *
 * Nol pun sebenarnya aman, tapi mahal: satu petak bukti berisi belasan gambar,
 * dan tanpa jeda ini setiap kali digulir semuanya menandatangani ulang.
 */
const CACHE_DETIK = 240;

/** Pengalihan ke tautan bertanda tangan, dan hanya untuk peramban ini sendiri. */
export function alihkanKeBerkas(url: string): Response {
  return new NextResponse(null, {
    status: 302,
    headers: { location: url, "cache-control": `private, max-age=${CACHE_DETIK}` },
  });
}

/**
 * Tanda tangani satu jalur simpanan lalu alihkan ke sana.
 *
 * `namaUnduhan` diisi hanya bila berkasnya memang ingin diunduh, bukan dilihat.
 */
export async function sajikanBerkas(jalur: string, namaUnduhan?: string): Promise<Response | null> {
  try {
    if (isR2Key(jalur)) return alihkanKeBerkas(await presignGet(r2KeyOf(jalur), BERKAS_TTL, namaUnduhan));
    if (dbEnabled) {
      const { data } = await db()
        .storage.from("system-attachments")
        .createSignedUrl(jalur, BERKAS_TTL, { download: namaUnduhan });
      if (data?.signedUrl) return alihkanKeBerkas(data.signedUrl);
    }
  } catch (e) {
    console.error("[berkas] gagal menandatangani lampiran:", e);
  }
  return null;
}

/**
 * Kegagalan dijawab sebagai HALAMAN, bukan JSON.
 *
 * Tautan ini dibuka di tab peramban. JSON di sana terbaca sebagai teks mentah
 * yang membingungkan — persis kesalahan yang sedang diperbaiki rute ini.
 */
export function halamanGalatBerkas(pesan: string, status: number): Response {
  const aman = pesan.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  return new NextResponse(
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Berkas tidak bisa dibuka</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;background:#0b0d12;color:#e6e8ee"><main style="max-width:22rem;padding:2rem;text-align:center"><p style="margin:0 0 .5rem;font-size:2rem">📄</p><p style="margin:0;font-weight:600">Berkas tidak bisa dibuka</p><p style="margin:.5rem 0 0;opacity:.7">${aman}</p></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
