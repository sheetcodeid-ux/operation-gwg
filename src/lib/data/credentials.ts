import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SEED } from "./seed";
import { getUser } from "./store";
import { saveCredential, syncAuthUser } from "./persist";

/**
 * Demo credential store (in-memory). Username = email. Passwords are hashed
 * with salted scrypt (`scrypt$<saltHex>$<hashHex>`). Legacy unsalted SHA-256
 * hashes are still accepted at sign-in and transparently re-hashed on success.
 * Admin provisions/resets passwords; status (active) is enforced at sign-in.
 * Phase 11 (live): replace with Supabase Auth admin API.
 */

const DEFAULT_PASSWORD = "gwg2026!";
const SCRYPT_KEYLEN = 64;

/** Salted scrypt hash, self-describing so verification needs no external salt. */
function hash(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verify against either the new scrypt format or a legacy sha256. */
function verifyHash(password: string, stored: string): boolean {
  if (stored.startsWith("scrypt$")) {
    const [, saltHex, hashHex] = stored.split("$");
    if (!saltHex || !hashHex) return false;
    const derived = scryptSync(password, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
  // Legacy unsalted sha256 — compared in constant time.
  const legacy = createHash("sha256").update(password).digest();
  const expected = Buffer.from(stored, "hex");
  return legacy.length === expected.length && timingSafeEqual(legacy, expected);
}

function isLegacy(stored: string) {
  return !stored.startsWith("scrypt$");
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
  if (!cred || !verifyHash(password, cred.passwordHash)) return { ok: false, reason: "invalid" };
  const user = getUser(cred.userId);
  if (!user || !user.active) return { ok: false, reason: "inactive" };
  // Transparently upgrade a legacy unsalted hash to salted scrypt on success.
  if (isLegacy(cred.passwordHash)) {
    const upgraded = { ...cred, passwordHash: hash(password) };
    byUsername.set(username, upgraded);
    saveCredential(upgraded);
  }
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
