import { ClipboardList, ConciergeBell, Star, Store, TriangleAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { getUsers, listHospitality, outletCoordinatorName, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewAssessmentButton } from "@/components/hospitality/assessment-form";
import { HospitalityExplorer, type HospitalityRow } from "@/components/hospitality/hospitality-explorer";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Hospitality Assessment" };

export default async function HospitalityPage() {
  const t = await getT();
  const user = (await getSessionUser())!;
  const assessments = listHospitality(user);
  const visible = visibleOutlets(user);
  const outlets = visible.map((o) => ({ id: o.id, name: o.name }));
  // Supervisors covering the visible outlets (assessor = the SPV doing the visit).
  const supervisorIds = new Set(visible.map((o) => o.supervisorId));
  const supervisors = getUsers()
    .filter((u) => u.role === "supervisor" && (supervisorIds.has(u.id) || u.id === user.id))
    .map((c) => ({ id: c.id, name: c.name }));
  if (user.role === "supervisor" && !supervisors.some((s) => s.id === user.id)) supervisors.unshift({ id: user.id, name: user.name });
  const canCreate = can(user, "create_hospitality");
  // Hospitality scores are hidden from Supervisors — only Master Admin and the
  // relevant Coordinator Area may see the numbers. (Hygiene is NOT hidden.)
  const canViewScore = user.role === "super_admin" || user.role === "area_coordinator";

  const rows: HospitalityRow[] = assessments.map((a) => ({
    id: a.id,
    staffName: a.staffName,
    staffPosition: a.staffPosition,
    outletId: a.outletId,
    outlet: outletName(a.outletId),
    areaId: a.areaId,
    area: outletCoordinatorName(a.outletId),
    assessor: userName(a.assessorId),
    date: a.date,
    score: a.overallScore,
  }));

  const avg = assessments.length
    ? Math.round((assessments.reduce((a, b) => a + b.overallScore, 0) / assessments.length) * 10) / 10
    : 0;
  const distinctStaff = new Set(assessments.map((a) => a.staffName)).size;
  const distinctOutlets = new Set(assessments.map((a) => a.outletId)).size;

  return (
    <div className="w-full">
      <PageHeader
        icon={ConciergeBell}
        title={t("hosp.title")}
        description={t("hosp.description")}
        actions={canCreate && outlets.length > 0 ? <NewAssessmentButton outlets={outlets} supervisors={supervisors} defaultAssessorId={user.role === "supervisor" ? user.id : undefined} canViewScore={canViewScore} /> : undefined}
      />

      {canCreate && outlets.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{t("hosp.noOutlet")}</span>
        </div>
      )}

      <div className={`grid grid-cols-2 gap-3 ${canViewScore ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {canViewScore && <StatTile icon={Star} label={t("hosp.avgScore")} value={avg.toFixed(1)} tone="brand" />}
        <StatTile icon={ClipboardList} label={t("hosp.assessments")} value={assessments.length} tone="cyan" />
        <StatTile icon={Users} label={t("hosp.staffEvaluated")} value={distinctStaff} tone="amber" />
        <StatTile icon={Store} label={t("hosp.outletsCovered")} value={`${distinctOutlets}/${outlets.length}`} tone="success" />
      </div>

      <div className="mt-4">
        <HospitalityExplorer rows={rows} outlets={outlets} canDelete={user.role === "super_admin"} canViewScore={canViewScore} />
      </div>
    </div>
  );
}
