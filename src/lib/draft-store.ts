"use client";

/**
 * Offline-safe form drafts.
 *
 * Field staff fill Hygiene/Hospitality forms on weak mobile signal. A dropped
 * connection used to lose every captured photo and force a full re-do. Drafts
 * live in IndexedDB — not localStorage — because IndexedDB stores `File`/`Blob`
 * values natively via structured clone, so photos survive a reload untouched.
 *
 * Everything degrades quietly: if IndexedDB is unavailable (private mode, old
 * browser), the helpers no-op and the form behaves exactly as before.
 */

const DB_NAME = "gwg-drafts";
const STORE = "forms";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export interface DraftEnvelope<T> {
  savedAt: number;
  data: T;
}

/** Persist a draft under `key`. Safe to call on every keystroke (debounce it). */
export async function saveDraft<T>(key: string, data: T): Promise<void> {
  await withStore("readwrite", (s) => s.put({ savedAt: Date.now(), data } satisfies DraftEnvelope<T>, key));
}

/** Read a draft; `maxAgeMs` drops anything stale (default 3 days). */
export async function loadDraft<T>(key: string, maxAgeMs = 3 * 24 * 60 * 60 * 1000): Promise<DraftEnvelope<T> | null> {
  const env = await withStore<DraftEnvelope<T>>("readonly", (s) => s.get(key));
  if (!env || typeof env.savedAt !== "number") return null;
  if (Date.now() - env.savedAt > maxAgeMs) {
    void clearDraft(key);
    return null;
  }
  return env;
}

export async function clearDraft(key: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(key));
}

/** "2 menit lalu" style label for the restore banner. */
export function draftAge(savedAt: number): string {
  const mins = Math.round((Date.now() - savedAt) / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}
