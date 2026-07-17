import "server-only";

import { db, dbEnabled } from "./db";
import { listRoster } from "./assessment-roster";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A signatory's TTD — printed name + optional signature image (data URL). */
export interface Signature {
  name: string;
  image: string | null;
}

const mem = new Map<string, Signature>();

export async function listSignatures(): Promise<Record<string, Signature>> {
  if (!dbEnabled) return Object.fromEntries(mem);
  try {
    const { data } = await db().from("assessment_signature").select("user_id,name,image");
    const out: Record<string, Signature> = {};
    for (const r of (data ?? []) as any[]) out[r.user_id] = { name: r.name ?? "", image: r.image ?? null };
    return out;
  } catch {
    return {};
  }
}

export async function saveSignature(userId: string, name: string, image: string | null): Promise<void> {
  const rec: Signature = { name: (name ?? "").trim().slice(0, 80), image: image || null };
  if (!dbEnabled) {
    mem.set(userId, rec);
    return;
  }
  await db().from("assessment_signature").upsert({ user_id: userId, name: rec.name, image: rec.image, updated_at: new Date().toISOString() });
}

/** The two fixed report signatories (HC & Director) resolved from the roster,
 *  with their configured TTD. Returns null for a slot that isn't set up. */
export async function getReportSignatories(): Promise<{ hc: Signature | null; director: Signature | null }> {
  const [roster, sigs] = await Promise.all([listRoster(), listSignatures()]);
  const hcId = roster.find((r) => r.role === "hc" && r.active)?.userId;
  const dirId = roster.find((r) => r.role === "director" && r.active)?.userId;
  return {
    hc: hcId ? sigs[hcId] ?? null : null,
    director: dirId ? sigs[dirId] ?? null : null,
  };
}
