"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { SEED } from "@/lib/data/seed";

export async function markNotificationReadAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  const n = SEED.notifications.find((x) => x.id === id);
  if (n) n.read = true;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  for (const n of SEED.notifications) n.read = true;
  revalidatePath("/", "layout");
  return { ok: true };
}
