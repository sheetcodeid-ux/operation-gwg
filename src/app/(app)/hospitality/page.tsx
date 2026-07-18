import { ClipboardList, ConciergeBell, Star, Store, TriangleAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, getUsers, listHospitality, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewAssessmentButton } from "@/components/hospitality/assessment-form";
import { HospitalityExplorer, type HospitalityRow } from "@/components/hospitality/hospitality-explorer";

export const metadata: Metadata = { title: "Hospitality Assessment" };

export default async function HospitalityPage() {
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

  const rows: HospitalityRow[] = assessments.map((a) => ({
    id: a.id,
    staffName: a.staffName,
    staffPosition: a.staffPosition,
    outletId: a.outletId,
    outlet: outletName(a.outletId),
    areaId: a.areaId,
    area: areaName(a.areaId),
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
        title="Hospitality Assessment"
        description="Service quality scoring across cashier, F&B and dining area"
        actions={canCreate && outlets.length > 0 ? <NewAssessmentButton outlets={outlets} supervisors={supervisors} defaultAssessorId={user.role === "supervisor" ? user.id : undefined} /> : undefined}
      />

      {canCreate && outlets.length === 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>Belum ada outlet yang ditugaskan ke akun Anda, jadi assessment belum bisa dibuat. Minta Admin menugaskan outlet Anda di <span className="font-semibold">User Management</span> (Edit akun → pilih Outlet).</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Star} label="Average Score" value={avg.toFixed(1)} tone="brand" />
        <StatTile icon={ClipboardList} label="Assessments" value={assessments.length} tone="cyan" />
        <StatTile icon={Users} label="Staff Evaluated" value={distinctStaff} tone="amber" />
        <StatTile icon={Store} label="Outlets Covered" value={`${distinctOutlets}/${outlets.length}`} tone="success" />
      </div>

      <div className="mt-4">
        <HospitalityExplorer rows={rows} outlets={outlets} canDelete={user.role === "super_admin"} />
      </div>
    </div>
  );
}
