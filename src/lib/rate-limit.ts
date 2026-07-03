import "server-only";

/**
 * Best-effort in-memory sliding-window rate limiter for auth endpoints.
 *
 * NOTE: state is per-process, so on multi-instance serverless it only throttles
 * per warm instance. For production-grade protection back this with a shared
 * store (Upstash / Vercel KV / Redis) — the `check` signature stays the same.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * @param key      caller identity (e.g. `login:<username>`)
 * @param limit    max attempts within the window
 * @param windowMs sliding window size in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: limit - bucket.hits.length, retryAfterMs: 0 };
}

/** Clear a key's window (e.g. after a successful sign-in). */
export function rateLimitReset(key: string) {
  buckets.delete(key);
}
