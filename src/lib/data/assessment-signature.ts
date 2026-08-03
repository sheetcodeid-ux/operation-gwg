import "server-only";

import { db, dbEnabled } from "./db";
import { listAssignments, listRoster } from "./assessment-roster";
import { getUser } from "./store";
import { orgDepartmentId } from "@/lib/assessment/org";

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

/**
 * Report signatories with their configured TTD. HC & Director are fixed roster
 * slots; the Atasan (Penilai 1) is resolved per participant — from their
 * assignment, else the Head whose scope covers their division — so an uploaded
 * Head signature actually prints instead of leaving a blank line.
 */
export async function getReportSignatories(
  participantUserId?: string,
): Promise<{ hc: Signature | null; director: Signature | null; atasan: Signature | null }> {
  const [roster, sigs] = await Promise.all([listRoster(), listSignatures()]);
  const hcId = roster.find((r) => r.role === "hc" && r.active)?.userId;
  const dirId = roster.find((r) => r.role === "director" && r.active)?.userId;

  let atasanId: string | undefined;
  if (participantUserId) {
    const assigns = await listAssignments();
    atasanId = assigns.find((a) => a.participantUserId === participantUserId)?.atasanUserId ?? undefined;
    if (!atasanId) {
      // No explicit assignment → the Head covering this participant's division.
      const dept = orgDepartmentId(getUser(participantUserId)?.department ?? "");
      if (dept) {
        atasanId = roster.find(
          (r) =>
            r.active &&
            r.userId !== participantUserId &&
            ((r.role === "head" && (r.scopeDepartmentId || orgDepartmentId(getUser(r.userId)?.department ?? "")) === dept) ||
              (!!r.alsoHead && (r.alsoHeadScope || orgDepartmentId(getUser(r.userId)?.department ?? "")) === dept)),
        )?.userId;
      }
    }
  }

  return {
    hc: hcId ? sigs[hcId] ?? null : null,
    director: dirId ? sigs[dirId] ?? null : null,
    atasan: atasanId ? sigs[atasanId] ?? null : null,
  };
}
