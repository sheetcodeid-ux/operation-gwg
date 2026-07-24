import { Headset } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu, ROLE_DIVISION } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { listSystemRequests } from "@/lib/data/system";
import { PageHeader } from "@/components/ui/page-header";
import { SystemReviewPanel } from "@/components/system/system-review";

export const metadata: Metadata = { title: "Antrian System — System Support" };

export default async function SystemAntrianPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "sys_review")) redirect("/dashboard");

  const rows = await listSystemRequests();
  // Handlers = the Operation (System Support) team — Operation-role users plus
  // members whose department sits in the Operation division.
  const handlers = getUsers()
    .filter((u) => ROLE_DIVISION[u.role] === "Operation" || u.department === "Operational")
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full">
      <PageHeader
        icon={Headset}
        title="Antrian System"
        description="Tinjau permintaan System/IT dari cabang, tentukan penanggung jawab, lalu teruskan ke Work Tracker untuk dikerjakan."
      />
      <SystemReviewPanel rows={rows} handlers={handlers} canDelete={user.role === "super_admin"} />
    </div>
  );
}
