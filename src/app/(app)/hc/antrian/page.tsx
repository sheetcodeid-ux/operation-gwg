import { FileCheck2, FileClock, Inbox, Loader } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listHcSubmissions } from "@/lib/data/hc";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { HcReviewPanel } from "@/components/hc/hc-review";
import { StatTile } from "@/components/ui/stat";
import { HC_STATUS_META } from "@/lib/hc-shared";

export const metadata: Metadata = { title: "Antrian Dokumen — Human Capital" };

export default async function HcAntrianPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_review")) redirect("/dashboard");

  const rows = await listHcSubmissions({ withKtp: true });

  // Dihitung sekali di sini dan dipakai kartu ringkas; panel di bawah menghitung
  // ulang untuk saringannya sendiri, dan itu memang beda urusan.
  const hitung = { waiting: 0, processing: 0, pending: 0, done: 0, rejected: 0 };
  for (const r of rows) hitung[r.status] += 1;

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas,
  // pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <KonteksModul panduan="hc_antrian" />


      {/* Ringkasan di atas, antreannya di bawah.
          Yang ditanyakan orang saat membuka halaman ini bukan "berkas siapa yang
          paling atas", melainkan "berapa banyak yang menunggu saya" — dan itu
          tidak terjawab oleh daftar sepanjang apa pun. */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Inbox} label="Antrean Masuk" value={rows.length} sub="seluruh status" />
        <StatTile icon={FileClock} label={HC_STATUS_META.waiting.label} value={hitung.waiting} sub="belum disentuh" />
        <StatTile icon={Loader} label={HC_STATUS_META.processing.label} value={hitung.processing} sub="sedang dikerjakan" />
        <StatTile icon={FileClock} label={HC_STATUS_META.pending.label} value={hitung.pending} sub="berkasnya kurang" />
        <StatTile icon={FileCheck2} label={HC_STATUS_META.done.label} value={hitung.done} sub="sudah dikirim balik" />
      </div>

      <HcReviewPanel rows={rows} canDelete={user.role === "super_admin"} />
    </div>
  );
}
