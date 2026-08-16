import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { visibleOutlets } from "@/lib/data/store";
import { listSystemRequests } from "@/lib/data/system";
import { PageHeader } from "@/components/ui/page-header";
import { NewSystemRequestButton, SystemRequestList } from "@/components/system/system-submit";

export const metadata: Metadata = { title: "IT Help Desk" };

/**
 * Meja IT Help Desk — kendala pada APLIKASI INI.
 *
 * Terpisah dari "Pengajuan System" dengan sengaja: yang itu soal perangkat &
 * POS di cabang dan ditangani tim System Support. Dua-duanya IT, tapi yang
 * mengerjakan orang yang berbeda — digabung berarti keluhan printer kasir dan
 * permintaan fitur web menumpuk di antrean yang sama.
 */
export default async function ItHelpdeskPengajuanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "it_submit")) redirect("/dashboard");

  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const rows = await listSystemRequests("helpdesk", user.role === "super_admin" ? undefined : user.id);

  return (
    <div className="w-full">
      <PageHeader
        icon={LifeBuoy}
        title="IT Help Desk"
        description="Laporkan kendala pada aplikasi ini — error, data keliru, hak akses, atau permintaan fitur. Setiap laporan dapat nomor tiket dan bisa Anda pantau sampai selesai."
        actions={
          <NewSystemRequestButton
            desk="helpdesk"
            requesterName={user.name}
            requesterPosition={(user.jabatan ?? "").trim() || user.department || "—"}
            outlets={outlets}
          />
        }
      />
      <SystemRequestList rows={rows} />
    </div>
  );
}
