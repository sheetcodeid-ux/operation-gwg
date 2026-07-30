"use client";

/**
 * Recovery for stale-deploy chunk-load failures.
 *
 * After a deploy, a browser still holding the previous page shell references JS
 * chunks by hashed filenames that no longer exist on the CDN. The dynamic import
 * then fails with a ChunkLoadError and the nearest error boundary shows — and a
 * soft "restart" doesn't clear it, because the cached shell keeps loading the
 * same dead chunk. Only a hard reload fetches the new shell.
 *
 * `recoverFromChunkError` reloads once when it sees such an error, guarded by a
 * sessionStorage flag so it can never loop (if the reload still fails, we fall
 * through to the normal error UI).
 */

const RELOAD_FLAG = "gwg_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 20_000;

const CHUNK_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /Failed to load resource.*\.js/i,
];

/** Whether an error looks like a stale-chunk / dynamic-import failure. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "ChunkLoadError") return true;
  const msg = String(err.message ?? error);
  return CHUNK_PATTERNS.some((re) => re.test(msg));
}

/** Reload once (hard) when the error is a stale-chunk failure. No-op otherwise,
 *  and no-op if we already reloaded very recently (prevents reload loops). */
export function recoverFromChunkError(error: unknown): void {
  if (typeof window === "undefined") return;
  if (!isChunkLoadError(error)) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // already tried — avoid a loop
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* sessionStorage blocked (private mode) — fall through and still reload once */
  }
  window.location.reload();
}
