import { ClipboardList, ConciergeBell, Star, Store, Users } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { areaName, listHospitality, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatTile } from "@/components/ui/stat";
import { NewAssessmentButton } from "@/components/hospitality/assessment-form";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Hospitality Assessment" };

export default async function HospitalityPage() {
  const user = (await getSessionUser())!;
  const assessments = listHospitality(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_hospitality");

  const avg = assessments.length
    ? Math.round((assessments.reduce((a, b) => a + b.overallScore, 0) / assessments.length) * 10) / 10
    : 0;
  const distinctStaff = new Set(assessments.map((a) => a.staffName)).size;
  const distinctOutlets = new Set(assessments.map((a) => a.outletId)).size;
  const best = [...assessments].sort((a, b) => b.overallScore - a.overallScore)[0];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        icon={ConciergeBell}
        title="Hospitality Assessment"
        description="Service quality scoring across cashier, F&B and dining area"
        actions={canCreate && outlets.length > 0 ? <NewAssessmentButton outlets={outlets} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Star} label="Average Score" value={avg.toFixed(1)} tone="brand" />
        <StatTile icon={ClipboardList} label="Assessments" value={assessments.length} tone="cyan" />
        <StatTile icon={Users} label="Staff Evaluated" value={distinctStaff} tone="amber" />
        <StatTile icon={Store} label="Outlets Covered" value={`${distinctOutlets}/${outlets.length}`} tone="success" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Assessments</CardTitle>
          <CardDescription>
            {best ? `Top performer: ${best.staffName} (${best.overallScore.toFixed(1)})` : "No assessments yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <EmptyState
              icon={ConciergeBell}
              title="No assessments recorded"
              description={
                canCreate
                  ? "Create your first hospitality assessment to start tracking service quality."
                  : "Assessments created by Area Coordinators will appear here."
              }
            />
          ) : (
            <div className="space-y-1">
              {assessments.slice(0, 20).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40"
                >
                  <Avatar name={a.staffName} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.staffName} · <span className="text-muted-foreground">{a.staffPosition}</span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {outletName(a.outletId)} · {areaName(a.areaId)} · {formatDate(a.date)}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[11px] text-muted-foreground">Assessor</p>
                    <p className="text-xs text-foreground/80">{userName(a.assessorId)}</p>
                  </div>
                  <ScoreRing value={a.overallScore} size={44} stroke={5} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
