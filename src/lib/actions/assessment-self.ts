"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getUser } from "@/lib/data/store";
import { orgDepartmentId } from "@/lib/assessment/org";
import { getOrCreateSession, getSessionByParticipant, updateSessionMeta } from "@/lib/data/assessment";
import { resolveAssessmentAccess } from "@/lib/data/assessment-access";
import type { ParamScores } from "@/lib/assessment/config";
import type { SessionSeed } from "@/lib/assessment/session";

export interface SelfIdentity {
  golongan: string;
  golonganTujuan: string;
  batch: string;
  nik: string;
}

/** The signed-in participant's own self-assessment context (their session, if any). */
export async function getMySelf(): Promise<{
  isParticipant: boolean;
  identity: SelfIdentity;
  selfScores: ParamScores;
  submitted: boolean;
} | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const access = await resolveAssessmentAccess({ id: user.id, role: user.role, department: user.department });
  const session = await getSessionByParticipant(user.id);
  return {
    isParticipant: access.isParticipant,
    identity: {
      golongan: session?.golongan ?? "",
      golonganTujuan: session?.golonganTujuan ?? "",
      batch: session?.batch ?? "",
      nik: session?.nik ?? "",
    },
    selfScores: session?.selfScores ?? {},
    submitted: !!session && Object.keys(session.selfScores ?? {}).length > 0,
  };
}

/** Save the signed-in participant's own Self Assessment + promotion identity.
 *  Creates/opens their session (keyed by their account) so evaluators, HC and
 *  the dashboard all see it. */
export async function saveMySelfAssessmentAction(input: {
  selfScores: ParamScores;
  golongan: string;
  golonganTujuan: string;
  batch: string;
  nik: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Tidak ada sesi login." };
  const access = await resolveAssessmentAccess({ id: user.id, role: user.role, department: user.department });
  if (!access.isParticipant) return { ok: false, error: "Akun ini bukan peserta assessment." };
  const acc = getUser(user.id);
  if (!acc) return { ok: false, error: "Akun tidak ditemukan." };

  const seed: SessionSeed = {
    batch: input.batch || "",
    nik: input.nik || "",
    participantUserId: user.id,
    employeeName: acc.name,
    jabatan: acc.jabatan ?? "",
    departmentId: acc.department ? orgDepartmentId(acc.department) : "",
    departmentName: acc.department ?? "",
    golongan: input.golongan || "",
    golonganTujuan: input.golonganTujuan || "",
    directorOnly: false,
  };
  const session = await getOrCreateSession(seed, user.id);
  // The participant owns these fields — write them authoritatively.
  await updateSessionMeta(session.id, {
    selfScores: input.selfScores,
    golongan: input.golongan,
    golonganTujuan: input.golonganTujuan,
    batch: input.batch,
    nik: input.nik,
  });
  revalidatePath("/assessment");
  return { ok: true };
}
