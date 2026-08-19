import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ModulPelatihanBoard } from "@/components/hcmos/modul-pelatihan-board";
import { bacaRekamanPelatihan } from "@/lib/hcmos/pelatihan-baca";

export const metadata: Metadata = { title: "Modul Pelatihan (LMS) — HC-MOS" };

/**
 * Modul Pelatihan (LMS) — sisi Learning & Development.
 *
 * Bedanya dengan Self-Learning: halaman ini melihat KURIKULUM dan siapa yang
 * sudah menjalaninya; Self-Learning adalah tempat karyawan mengerjakannya.
 * Dulu kedua menu itu sama-sama menuju /elearning, jadi satu di antaranya
 * tidak pernah menampilkan apa pun yang berbeda dari yang lain.
 */
export default async function ModulPelatihanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_modul")) redirect("/dashboard");

  const rekaman = bacaRekamanPelatihan(await listTabel("hc_training_records"));

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={BookOpen}
        title="Modul Pelatihan (LMS)"
        description="Kurikulum pelatihan Manajemen dan Outlet beserta pelaksanaannya — modul mana yang sudah berjalan, siapa saja pesertanya."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">Learning &amp; Development</Badge>
        <Badge tone="neutral">PIC: Riva</Badge>
        <Badge tone="neutral">Scope: Manajemen &amp; Outlet</Badge>
      </div>

      <ModulPelatihanBoard rekaman={rekaman} />
    </div>
  );
}
