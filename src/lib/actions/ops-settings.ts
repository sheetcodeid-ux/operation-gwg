"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canUseOpsFinance as canEdit } from "@/lib/ops/access";
import { saveOpsSettings } from "@/lib/data/ops-settings";
import type { OpsSettings } from "@/lib/ops/settings-types";

export async function saveSettingsAction(settings: OpsSettings) {
  const user = await getSessionUser();
  if (!canEdit(user)) return { error: "Tidak berwenang." };
  try {
    await saveOpsSettings(settings);
    revalidatePath("/operation/settings");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}
