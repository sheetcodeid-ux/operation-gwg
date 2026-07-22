import "server-only";

import { db, dbEnabled } from "./db";
import { SEED } from "./seed";
import { loadCredentials, snapshotCredentials } from "./credentials";
import {
  areaFromRow,
  areaToRow,
  complaintFromRow,
  complaintToRow,
  eventFromRow,
  eventToRow,
  hospitalityFromRow,
  hospitalityToRow,
  hygieneFromRow,
  hygieneToRow,
  notificationFromRow,
  notificationToRow,
  outletFromRow,
  outletToRow,
  taskFromRow,
  taskToRow,
  userFromRow,
  userToRow,
} from "./rows";

/**
 * Boot-time hydration for the persistent data layer.
 *
 * - First boot (empty DB): pushes the generated demo seed to Supabase once.
 * - Every later boot: loads all tables and REPLACES the contents of the SEED
 *   arrays in place, so every existing reference (store.ts, mutations.ts, the
 *   globalThis seed cache) sees the persisted data with zero signature changes.
 *
 * Called from `getSessionUser()` — the single entry point every server render
 * and action goes through — so reads never observe a pre-hydration store.
 */

const g = globalThis as typeof globalThis & {
  __GWG_HYDRATION__?: { at: number; inflight: Promise<void> | null };
};

/**
 * Re-read from the database at most once per window. Previously hydration ran
 * exactly once per process, so a serverless instance served a boot-time
 * snapshot and never saw writes made by other instances. With a short TTL the
 * in-memory arrays become a fresh cache and the database is the source of
 * truth: every instance converges within TTL of any write.
 */
const HYDRATION_TTL_MS = 3000;

export function ensureHydrated(): Promise<void> {
  if (!dbEnabled) return Promise.resolve();
  const state = (g.__GWG_HYDRATION__ ??= { at: 0, inflight: null });
  // First-ever load has no data yet → must block. Once we have a snapshot
  // (at > 0) reads are served from the in-memory cache immediately and the
  // refresh runs in the background (stale-while-revalidate), so navigating
  // between pages never waits on the 10-table re-read.
  const firstLoad = state.at === 0;
  if (state.inflight) return firstLoad ? state.inflight : Promise.resolve();
  if (Date.now() - state.at < HYDRATION_TTL_MS) return Promise.resolve(); // fresh enough
  const p = hydrate()
    .then(() => {
      state.at = Date.now();
    })
    .catch((err) => {
      // Leave `at` unchanged so the next request retries; serve last-known data.
      console.error("[hydrate] failed — serving last-known data:", err);
    })
    .finally(() => {
      state.inflight = null;
    });
  state.inflight = p;
  return firstLoad ? p : Promise.resolve();
}

/**
 * Called by the persistence layer right after a local write. It marks the cache
 * fresh so the next re-hydration is deferred by one TTL — giving the async DB
 * write time to land before we reload, which prevents a just-created row from
 * momentarily flickering out of view on the instance that created it.
 */
export function markLocalWrite() {
  const state = (g.__GWG_HYDRATION__ ??= { at: 0, inflight: null });
  state.at = Date.now();
}

function replaceInPlace<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

async function hydrate() {
  const supabase = db();
  // Emptiness probe via a real row fetch (count:exact/head proved unreliable
  // in the build environment and a false "empty" would re-push the seed,
  // clobbering edits to seeded rows).
  const { data: probe, error: probeError } = await supabase.from("users").select("id").limit(1);
  if (probeError) throw new Error(probeError.message);

  if (!probe || probe.length === 0) {
    await pushSeed();
    return;
  }

  const get = async (table: string) => {
    const { data, error } = await supabase.from(table).select("*").limit(10000);
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };

  const [users, creds, areas, outlets, hospitality, tasks, events, hygiene, complaints, notifications] =
    await Promise.all([
      get("users"),
      get("credentials"),
      get("areas"),
      get("outlets"),
      get("hospitality"),
      get("tasks"),
      get("events"),
      get("hygiene"),
      get("complaints"),
      get("notifications"),
    ]);

  replaceInPlace(SEED.users, users.map(userFromRow));
  replaceInPlace(SEED.areas, areas.map(areaFromRow));
  replaceInPlace(SEED.outlets, outlets.map(outletFromRow));
  replaceInPlace(SEED.hospitality, hospitality.map(hospitalityFromRow));
  replaceInPlace(
    SEED.tasks,
    tasks.map(taskFromRow).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  );
  replaceInPlace(SEED.events, events.map(eventFromRow));
  replaceInPlace(SEED.hygiene, hygiene.map(hygieneFromRow));
  replaceInPlace(SEED.complaints, complaints.map(complaintFromRow));
  replaceInPlace(
    SEED.notifications,
    notifications.map(notificationFromRow).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  );
  loadCredentials(
    creds.map((r: { user_id: string; username: string; password_hash: string }) => ({
      userId: r.user_id,
      username: r.username,
      passwordHash: r.password_hash,
    })),
  );

  console.log(`[hydrate] loaded from Supabase: ${users.length} users, ${tasks.length} tasks, ${complaints.length} complaints`);
}

async function pushSeed() {
  const supabase = db();
  // Upsert (not insert) so concurrent first boots — e.g. several build workers
  // racing the empty-table check — converge on the same rows instead of failing.
  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).upsert(rows.slice(i, i + 500));
      if (error) throw new Error(`seed ${table}: ${error.message}`);
    }
  };

  // FK order: users → areas → outlets → everything referencing outlets.
  await insert("users", SEED.users.map(userToRow));
  await insert(
    "credentials",
    snapshotCredentials().map((c) => ({ user_id: c.userId, username: c.username, password_hash: c.passwordHash })),
  );
  await insert("areas", SEED.areas.map(areaToRow));
  await insert("outlets", SEED.outlets.map(outletToRow));
  await insert("hospitality", SEED.hospitality.map(hospitalityToRow));
  await insert("tasks", SEED.tasks.map(taskToRow));
  await insert("events", SEED.events.map(eventToRow));
  await insert("hygiene", SEED.hygiene.map(hygieneToRow));
  await insert("complaints", SEED.complaints.map(complaintToRow));
  await insert("notifications", SEED.notifications.map(notificationToRow));

  console.log("[hydrate] first boot — demo seed pushed to Supabase");
}
