import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
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

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas, dan
  // panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <KonteksModul panduan="modul" />

      <ModulPelatihanBoard rekaman={rekaman} />
    </div>
  );
}
