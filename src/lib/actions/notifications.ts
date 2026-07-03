"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data/store";
import { saveNotification } from "@/lib/data/persist";

export async function markNotificationReadAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  // Only a notification within the user's scope may be mutated (no cross-scope IDOR).
  const n = listNotifications(user).find((x) => x.id === id);
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
  for (const n of listNotifications(user)) {
    if (!n.read) {
      n.read = true;
      saveNotification(n);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
