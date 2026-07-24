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

/** Server-side upload of bytes to R2 (used for low-volume HC/System files). */
export async function r2Put(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const res = await client().fetch(objectUrl(key), {
    method: "PUT",
    headers: { "content-type": contentType },
    body: new Blob([data], { type: contentType }),
  });
  if (!res.ok && res.status !== 200 && res.status !== 204) {
    throw new Error(`R2 upload gagal (${res.status})`);
  }
}

/** Presigned GET URL to view a private object (cheap HMAC, no network call). */
export async function presignGet(key: string, expiresSec = 21_600): Promise<string> {
  const signed = await client().sign(`${objectUrl(key)}?X-Amz-Expires=${expiresSec}`, {
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

/** An Attachment id for an R2 object is prefixed so reads know to presign it. */
export const R2_PREFIX = "r2:";
export const isR2Key = (id: string | undefined): boolean => !!id?.startsWith(R2_PREFIX);
export const r2KeyOf = (id: string): string => id.slice(R2_PREFIX.length);
