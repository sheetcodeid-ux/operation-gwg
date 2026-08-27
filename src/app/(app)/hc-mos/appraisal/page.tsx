import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { AppraisalBoard } from "@/components/hcmos/appraisal-board";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Appraisal Review — HC-MOS" };

export default async function AppraisalPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_appraisal")) redirect("/dashboard");

  const rows = await listTabel("hc_appraisal_sessions");

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas,
  // pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <KonteksModul panduan="appraisal" />

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
