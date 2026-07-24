import { MonitorCog } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { visibleOutlets } from "@/lib/data/store";
import { listSystemRequests } from "@/lib/data/system";
import { PageHeader } from "@/components/ui/page-header";
import { NewSystemRequestButton, SystemRequestList } from "@/components/system/system-submit";

export const metadata: Metadata = { title: "Pengajuan System" };

export default async function SystemPengajuanPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "sys_submit")) redirect("/dashboard");

  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const rows = await listSystemRequests(user.role === "super_admin" ? undefined : user.id);

  return (
    <div className="w-full">
      <PageHeader
        icon={MonitorCog}
        title="Pengajuan System / IT Support"
        description="Ajukan permintaan fitur, perbaikan bug, akses user, atau kendala perangkat ke tim System Support. Pantau statusnya di sini."
        actions={<NewSystemRequestButton requesterName={user.name} outlets={outlets} />}
      />
      <SystemRequestList rows={rows} />
    </div>
  );
}
