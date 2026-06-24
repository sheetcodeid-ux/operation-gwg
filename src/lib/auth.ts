import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { getUser, getUsers } from "./data/store";
import type { UserProfile } from "./types";

export const SESSION_COOKIE = "gwg_uid";

/**
 * Resolve the current user.
 * - Supabase mode: map the authenticated session to a profile (Phase 11).
 * - Demo mode: read the selected user id from the session cookie.
 * Returns null when not signed in.
 */
export async function getSessionUser(): Promise<UserProfile | null> {
  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!data?.user) return null;
    // Phase 11: join to a `profiles` row. For now match by email.
    return getUsers().find((u) => u.email === data.user!.email) ?? null;
  }

  const store = await cookies();
  const uid = store.get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  return getUser(uid) ?? null;
}

/** Like getSessionUser but throws/redirects responsibility to caller. */
export async function requireUser(): Promise<UserProfile | null> {
  return getSessionUser();
}
