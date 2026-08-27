import { ArrowLeft } from "lucide-react";
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
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { KinerjaBoard } from "@/components/hcmos/kinerja-board";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Kinerja & Kompetensi — HC-MOS" };


const PANDUAN_TAB: Record<string, string> = {
  penilaian: "kinerja",
  kompetensi: "kompetensi",
  intervensi: "intervensi",
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

  // Tanpa kepala halaman: bingkai modulnya membawa judul per tab, angka
  // ringkas, pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <KonteksModul panduan={PANDUAN_TAB[tab] ?? "kinerja"} />

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
