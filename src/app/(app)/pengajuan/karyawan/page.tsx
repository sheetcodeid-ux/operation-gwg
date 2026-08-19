import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listHcRequests } from "@/lib/data/hc-requests";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { scopeBawaan } from "@/lib/hc-request";
import { requestScopeFor } from "@/lib/data/request-scope";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestList, NewRequestButton } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Permintaan Karyawan" };

export default async function PermintaanKaryawanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");

  const rows = await listHcRequests({ ...requestScopeFor(user), kind: "rekrutmen" });

  // Cabang yang boleh dipilih = cabang yang memang dipegang orangnya. Menawarkan
  // seluruh outlet berarti mengundang permintaan atas nama cabang orang lain —
  // dan yang menanggung anggarannya cabang yang tidak pernah memintanya.
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="w-full">
      <PageHeader
        icon={UserPlus}
        title="Permintaan Karyawan"
        description="Ajukan penambahan atau pengganti pegawai ke tim Human Capital — untuk divisi (Manajemen) maupun cabang (Outlet). Status persetujuan terlihat di setiap kartu."
        actions={<NewRequestButton kind="rekrutmen" outlets={outlets} scopeAwal={scopeBawaan(user.role)} />}
      />
      <HcRequestList rows={rows} kind="rekrutmen" canDelete={user.role === "super_admin"} meId={user.id} />
    </div>
  );
}
