import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { AppraisalBoard } from "@/components/hcmos/appraisal-board";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Appraisal Review — HC-MOS" };

export default async function AppraisalPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_appraisal")) redirect("/dashboard");

  const rows = await listTabel("hc_appraisal_sessions");

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={ClipboardList}
        title="Appraisal Review"
        description="Sesi peninjauan hasil appraisal bersama atasan langsung, sebelum penilaiannya difinalisasi."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">Performance Management</Badge>
        <Badge tone="neutral">PIC: Riva</Badge>
        <Badge tone="neutral">Scope: Manajemen &amp; Outlet</Badge>
      </div>

      <AppraisalBoard rows={rows} bolehUbah={bolehUbahHc(user)} />

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Sesi di sini dijadwalkan untuk sekelompok orang di akhir periode penilaian. Bila ada satu orang yang kinerjanya
        turun di tengah periode, jalurnya bukan halaman ini melainkan{" "}
        <Link href="/hc-mos/kinerja?tab=intervensi" className="text-primary hover:underline">
          Request Intervensi
        </Link>
        .
      </p>
    </div>
  );
}
