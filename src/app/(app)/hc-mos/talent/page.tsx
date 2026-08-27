import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { TalentBoard } from "@/components/hcmos/modul-boards";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { JenjangKarier } from "@/components/hcmos/jenjang-karier";
import { JENJANG_MANAJEMEN, JENJANG_OUTLET } from "@/lib/hcmos/struktur";

export const metadata: Metadata = { title: "Talent & Karier — HC-MOS" };

export default async function TalentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "suksesi" ? "suksesi" : "karier";
  const [karier, suksesi] = await Promise.all([listTabel("hc_career_paths"), listTabel("hc_succession")]);

  // Tanpa kepala halaman: bingkai modulnya membawa judul per tab, angka
  // ringkas, pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <KonteksModul panduan="talent" />

      {/* Tangganya dulu, daftarnya belakangan. Yang ditanyakan orang saat
          membuka Career Path adalah "dari posisi saya, ke mana saya bisa naik"
          — pertanyaan tentang urutan, bukan tentang isi tabel. */}
      {tab === "karier" && (
        <>
          <JenjangKarier
            judul="Jenjang Karier Outlet"
            ringkas="Berlaku seragam di seluruh brand — jalur posisi operasional"
            jenjang={JENJANG_OUTLET}
          />
          <JenjangKarier
            judul="Jenjang Karier Manajemen"
            ringkas="Jalur posisi kantor pusat"
            jenjang={JENJANG_MANAJEMEN}
          />
        </>
      )}
      <TalentBoard
        karier={karier}
        suksesi={suksesi}
        bolehUbah={bolehUbahHc(user)}
        tabAwal={tab}
      />
    </div>
  );
}
