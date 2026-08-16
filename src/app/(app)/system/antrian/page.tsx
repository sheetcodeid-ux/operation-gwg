import { Headset } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { getUsers } from "@/lib/data/store";
import { listSystemRequests } from "@/lib/data/system";
import { isSystemSupport, SYSTEM_SUPPORT_DEPT, SYSTEM_SUPPORT_JABATAN } from "@/lib/system-shared";
import { PageHeader } from "@/components/ui/page-header";
import { HelpdeskPanel } from "@/components/system/helpdesk-panel";

export const metadata: Metadata = { title: "Antrian System — System Support" };

export default async function SystemAntrianPage() {
  const user = await requireSessionUser();
  // Only the System Support team (Operational + jabatan System Support) or Admin.
  if (!isSystemSupport(user)) redirect("/dashboard");

  const rows = await listSystemRequests("system");
  // Handlers = the System Support team (department Operational, jabatan System Support).
  const handlers = getUsers()
    .filter((u) => u.department === SYSTEM_SUPPORT_DEPT && (u.jabatan ?? "").trim().toLowerCase() === SYSTEM_SUPPORT_JABATAN.toLowerCase())
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full">
      <PageHeader
        icon={Headset}
        title="Antrian System"
        description="Tiket perangkat & POS dari cabang. Tinjau, tentukan penanggung jawab, lalu teruskan ke Work Tracker untuk dikerjakan."
      />
      <HelpdeskPanel rows={rows} handlers={handlers} canDelete={user.role === "super_admin"} />
    </div>
  );
}
