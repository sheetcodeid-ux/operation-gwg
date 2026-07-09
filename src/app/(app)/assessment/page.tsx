import { Award } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canSeeMenu, hasMenuGrant } from "@/lib/nav";
import { getMyEvaluator } from "@/lib/actions/assessment";
import { dbEnabled } from "@/lib/data/db";
import { getOrgExtra } from "@/lib/data/org";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentWorkspace } from "@/components/assessment/workspace";

export const metadata: Metadata = { title: "Assessment Kenaikan Golongan" };

export default async function AssessmentPage() {
  const user = (await getSessionUser())!;
  // Role's own menu OR an explicit per-user grant (incl. custom divisions).
  if (!canSeeMenu(user.role, "assessment") && !hasMenuGrant(user.grants, "assessment")) redirect("/dashboard");

  // Role viewpoint comes from the signed-in identity: registered evaluators land
  // on their own view; only Super Admin keeps the manual switcher.
  const evaluator = await getMyEvaluator();
  const isAdmin = user.role === "super_admin";
  const orgExtra = await getOrgExtra();

  return (
    <div className="w-full">
      <PageHeader
        icon={Award}
        title="Assessment Kenaikan Golongan"
        description="Sistem penilaian kenaikan golongan HRD — multi-penilai, self assessment, interview & keputusan final"
      />
      {/* In production (DB live) show only real sessions; sample data is demo-only. */}
      <AssessmentWorkspace evaluator={evaluator} isAdmin={isAdmin} viewerName={user.name} showSample={!dbEnabled} orgExtra={orgExtra} />
    </div>
  );
}
