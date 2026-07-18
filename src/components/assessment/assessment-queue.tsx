"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { getMyAssessmentTargets, type EvalTarget } from "@/lib/actions/assessment-eval";
import { useAssessment } from "./context";
import { AssessmentQueueList, type QueueItem } from "./queue-list";

/** Queue of participants the signed-in evaluator must assess — split into
 *  Antrian (belum) & Selesai (terkunci). Pick a name to start scoring (reuses
 *  the session flow). Renders nothing when there are no assigned participants. */
export function AssessmentQueue({ verb = "dinilai" }: { verb?: string }) {
  const a = useAssessment();
  const [targets, setTargets] = React.useState<EvalTarget[] | null>(null);
  const selectedId = a.candidate.employeeId.startsWith("emp_usr_") ? a.candidate.employeeId.slice("emp_usr_".length) : "";

  React.useEffect(() => {
    let live = true;
    getMyAssessmentTargets().then((t) => { if (live) setTargets(t); });
    return () => { live = false; };
  }, [a.candidate.employeeId]);

  if (targets === null) {
    return <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat antrian…</div>;
  }
  if (targets.length === 0) return null;

  const items: QueueItem[] = targets.map((t) => ({
    id: t.participantUserId,
    name: t.name,
    department: t.department,
    jabatan: t.jabatan,
    filled: t.mineFilled,
    submitted: t.mineSubmitted,
    isHead: t.isHead,
  }));

  return (
    <AssessmentQueueList
      items={items}
      selectedId={selectedId}
      verb={verb}
      onPick={(it) => a.pickParticipant(it.id, it.department, it.jabatan)}
    />
  );
}
