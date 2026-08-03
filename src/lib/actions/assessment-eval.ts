"use server";

import { getSessionUser } from "@/lib/auth";
import { getUser } from "@/lib/data/store";
import { getSessionByParticipant } from "@/lib/data/assessment";
import { resolveEvaluatorsFromRoster, listRoster, listAssignments } from "@/lib/data/assessment-roster";
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
  /** Which of MY columns apply to this participant (dual-role → may be 2). */
  myKeys: EvaluatorKey[];
}

const isHeadPos = (jabatan: string) => jabatan.toLowerCase().startsWith("head") || DIRECTOR_ONLY_POSITIONS.includes(jabatan) || jabatan === "Director";

/**
 * The queue of participants this evaluator is responsible for:
 *   Atasan (al)  → normal staff in their division / explicitly assigned to them
 *   HC (hc)      → everyone (Penilai 2 on both panels)
 *   Director (dir) → Heads / director-only positions
 */
export async function getMyAssessmentTargets(mode: "penilaian" | "interview" = "penilaian"): Promise<EvalTarget[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const identities = await resolveEvaluatorsFromRoster(user.id);
  if (identities.length === 0) return [];

  // An Atasan with the default scope assesses their OWN division — mirror the
  // fallback used by the access layer so their queue isn't empty.
  const myDept = getUser(user.id)?.department ?? null;
  const deptFallback = myDept ? orgDepartmentId(myDept) : "";
  // Every `al` hat this account wears → the divisions it heads.
  const alScopes = identities
    .filter((e) => e.evaluatorKey === "al")
    .map((e) => e.scopeDepartmentId || deptFallback)
    .filter(Boolean);
  const myKeySet = new Set(identities.map((e) => e.evaluatorKey));

  const [roster, assigns] = await Promise.all([listRoster(), listAssignments()]);
  const pidSet = new Set<string>();
  // Karyawan AND Heads are participants (Heads are assessed by HC + Director).
  for (const r of roster) if (r.role === "karyawan" || r.role === "head") pidSet.add(r.userId);
  for (const a of assigns) pidSet.add(a.participantUserId);

  // First pass — decide which participants this evaluator is responsible for
  // (cheap, no DB), then batch-load the sessions for just those.
  const pending: { pid: string; name: string; department: string; jabatan: string; head: boolean; keys: EvaluatorKey[] }[] = [];
  for (const pid of pidSet) {
    if (pid === user.id) continue; // never assess yourself
    const acc = getUser(pid);
    if (!acc) continue;
    const jabatan = acc.jabatan ?? "";
    const head = isHeadPos(jabatan);
    const assessedBy: EvaluatorKey[] = head ? ["dir", "hc"] : ["al", "hc"];
    // Which of MY hats are required for this participant.
    const keys = assessedBy.filter((k) => myKeySet.has(k));
    if (keys.length === 0) continue;
    if (keys.includes("al")) {
      const assign = assigns.find((a) => a.participantUserId === pid);
      const assigned = assign?.atasanUserId === user.id;
      const inScope = alScopes.includes(orgDepartmentId(acc.department ?? ""));
      // I'm not this person's Atasan → drop just the `al` hat, keep the rest.
      if (!assigned && !inScope) {
        const rest = keys.filter((k) => k !== "al");
        if (rest.length === 0) continue;
        pending.push({ pid, name: acc.name, department: acc.department ?? "", jabatan, head, keys: rest });
        continue;
      }
    }
    pending.push({ pid, name: acc.name, department: acc.department ?? "", jabatan, head, keys });
  }

  const sessions = await Promise.all(pending.map((p) => getSessionByParticipant(p.pid)));
  const out: EvalTarget[] = pending.map((p, i) => {
    // "Done" is per STEP: Penilaian = all 6 params scored; Interview = 4 dimensions
    // + a recommendation. The two share the row's `submitted` flag, so we derive
    // completion from content instead — otherwise a scored candidate wrongly shows
    // as done in the Interview queue. With two hats, done = ALL my columns done.
    const per = p.keys.map((k) => {
      const row = sessions[i]?.evaluations.find((e) => e.evaluatorKey === k);
      const penilaianFilled = row ? evaluatorFilled(row.scores) : 0;
      const ivFilled = row ? Object.values(row.interview ?? {}).filter((v) => !!v).length : 0;
      return {
        filled: mode === "interview" ? ivFilled : penilaianFilled,
        done: mode === "interview" ? ivFilled >= 4 && !!row?.ivVote : penilaianFilled === 6,
      };
    });
    return {
      participantUserId: p.pid,
      name: p.name,
      department: p.department,
      jabatan: p.jabatan,
      isHead: p.head,
      myKeys: p.keys,
      mineFilled: Math.min(...per.map((x) => x.filled)),
      mineSubmitted: per.every((x) => x.done),
      sessionOpen: !!sessions[i],
    };
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
