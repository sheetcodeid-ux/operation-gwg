import "server-only";

import { SEED } from "./seed";
import { registerCredential, setPassword } from "./credentials";
import { getUser } from "./store";
import { saveUser } from "./persist";
import type { Role, UserProfile } from "../types";

/** Admin user-management writes (demo). Phase 11: Supabase Auth admin API + profiles table. */

let counter = 7000;
const nextId = () => `usr_${++counter}`;

export function createUser(input: {
  name: string;
  email: string;
  role: Role;
  areaId?: string | null;
  outletIds?: string[];
  password: string;
}): UserProfile {
  const user: UserProfile = {
    id: nextId(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    areaId: input.areaId ?? null,
    outletIds: input.outletIds ?? [],
    avatarUrl: null,
    active: true,
    createdAt: new Date().toISOString(),
  };
  SEED.users.push(user);
  saveUser(user);
  registerCredential(user.id, user.email, input.password);
  return user;
}

export function setUserActive(id: string, active: boolean) {
  const user = getUser(id);
  if (!user) return;
  user.active = active;
  saveUser(user);
}

export function setUserAssignment(id: string, patch: { areaId?: string | null; outletIds?: string[] }) {
  const user = getUser(id);
  if (!user) return;
  if (patch.areaId !== undefined) user.areaId = patch.areaId;
  if (patch.outletIds !== undefined) user.outletIds = patch.outletIds;
  saveUser(user);
}

export function resetUserPassword(id: string, password: string) {
  setPassword(id, password);
}

export function emailExists(email: string) {
  return SEED.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}
