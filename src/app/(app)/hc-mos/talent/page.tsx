import { ArrowLeft, Award } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { PageHeader } from "@/components/ui/page-header";
import { TalentBoard } from "@/components/hcmos/modul-boards";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Talent & Karier — HC-MOS" };

export default async function TalentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const [karier, suksesi] = await Promise.all([listTabel("hc_career_paths"), listTabel("hc_succession")]);

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={Award}
        title="Talent & Career Management"
        description="Jenjang karier tiap jabatan dan rencana suksesi untuk posisi kunci."
      />
      <TalentBoard
        karier={karier}
        suksesi={suksesi}
        bolehUbah={bolehUbahHc(user)}
        tabAwal={sp.tab === "suksesi" ? "suksesi" : "karier"}
      />
    </div>
  );
}
