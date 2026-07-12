import "server-only";

import { db, dbEnabled } from "./db";
import { DEFAULT_SETTINGS, mergeSettings, type OpsSettings } from "@/lib/ops/settings-types";

let mem: OpsSettings = DEFAULT_SETTINGS;

export async function getOpsSettings(): Promise<OpsSettings> {
  if (!dbEnabled) return mem;
  try {
    const { data } = await db().from("op_settings").select("data").eq("id", "default").maybeSingle();
    return mergeSettings(data?.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveOpsSettings(settings: OpsSettings): Promise<void> {
  const clean = mergeSettings(settings);
  if (!dbEnabled) {
    mem = clean;
    return;
  }
  const { error } = await db().from("op_settings").upsert({ id: "default", data: clean, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`gagal simpan pengaturan: ${error.message}`);
}
