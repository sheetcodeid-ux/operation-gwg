import { ArrowLeft, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets, getUsers } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { listKontrak } from "@/lib/data/hcmos";
import { rekapUnit, type ReviewRingkas } from "@/lib/hcmos/penilaian";
import { StatusPenilaian } from "@/components/hcmos/status-penilaian";
import { PageHeader } from "@/components/ui/page-header";
import { KinerjaBoard } from "@/components/hcmos/kinerja-board";
import { Badge } from "@/components/ui/badge";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Kinerja & Kompetensi — HC-MOS" };


/** Halaman ini melayani tiga menu sidebar; judulnya ikut menu yang membukanya
 *  supaya orang tidak merasa mendarat di tempat lain dari yang ia klik. */
const JUDUL_TAB: Record<string, string> = {
  penilaian: "Penilaian Kinerja",
  intervensi: "Request Intervensi",
  kompetensi: "Competency Matrix",
};

const URAIAN_TAB: Record<string, string> = {
  penilaian: "Proses penilaian kinerja periodik untuk karyawan manajemen dan crew outlet.",
  intervensi: "Permintaan intervensi kinerja dari head divisi untuk anggota timnya, atau dari Owner untuk head divisi.",
  kompetensi: "Pemetaan kompetensi karyawan terhadap standar jabatannya.",
};

export default async function KinerjaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "intervensi" || sp.tab === "kompetensi" ? sp.tab : "penilaian";
  const [penilaian, kompetensi, intervensi] = await Promise.all([
    listTabel("hc_reviews"),
    listTabel("hc_competency"),
    listTabel("hc_interventions"),
  ]);
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  // Penyebutnya sengaja datang dari luar tabel penilaian: User Management tahu
  // siapa staf manajemen yang aktif, Kontrak Tracker tahu siapa crew outlet
  // yang kontraknya berjalan. Kalau penyebutnya diambil dari `hc_reviews`,
  // setiap orang yang belum dinilai ikut hilang dan angkanya selalu 100%.
  const kontrak = await listKontrak(user);
  const ringkas: ReviewRingkas[] = penilaian.map((r) => ({
    nama: String(r.nama ?? ""),
    scope: String(r.scope ?? "manajemen"),
    periode: String(r.periode ?? ""),
    status: String(r.status ?? ""),
  }));
  const unit = [
    rekapUnit("Manajemen (GWG)", "manajemen", getUsers().filter((u) => u.active).length, ringkas),
    rekapUnit(`Outlet — ${outlets.length} cabang`, "outlet", kontrak.length, ringkas),
  ];

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={Target}
        title={JUDUL_TAB[tab] ?? JUDUL_TAB.penilaian}
        description={URAIAN_TAB[tab] ?? URAIAN_TAB.penilaian}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">{tab === "kompetensi" ? "Learning & Development" : "Performance Management"}</Badge>
        <Badge tone="neutral">PIC: Riva</Badge>
        <Badge tone="neutral">Scope: Manajemen &amp; Outlet</Badge>
      </div>

      {/* Ringkasan dulu, daftarnya belakangan. Pertanyaan pertama saat periode
          penilaian berjalan selalu "berapa yang sudah dinilai", bukan "siapa
          saja yang sudah". */}
      {tab === "penilaian" ? <StatusPenilaian unit={unit} /> : null}

      <KinerjaBoard
        penilaian={penilaian}
        kompetensi={kompetensi}
        intervensi={intervensi}
        outlets={outlets}
        bolehUbah={bolehUbahHc(user)}
        tabAwal={tab}
      />
    </div>
  );
}
