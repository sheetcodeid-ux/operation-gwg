import { Award, Clock, Lock } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canSeeMenu, hasMenuGrant } from "@/lib/nav";
import { getMyEvaluator } from "@/lib/actions/assessment";
import { dbEnabled } from "@/lib/data/db";
import { getOrgExtra } from "@/lib/data/org";
import { getAssessmentSchedule } from "@/lib/data/assessment-schedule";
import { assessmentPhase, canAccessAssessment } from "@/lib/assessment/window";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentWorkspace } from "@/components/assessment/workspace";
import { ScheduleEditor } from "@/components/assessment/schedule-editor";

export const metadata: Metadata = { title: "Assessment Kenaikan Golongan" };

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export default async function AssessmentPage() {
  const user = (await getSessionUser())!;
  // Role's own menu OR an explicit per-user grant (incl. custom divisions).
  // Supervisor has no assessment menu → blocked here.
  if (!canSeeMenu(user.role, "assessment") && !hasMenuGrant(user.grants, "assessment")) redirect("/dashboard");

  // Role viewpoint comes from the signed-in identity: registered evaluators land
  // on their own view; only Super Admin keeps the manual switcher.
  const evaluator = await getMyEvaluator();
  const isAdmin = user.role === "super_admin";
  const [orgExtra, schedule] = await Promise.all([getOrgExtra(), getAssessmentSchedule()]);
  const allowed = canAccessAssessment({ role: user.role, jabatan: user.jabatan }, schedule);
  const phase = assessmentPhase(schedule);

  return (
    <div className="w-full">
      <PageHeader
        icon={Award}
        title="Assessment Kenaikan Golongan"
        description="Sistem penilaian kenaikan golongan HRD — multi-penilai, self assessment, interview & keputusan final"
      />

      {isAdmin && <ScheduleEditor initial={schedule} />}

      {allowed ? (
        /* In production (DB live) show only real sessions; sample data is demo-only. */
        <AssessmentWorkspace evaluator={evaluator} isAdmin={isAdmin} viewerName={user.name} showSample={!dbEnabled} orgExtra={orgExtra} />
      ) : (
        <div className="glass mt-2 flex flex-col items-center gap-3 rounded-2xl border border-border px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            {phase === "before" ? <Clock className="size-6" /> : <Lock className="size-6" />}
          </div>
          {phase === "before" ? (
            <>
              <p className="text-lg font-semibold text-foreground">Assessment belum dibuka</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Periode assessment dimulai <span className="font-medium text-foreground">{fmt(schedule.startAt)}</span>. Silakan kembali saat jadwal dibuka.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-foreground">Periode assessment telah selesai</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Assessment ditutup pada <span className="font-medium text-foreground">{fmt(schedule.endAt)}</span>. Setelah periode selesai, hanya Head, Director &amp; Legal yang dapat mengakses untuk proses interview & keputusan.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
