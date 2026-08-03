import { Award, Clock, Lock, Settings2, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canSeeMenu, hasMenuGrant } from "@/lib/nav";
import { getMyEvaluators } from "@/lib/actions/assessment";
import { dbEnabled } from "@/lib/data/db";
import { getOrgExtra } from "@/lib/data/org";
import { getAssessmentSchedule } from "@/lib/data/assessment-schedule";
import { resolveAssessmentAccess } from "@/lib/data/assessment-access";
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
  // Viewpoint is derived from the assessment ROSTER settings — the single source
  // of truth. An account that isn't in the roster (and isn't assigned as a
  // peer/atasan) gets no access, fixing the old full-HR-fallback bug.
  const access = await resolveAssessmentAccess({ id: user.id, role: user.role, department: user.department });
  const inRoster = access.role !== "none";
  // Can navigate here via role menu / grant, or by being in the roster.
  if (!canSeeMenu(user.role, "assessment") && !hasMenuGrant(user.grants, "assessment") && !inRoster) redirect("/dashboard");

  // Session-scoring identity (al/hc/dir) — only Heads/HC/Director; peers use the
  // peer-review path. Super Admin keeps the manual viewpoint switcher.
  // Every hat this account wears — an HC/Director who also heads a division
  // scores two columns, so the workspace needs the full list, not just the first.
  const evaluators = await getMyEvaluators();
  const evaluator = evaluators[0] ?? null;
  const isAdmin = user.role === "super_admin";
  // Pengaturan is Admin-only (owner decision) — HC/Director can assess but not
  // reconfigure who takes part.
  const canManage = isAdmin;
  const [orgExtra, schedule] = await Promise.all([getOrgExtra(), getAssessmentSchedule()]);
  const windowOpen = canAccessAssessment({ role: user.role, jabatan: user.jabatan, department: user.department }, schedule);
  const allowed = windowOpen && inRoster;
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
        <AssessmentWorkspace initialRole={access.role} scopeDepartmentId={access.scopeDepartmentId} isParticipant={access.isParticipant} evaluator={evaluator} evaluators={evaluators} peerCount={access.peerFor.length} isAdmin={isAdmin} canManage={canManage} viewer={{ userId: user.id, name: user.name, department: user.department ?? null, jabatan: user.jabatan ?? null }} viewerName={user.name} showSample={!dbEnabled} orgExtra={orgExtra} />
      ) : !inRoster ? (
        <div className="glass mt-2 flex flex-col items-center gap-3 rounded-2xl border border-border px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <UserX className="size-6" />
          </div>
          <p className="text-lg font-semibold text-foreground">Akun belum terdaftar di assessment</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Akun Anda belum didaftarkan sebagai peserta atau penilai. Hubungi Human Capital / Admin untuk didaftarkan di <span className="font-medium text-foreground">Pengaturan Assessment</span>.
          </p>
          {canManage && (
            <Link href="/assessment/settings" className="mt-1 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
              <Settings2 className="size-4" /> Buka Pengaturan
            </Link>
          )}
        </div>
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
