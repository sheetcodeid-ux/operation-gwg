import { Award } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canSeeMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentWorkspace } from "@/components/assessment/workspace";

export const metadata: Metadata = { title: "Assessment Kenaikan Golongan" };

export default async function AssessmentPage() {
  const user = (await getSessionUser())!;
  if (!canSeeMenu(user.role, "assessment")) redirect("/dashboard");

  return (
    <div className="w-full">
      <PageHeader
        icon={Award}
        title="Assessment Kenaikan Golongan"
        description="Sistem penilaian kenaikan golongan HRD — multi-penilai, self assessment, interview & keputusan final"
      />
      <AssessmentWorkspace />
    </div>
  );
}
