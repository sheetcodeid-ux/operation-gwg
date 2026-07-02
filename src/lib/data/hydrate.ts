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

const g = globalThis as typeof globalThis & { __GWG_HYDRATION__?: Promise<void> };

export function ensureHydrated(): Promise<void> {
  if (!dbEnabled) return Promise.resolve();
  return (g.__GWG_HYDRATION__ ??= hydrate().catch((err) => {
    // Allow a retry on the next request instead of caching the failure forever.
    g.__GWG_HYDRATION__ = undefined;
    console.error("[hydrate] failed — serving in-memory demo data:", err);
  }));
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
