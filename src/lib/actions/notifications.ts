"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { SEED } from "@/lib/data/seed";
import { saveNotification } from "@/lib/data/persist";

export async function markNotificationReadAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  const n = SEED.notifications.find((x) => x.id === id);
  if (n) {
    n.read = true;
    saveNotification(n);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  for (const n of SEED.notifications) {
    if (!n.read) {
      n.read = true;
      saveNotification(n);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
