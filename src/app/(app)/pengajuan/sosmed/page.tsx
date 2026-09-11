import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listHcRequests } from "@/lib/data/hc-requests";
import { requestScopeFor } from "@/lib/data/request-scope";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestList, NewRequestButton } from "@/components/hc/request-submit";
import { JEDA_TENGGAT_UPLOAD } from "@/lib/kpi/deadline";

export const metadata: Metadata = { title: "Pengajuan Design Sosial Media" };

/**
 * Pengajuan materi konten — form tersendiri, bukan saringan di atas form umum.
 *
 * Yang membedakannya bukan siapa yang meminta melainkan APA yang diminta:
 * materi konten sudah punya tanggal tayang di kalender, sedangkan materi
 * operasional datang saat dibutuhkan. Dulu keduanya dibedakan dengan menebak
 * departemen pemohonnya, dan tebakan itu salah di dua arah — Marketing
 * Communication juga meminta poster cetak, dan tim lain juga meminta materi
 * untuk diunggah. Dua form membuat pemohonnya sendiri yang memutuskan.
 */
export default async function PengajuanSosmedPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "sosmed_request")) redirect("/dashboard");

  const rows = (await listHcRequests({ ...requestScopeFor(user), kind: "design" })).filter(
    (r) => r.designKanal === "sosmed",
  );

  return (
    <div className="w-full">
      <PageHeader
        icon={Megaphone}
        title="Pengajuan Design Sosial Media"
        description={`Isi tanggal tayangnya — tenggat desain dihitung otomatis ${JEDA_TENGGAT_UPLOAD} hari sebelumnya.`}
        actions={<NewRequestButton kind="design" kanal="sosmed" />}
      />
      <HcRequestList rows={rows} kind="design" canDelete={user.role === "super_admin"} meId={user.id} />
    </div>
  );
}
