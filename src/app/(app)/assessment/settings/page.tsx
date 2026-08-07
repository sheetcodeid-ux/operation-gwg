import { Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { getUsers } from "@/lib/data/store";
import { getOrgExtra } from "@/lib/data/org";
import { allDepartments, setOrgExtras } from "@/lib/assessment/org";
import { listAssignments, listRoster } from "@/lib/data/assessment-roster";
import { PageHeader } from "@/components/ui/page-header";
import { AssessmentSettings, type AccountOption } from "@/components/assessment/settings";

export const metadata: Metadata = { title: "Pengaturan Assessment" };

/** Who may open the settings: Super Admin, HC, or Director. */
export default async function AssessmentSettingsPage() {
  const user = await requireSessionUser();
  // Admin-only (owner decision).
  if (user.role !== "super_admin") redirect("/assessment");

  setOrgExtras(await getOrgExtra());
  const [roster, assignments] = await Promise.all([listRoster(), listAssignments()]);

  const accounts: AccountOption[] = getUsers()
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, department: u.department ?? null, jabatan: u.jabatan ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const departments = allDepartments().map((d) => ({ value: d.id, label: d.name }));

  const initialRoster = Object.fromEntries(roster.map((r) => [r.userId, { role: r.role, scopeDepartmentId: r.scopeDepartmentId }]));
  const initialAssignments = Object.fromEntries(
    assignments.map((a) => [a.participantUserId, { atasanUserId: a.atasanUserId, peerUserIds: a.peerUserIds }]),
  );

  return (
    <div className="w-full space-y-4">
      <PageHeader
        icon={Settings2}
        title="Pengaturan Assessment"
        description="Tentukan siapa yang mengikuti assessment, atasan penilai, dan rekan sejawat — berdasarkan akun User Management"
      />
      <AssessmentSettings
        accounts={accounts}
        departments={departments}
        initialRoster={initialRoster}
        initialAssignments={initialAssignments}
      />
    </div>
  );
}
