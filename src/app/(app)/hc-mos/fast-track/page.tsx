import { ArrowLeft, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { FastTrackBoard } from "@/components/hcmos/modul-boards";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Fast Start & Fast Track — HC-MOS" };

export default async function FastTrackPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const rows = await listTabel("hc_training_records");
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={Rocket}
        title="Fast Start & Fast Track"
        description="Pelaksanaan program wajib crew outlet per batch — Pre Test, Role Play, dan Post Test, dengan kelulusan minimal 65."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">Learning &amp; Development</Badge>
        <Badge tone="neutral">PIC: Riva</Badge>
        <Badge tone="neutral">Scope: Outlet</Badge>
      </div>

      <FastTrackBoard rows={rows} outlets={outlets} bolehUbah={bolehUbahHc(user)} />

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Kurikulum beserta status tiap modulnya ada di{" "}
        <Link href="/hc-mos/modul" className="text-primary hover:underline">
          Modul Pelatihan (LMS)
        </Link>
        ; halaman ini yang mencatat siapa menjalaninya.
      </p>
    </div>
  );
}
