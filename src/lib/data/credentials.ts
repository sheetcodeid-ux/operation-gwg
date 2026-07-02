import "server-only";
import { createHash } from "node:crypto";
import { SEED } from "./seed";
import { getUser } from "./store";
import { saveCredential, syncAuthUser } from "./persist";

/**
 * Demo credential store (in-memory). Username = email. Passwords are hashed.
 * Admin provisions/resets passwords; status (active) is enforced at sign-in.
 * Phase 11 (live): replace with Supabase Auth admin API.
 */

const DEFAULT_PASSWORD = "gwg2026!";

function hash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

interface Credential {
  userId: string;
  username: string; // lowercased email
  passwordHash: string;
}

const byUsername = new Map<string, Credential>();

// Seed: every user can sign in with the default password until admin changes it.
for (const u of SEED.users) {
  const username = u.email.toLowerCase();
  byUsername.set(username, { userId: u.id, username, passwordHash: hash(DEFAULT_PASSWORD) });
}

export type SignInResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "inactive" };

export function verifyCredentials(usernameRaw: string, password: string): SignInResult {
  const username = usernameRaw.trim().toLowerCase();
  const cred = byUsername.get(username);
  if (!cred || cred.passwordHash !== hash(password)) return { ok: false, reason: "invalid" };
  const user = getUser(cred.userId);
  if (!user || !user.active) return { ok: false, reason: "inactive" };
  return { ok: true, userId: cred.userId };
}

/** Admin: set/reset a user's password. */
export function setPassword(userId: string, password: string) {
  const user = getUser(userId);
  if (!user) return;
  const cred = { userId, username: user.email.toLowerCase(), passwordHash: hash(password) };
  byUsername.set(cred.username, cred);
  saveCredential(cred);
  syncAuthUser(cred.username, password);
}

/** Admin: register credentials for a newly created user. */
export function registerCredential(userId: string, email: string, password: string) {
  const cred = { userId, username: email.toLowerCase(), passwordHash: hash(password) };
  byUsername.set(cred.username, cred);
  saveCredential(cred);
  syncAuthUser(cred.username, password);
}

/** Hydration: snapshot all credentials (for the first push to Supabase). */
export function snapshotCredentials(): Credential[] {
  return [...byUsername.values()];
}

/** Hydration: replace the in-memory credential store with DB rows. */
export function loadCredentials(rows: Credential[]) {
  byUsername.clear();
  for (const c of rows) byUsername.set(c.username, c);
}

export const DEMO_PASSWORD = DEFAULT_PASSWORD;
