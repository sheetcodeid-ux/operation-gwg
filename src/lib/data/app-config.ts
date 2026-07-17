import "server-only";

import { db, dbEnabled } from "./db";

/** Read one value from the `app_config` key/value store (null when missing). */
export async function getAppConfig(key: string): Promise<string | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("app_config").select("value").eq("key", key).maybeSingle();
  return (data as { value: string } | null)?.value ?? null;
}

/** Write one value to the `app_config` key/value store. */
export async function setAppConfig(key: string, value: string): Promise<void> {
  if (!dbEnabled) return;
  await db().from("app_config").upsert({ key, value, updated_at: new Date().toISOString() });
}
