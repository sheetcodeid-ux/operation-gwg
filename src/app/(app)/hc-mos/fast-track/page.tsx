import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { FastTrackBoard } from "@/components/hcmos/modul-boards";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Fast Start & Fast Track — HC-MOS" };

export default async function FastTrackPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const rows = await listTabel("hc_training_records");
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas,
  // pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <KonteksModul panduan="fast-track" />

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
