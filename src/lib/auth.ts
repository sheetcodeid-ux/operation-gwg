import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { getUser, getUsers } from "./data/store";
import { ensureHydrated } from "./data/hydrate";
import type { UserProfile } from "./types";

export const SESSION_COOKIE = "gwg_uid";

/** HMAC-signed session value: `uid.signature`. An unsigned/forged uid cookie
 *  is rejected, so sessions can only be minted by the server after sign-in. */
const SESSION_SECRET = process.env.GWG_SESSION_SECRET ?? "gwg-dev-secret-change-me";

function sig(uid: string) {
  return createHmac("sha256", SESSION_SECRET).update(uid).digest("base64url");
}

export function signSession(uid: string): string {
  return `${uid}.${sig(uid)}`;
}

export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const uid = value.slice(0, dot);
  const given = value.slice(dot + 1);
  const expected = sig(uid);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? uid : null;
}

/**
 * Resolve the current user.
 * - Supabase mode: map the authenticated session to a profile (Phase 11).
 * - Demo mode: read the selected user id from the session cookie.
 * Returns null when not signed in.
 */
export async function getSessionUser(): Promise<UserProfile | null> {
  // Load persisted data (Supabase) before any read — no-op in pure demo mode.
  await ensureHydrated();

  if (isSupabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (data?.user) {
      const profile = getUsers().find((u) => u.email.toLowerCase() === data.user!.email?.toLowerCase());
      if (profile && profile.active) return profile;
      return null; // authenticated in GoTrue but no active profile
    }
    // No/expired Supabase session — fall through to the signed cookie so
    // sessions survive access-token expiry (hybrid mode).
  }

  const store = await cookies();
  const uid = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const user = getUser(uid);
  return user && user.active ? user : null;
}

/** Like getSessionUser but throws/redirects responsibility to caller. */
export async function requireUser(): Promise<UserProfile | null> {
  return getSessionUser();
}
