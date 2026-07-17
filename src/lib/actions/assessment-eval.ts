"use server";

import { getSessionUser } from "@/lib/auth";
import { getUser } from "@/lib/data/store";
import { getSessionByParticipant } from "@/lib/data/assessment";
import { resolveEvaluatorFromRoster, listRoster, listAssignments } from "@/lib/data/assessment-roster";
import { orgDepartmentId } from "@/lib/assessment/org";
import { DIRECTOR_ONLY_POSITIONS, evaluatorFilled, type EvaluatorKey } from "@/lib/assessment/config";

/** A participant the signed-in official evaluator (Atasan/HC/Director) must assess. */
export interface EvalTarget {
  participantUserId: string;
  name: string;
  department: string;
  jabatan: string;
  isHead: boolean;
  /** How many of the 6 parameters THIS evaluator has filled. */
  mineFilled: number;
  mineSubmitted: boolean;
  sessionOpen: boolean;
}

const isHeadPos = (jabatan: string) => jabatan.toLowerCase().startsWith("head") || DIRECTOR_ONLY_POSITIONS.includes(jabatan) || jabatan === "Director";

/**
 * The queue of participants this evaluator is responsible for:
 *   Atasan (al)  → normal staff in their division / explicitly assigned to them
 *   HC (hc)      → everyone (Penilai 2 on both panels)
 *   Director (dir) → Heads / director-only positions
 */
export async function getMyAssessmentTargets(): Promise<EvalTarget[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const me = await resolveEvaluatorFromRoster(user.id);
  if (!me) return [];

  const [roster, assigns] = await Promise.all([listRoster(), listAssignments()]);
  const pidSet = new Set<string>();
  // Karyawan AND Heads are participants (Heads are assessed by HC + Director).
  for (const r of roster) if (r.role === "karyawan" || r.role === "head") pidSet.add(r.userId);
  for (const a of assigns) pidSet.add(a.participantUserId);

  // First pass — decide which participants this evaluator is responsible for
  // (cheap, no DB), then batch-load the sessions for just those.
  const pending: { pid: string; name: string; department: string; jabatan: string; head: boolean }[] = [];
  for (const pid of pidSet) {
    const acc = getUser(pid);
    if (!acc) continue;
    const jabatan = acc.jabatan ?? "";
    const head = isHeadPos(jabatan);
    const assessedBy: EvaluatorKey[] = head ? ["dir", "hc"] : ["al", "hc"];
    if (!assessedBy.includes(me.evaluatorKey)) continue;
    if (me.evaluatorKey === "al") {
      const assign = assigns.find((a) => a.participantUserId === pid);
      const assigned = assign?.atasanUserId === user.id;
      const inScope = me.scopeDepartmentId ? orgDepartmentId(acc.department ?? "") === me.scopeDepartmentId : false;
      if (!assigned && !inScope) continue;
    }
    pending.push({ pid, name: acc.name, department: acc.department ?? "", jabatan, head });
  }

  const sessions = await Promise.all(pending.map((p) => getSessionByParticipant(p.pid)));
  const out: EvalTarget[] = pending.map((p, i) => {
    const row = sessions[i]?.evaluations.find((e) => e.evaluatorKey === me.evaluatorKey);
    return {
      participantUserId: p.pid,
      name: p.name,
      department: p.department,
      jabatan: p.jabatan,
      isHead: p.head,
      mineFilled: row ? evaluatorFilled(row.scores) : 0,
      mineSubmitted: !!row?.submitted,
      sessionOpen: !!sessions[i],
    };
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
