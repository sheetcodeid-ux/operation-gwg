import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

  // Signed cookie FIRST. Every successful sign-in mints it (see actions/auth.ts),
  // including Supabase sign-ins, so it is the authoritative session for this app
  // and verifying it costs one HMAC — no network. Asking GoTrue first meant a
  // round trip to Supabase Auth on EVERY render and action, and once the access
  // token expired every one of those also burned a failing token refresh
  // ("Invalid Refresh Token"). Both are gone now.
  const store = await cookies();
  const uid = verifySession(store.get(SESSION_COOKIE)?.value);
  if (uid) {
    const user = getUser(uid);
    if (user && user.active) return user;
  }

  // No valid signed cookie — fall back to the Supabase session, and only when
  // its cookies are actually present (otherwise there is nothing to verify).
  if (isSupabaseConfigured && store.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))) {
    const supabase = await createSupabaseServerClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    const email = data?.user?.email?.toLowerCase();
    if (email) {
      const profile = getUsers().find((u) => u.email.toLowerCase() === email);
      if (profile && profile.active) return profile;
    }
  }

  return null;
}

/**
 * Sama seperti `getSessionUser()`, tapi mengarahkan ke halaman login kalau
 * sesinya sudah tidak sah. Ini yang HARUS dipakai setiap halaman.
 *
 * Sebelumnya halaman menulis `(await getSessionUser())!`. Tanda seru itu cuma
 * meyakinkan TypeScript, tidak mengubah apa pun saat aplikasi berjalan: begitu
 * sesi kedaluwarsa, nilainya benar-benar null lalu halaman menabrak
 * `user.role` dan pengguna melihat layar error. Redirect di layout tidak
 * menolongnya karena layout dan halaman dirender BERSAMAAN — halamannya sudah
 * telanjur gagal sebelum redirect sempat berlaku.
 *
 * `/clear-session` menghapus semua cookie sesi (gwg_uid dan sb-*) lalu
 * melempar ke /login, jadi sesi basi tidak memicu redirect berputar.
 */
export async function requireSessionUser(): Promise<UserProfile> {
  const user = await getSessionUser();
  if (!user) redirect("/clear-session");
  return user;
}
