import { ArrowLeft, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listKandidat, listOnboarding } from "@/lib/data/hcmos-rekrutmen";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { RekrutmenBoard } from "@/components/hcmos/rekrutmen-board";

export const metadata: Metadata = { title: "Rekrutmen — HC-MOS" };

export default async function RekrutmenPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  // Data kandidat memuat kontak orang yang belum bekerja di sini — hanya HC.
  const bolehHc =
    user.role === "super_admin" || user.role === "legal" || user.department === "Human Capital";

  const sp = await searchParams;

  if (!bolehHc) {
    return (
      <div className="w-full">
        <PageHeader icon={UserPlus} title="Rekrutmen" description="Kandidat, jadwal wawancara, dan onboarding." />
        <EmptyState
          icon={UserPlus}
          title="Halaman ini khusus Human Capital"
          description="Berisi data pribadi pelamar yang belum menjadi karyawan, jadi aksesnya dibatasi."
        />
      </div>
    );
  }

  const [kandidat, onboarding] = await Promise.all([listKandidat(), listOnboarding()]);
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={UserPlus}
        title="Rekrutmen & Seleksi"
        description="Satu berkas per kandidat: melamar, diwawancara, diterima, lalu menjalani orientasi."
        actions={<PanduanModul panduan="rekrutmen" />}
      />

      <KonteksModul panduan="rekrutmen" />
      <RekrutmenBoard
        kandidat={kandidat}
        onboarding={onboarding}
        outlets={outlets}
        bolehUbah
        tabAwal={sp.tab === "interview" || sp.tab === "onboarding" ? sp.tab : "kandidat"}
      />
    </div>
  );
}
