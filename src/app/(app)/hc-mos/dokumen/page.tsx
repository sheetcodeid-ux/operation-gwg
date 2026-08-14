import { ArrowLeft, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listDokumen } from "@/lib/data/hcmos-dokumen";
import { JENIS_DOKUMEN, type JenisDokumen } from "@/lib/hcmos/dokumen";
import { PageHeader } from "@/components/ui/page-header";
import { DokumenBoard } from "@/components/hcmos/dokumen-board";

export const metadata: Metadata = { title: "Pusat Dokumen — HC-MOS" };

export default async function DokumenPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string; pilar?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  // Tautan dari halaman pilar membawa jenis & pilarnya — dokumen yang dicari
  // langsung terbuka, tanpa pengunjung harus menyaring sendiri dua kali.
  const jenis = (JENIS_DOKUMEN as readonly string[]).includes(sp.jenis ?? "")
    ? (sp.jenis as JenisDokumen)
    : "sop";

  const rows = await listDokumen();
  const bolehUbah =
    user.role === "super_admin" || user.role === "legal" || user.department === "Human Capital";

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={ScrollText}
        title="Pusat Dokumen"
        description="SOP tiap pilar, kebijakan, culture & value, dokumen kepatuhan, dan PKS kemitraan."
      />
      <DokumenBoard rows={rows} jenisAwal={jenis} pilarAwal={sp.pilar ?? ""} bolehUbah={bolehUbah} />
    </div>
  );
}
