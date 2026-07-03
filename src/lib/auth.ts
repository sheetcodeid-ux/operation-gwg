import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { getUser, getUsers } from "./data/store";
import { ensureHydrated } from "./data/hydrate";
import type { UserProfile } from "./types";

export const SESSION_COOKIE = "gwg_uid";

/** Session lifetime — the signed token self-expires after this window even if
 *  the cookie lingers, so a captured token value cannot be replayed forever. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * HMAC-signing secret, resolved lazily on first use (not at module load, so a
 * missing env var doesn't break `next build`). There is NO insecure fallback in
 * production: signing/verifying a session without a real secret throws, because
 * a known default secret would let anyone forge a super-admin session.
 */
let cachedSecret: string | null = null;
function sessionSecret(): string {
  if (cachedSecret) return cachedSecret;
  const s = process.env.GWG_SESSION_SECRET;
  if (s && s.length >= 16) return (cachedSecret = s);
  if (process.env.NODE_ENV === "production") {
    throw new Error("GWG_SESSION_SECRET is required (>=16 chars) in production.");
  }
  return (cachedSecret = "gwg-dev-secret-change-me-please");
}

function sig(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Signed session token: `<base64url(uid.issuedAtMs)>.<hmac>`. */
export function signSession(uid: string): string {
  const payload = Buffer.from(`${uid}.${Date.now()}`).toString("base64url");
  return `${payload}.${sig(payload)}`;
}

/** Verify signature AND freshness. Returns the uid or null. */
export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const given = value.slice(dot + 1);
  const expected = sig(payload);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString();
  } catch {
    return null;
  }
  const sep = decoded.lastIndexOf(".");
  if (sep <= 0) return null;
  const uid = decoded.slice(0, sep);
  const iat = Number(decoded.slice(sep + 1));
  if (!Number.isFinite(iat) || Date.now() - iat > SESSION_TTL_MS) return null;
  return uid;
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
