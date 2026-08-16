import "server-only";

import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 storage backend for uploaded photos/files.
 *
 * The heavy path (hygiene photos: ~2.700/day for 50 outlets) must NOT flow
 * through Vercel — it would exhaust the free CPU/transfer limits. So uploads go
 * BROWSER → R2 directly via a short-lived presigned PUT URL (signed here on the
 * server), and reads use a presigned GET URL (the bucket stays private). R2
 * egress is free, so re-signing on each render costs nothing.
 *
 * Active only when the four env vars are set; otherwise the app falls back to
 * Supabase Storage (unchanged), so nothing breaks before configuration.
 */

// Trim env values — a stray space/newline pasted into the dashboard would break
// the S3 signature (403) or the endpoint URL.
const endpoint = (process.env.R2_ENDPOINT || "").trim().replace(/\/+$/, "");
const bucket = (process.env.R2_BUCKET || "").trim();

export function r2Enabled(): boolean {
  return !!(endpoint && bucket && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

let _client: AwsClient | null = null;
function client(): AwsClient {
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: (process.env.R2_ACCESS_KEY_ID || "").trim(),
      secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || "").trim(),
      region: "auto",
      service: "s3",
    });
  }
  return _client;
}

function objectUrl(key: string): string {
  const safe = key.split("/").map(encodeURIComponent).join("/");
  return `${endpoint}/${bucket}/${safe}`;
}

/** Presigned PUT URL for a browser to upload one object directly to R2. */
export async function presignPut(key: string, contentType: string, expiresSec = 600): Promise<string> {
  const signed = await client().sign(`${objectUrl(key)}?X-Amz-Expires=${expiresSec}`, {
    method: "PUT",
    headers: { "content-type": contentType },
    aws: { signQuery: true },
  });
  return signed.url;
}

/**
 * Server-side upload of bytes to R2 (used for low-volume HC/System files).
 *
 * Body dikirim sebagai Uint8Array dengan `content-length` eksplisit. Versi
 * sebelumnya memakai Blob, yang dialirkan tanpa Content-Length sehingga R2
 * menolak SETIAP unggahan dengan 411 Length Required — kegagalannya tertelan
 * fallback ke Supabase, jadi tidak terlihat selain sebagai unggahan yang lambat
 * lalu gagal pada berkas besar.
 */
export async function r2Put(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const body = new Uint8Array(data);
  const res = await client().fetch(objectUrl(key), {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(body.byteLength) },
    body,
  });
  if (!res.ok && res.status !== 200 && res.status !== 204) {
    throw new Error(`R2 upload gagal (${res.status}) — ${await res.text().catch(() => "")}`.trim());
  }
}

/**
 * Presigned GET URL to view a private object (cheap HMAC, no network call).
 *
 * `downloadName` ditandatangani SEBAGAI BAGIAN dari URL lewat
 * response-content-disposition. Menempelkan parameter apa pun setelah URL
 * ditandatangani akan membatalkan tanda tangannya — R2 menghitung ulang dari
 * seluruh query string, lalu menolak dengan SignatureDoesNotMatch.
 */
export async function presignGet(key: string, expiresSec = 21_600, downloadName?: string): Promise<string> {
  const params = new URLSearchParams({ "X-Amz-Expires": String(expiresSec) });
  if (downloadName) {
    const safe = downloadName.replace(/"/g, "").slice(0, 120);
    params.set("response-content-disposition", `attachment; filename="${safe}"`);
  }
  const signed = await client().sign(`${objectUrl(key)}?${params.toString()}`, {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
}

/** Delete an object (best-effort). */
export async function r2Delete(key: string): Promise<void> {
  try {
    await client().fetch(objectUrl(key), { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

/** Satu halaman hasil penelusuran isi bucket. */
export interface R2Halaman {
  keys: { key: string; size: number }[];
  /** Diteruskan ke panggilan berikutnya; kosong berarti sudah habis. */
  lanjutan: string;
}

/**
 * Telusuri isi bucket di bawah sebuah awalan (ListObjectsV2).
 *
 * Dipakai pembersih foto untuk menemukan berkas YATIM — yang terunggah tapi
 * formulirnya tidak jadi tersimpan, sehingga tidak dirujuk baris mana pun.
 * Tanpa penelusuran, berkas seperti itu tidak akan pernah bisa ditemukan lagi:
 * kuncinya cuma ada di penyimpanan, tidak di basis data.
 *
 * Hasilnya dibaca per halaman (maks 1000 per panggilan, batas S3) supaya
 * bucket besar tidak perlu dimuat sekaligus ke memori.
 */
export async function r2List(prefix: string, lanjutan = "", maxKeys = 1000): Promise<R2Halaman> {
  const qs = new URLSearchParams({ "list-type": "2", prefix, "max-keys": String(maxKeys) });
  if (lanjutan) qs.set("continuation-token", lanjutan);
  const res = await client().fetch(`${endpoint}/${bucket}?${qs.toString()}`, { method: "GET" });
  if (!res.ok) throw new Error(`R2 list gagal (${res.status})`);
  const xml = await res.text();

  // XML-nya dangkal dan bentuknya tetap, jadi dibaca dengan pencocokan pola —
  // menambah pustaka pengurai XML untuk tiga tag tidak sepadan harganya.
  const keys: { key: string; size: number }[] = [];
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const isi = m[1];
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(isi)?.[1];
    if (!key) continue;
    keys.push({ key: decodeXml(key), size: Number(/<Size>(\d+)<\/Size>/.exec(isi)?.[1] ?? 0) });
  }
  const habis = /<IsTruncated>false<\/IsTruncated>/i.test(xml);
  return { keys, lanjutan: habis ? "" : (/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") };
}

const decodeXml = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** An Attachment id for an R2 object is prefixed so reads know to presign it. */
export const R2_PREFIX = "r2:";
export const isR2Key = (id: string | undefined): boolean => !!id?.startsWith(R2_PREFIX);
export const r2KeyOf = (id: string): string => id.slice(R2_PREFIX.length);
