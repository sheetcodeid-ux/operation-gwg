"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getUser } from "@/lib/data/store";
import { orgDepartmentId } from "@/lib/assessment/org";
import { getOrCreateSession, getSessionByParticipant } from "@/lib/data/assessment";
import { listAssignments, listPeerReviews, savePeerReview } from "@/lib/data/assessment-roster";
import type { ParamScores } from "@/lib/assessment/config";
import type { SessionSeed } from "@/lib/assessment/session";

/** One participant this signed-in user reviews as a Rekan Sejawat (Penilai 3). */
export interface PeerTarget {
  participantUserId: string;
  name: string;
  department: string;
  jabatan: string;
  /** A session already exists for this participant. */
  sessionOpen: boolean;
  /** This reviewer already submitted their peer review. */
  submitted: boolean;
  /** How many of the 6 parameters this reviewer has filled. */
  filled: number;
  scores: ParamScores;
  note: string;
}

const filledCount = (s: ParamScores) => Object.values(s).filter((v) => !!v).length;

/** The participants the signed-in user is assigned to review as a peer. */
export async function getMyPeerTargets(): Promise<PeerTarget[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const assigns = await listAssignments();
  const pids = assigns.filter((a) => a.peerUserIds.includes(user.id)).map((a) => a.participantUserId);
  const out: PeerTarget[] = [];
  for (const pid of pids) {
    const acc = getUser(pid);
    if (!acc) continue;
    const session = await getSessionByParticipant(pid);
    let submitted = false;
    let scores: ParamScores = {};
    let note = "";
    if (session) {
      const mine = (await listPeerReviews(session.id)).find((r) => r.reviewerUserId === user.id);
      if (mine) {
        submitted = mine.submitted;
        scores = mine.scores;
        note = mine.note;
      }
    }
    out.push({
      participantUserId: pid,
      name: acc.name,
      department: acc.department ?? "",
      jabatan: acc.jabatan ?? "",
      sessionOpen: !!session,
      submitted,
      filled: filledCount(scores),
      scores,
      note,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Save/submit the signed-in peer's own review for a participant. Verifies the
 *  caller is actually an assigned Rekan Sejawat for that participant. */
export async function submitMyPeerReview(input: {
  participantUserId: string;
  scores?: ParamScores;
  note?: string;
  submitted?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Tidak ada sesi login." };

  const assigns = await listAssignments();
  const allowed = assigns.some((a) => a.participantUserId === input.participantUserId && a.peerUserIds.includes(user.id));
  if (!allowed) return { ok: false, error: "Anda bukan rekan sejawat penilai karyawan ini." };

  const acc = getUser(input.participantUserId);
  if (!acc) return { ok: false, error: "Data peserta tidak ditemukan." };

  const seed: SessionSeed = {
    batch: "",
    nik: "",
    participantUserId: input.participantUserId,
    employeeName: acc.name,
    jabatan: acc.jabatan ?? "",
    departmentId: acc.department ? orgDepartmentId(acc.department) : "",
    departmentName: acc.department ?? "",
    golongan: "",
    golonganTujuan: "",
    directorOnly: false,
  };
  const session = await getOrCreateSession(seed, user.id);
  await savePeerReview({
    sessionId: session.id,
    reviewerUserId: user.id,
    scores: input.scores,
    note: input.note,
    submitted: input.submitted,
  });
  revalidatePath("/assessment");
  return { ok: true };
}
