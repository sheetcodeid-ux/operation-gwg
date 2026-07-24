import { FolderInput } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { listHcSubmissions } from "@/lib/data/hc";
import { PageHeader } from "@/components/ui/page-header";
import { HcReviewPanel } from "@/components/hc/hc-review";

export const metadata: Metadata = { title: "Antrian Dokumen — Human Capital" };

export default async function HcAntrianPage() {
  const user = (await getSessionUser())!;
  if (!canOpenMenu(user.role, "hc_review", user.grants)) redirect("/dashboard");

  const rows = await listHcSubmissions();

  return (
    <div className="w-full">
      <PageHeader
        icon={FolderInput}
        title="Antrian Dokumen"
        description="Tinjau & proses pengajuan dokumen dari seluruh cabang, lalu kirim dokumen jadi kembali ke Supervisor."
      />
      <HcReviewPanel rows={rows} />
    </div>
  );
}
