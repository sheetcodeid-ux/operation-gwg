"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data/store";
import { saveNotification } from "@/lib/data/persist";

export async function markNotificationReadAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  // Only a notification within the user's scope may be mutated (no cross-scope IDOR).
  const n = (await listNotifications(user)).find((x) => x.id === id);
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
  for (const n of await listNotifications(user)) {
    if (!n.read) {
      n.read = true;
      saveNotification(n);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Singkirkan satu notifikasi dari daftar.
 *
 * Berbeda dari "sudah dibaca": dibaca berarti sudah dilihat dan tetap ada di
 * daftar; disingkirkan berarti tidak ingin dilihat lagi.
 *
 * Cakupannya diperiksa lewat `listNotifications` — id notifikasi orang lain
 * tidak akan ketemu di sana, sehingga id tebakan tidak bisa dipakai
 * menyingkirkan notifikasi orang lain.
 */
export async function dismissNotificationAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  const n = (await listNotifications(user)).find((x) => x.id === id);
  if (n) {
    n.dismissed = true;
    n.read = true;
    saveNotification(n);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
