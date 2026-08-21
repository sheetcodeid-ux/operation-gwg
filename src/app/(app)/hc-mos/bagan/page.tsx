import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { getUserDepartments } from "@/lib/data/user-departments";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { BaganOrganisasi } from "@/components/hcmos/bagan-organisasi";
import type { SimpulBagan } from "@/lib/hcmos/bagan";

export const metadata: Metadata = { title: "Struktur Organisasi — HC-MOS" };

/**
 * Bagan struktur organisasi — halamannya sendiri.
 *
 * Dulu ia satu seksi di dalam Profil Organisasi, dan itu keliru: bagan dipakai
 * layar penuh dan berlama-lama, sementara isi halaman itu dibaca sekilas.
 * Menumpuk keduanya berarti bagannya selalu terjepit di kotak pendek, dan
 * ringkasan di sekelilingnya selalu terdorong jauh ke bawah.
 *
 * Halamannya sengaja nyaris kosong selain bagannya: tidak ada kartu angka,
 * tidak ada tabel. Yang datang ke sini datang untuk satu hal.
 */
export default async function BaganPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const users = getUsers().filter((u) => u.active);
  const orangPerDep = new Map<string, number>();
  for (const u of users) {
    const dep = (u.department ?? "").trim();
    if (dep) orangPerDep.set(dep, (orangPerDep.get(dep) ?? 0) + 1);
  }

  const simpul: SimpulBagan[] = (await getUserDepartments()).map((d) => ({
    id: d.id,
    nama: d.name,
    level: d.level,
    parentId: d.parentId,
    urutan: d.urutan,
    posX: d.posX,
    posY: d.posY,
    // Jumlah orang dihitung dari profil aktif, tidak pernah diketik. Angka yang
    // diketik di bagan berhenti berubah saat orangnya bertambah, dan tidak ada
    // yang menyadarinya sampai seseorang membandingkannya dengan User Management.
    jumlahOrang: orangPerDep.get(d.name) ?? 0,
    jabatan: d.jabatan,
    deskripsi: d.deskripsi,
  }));

  return (
    <div className="flex w-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/hc-mos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> HC-MOS
        </Link>
        <p className="hidden text-[12px] text-muted-foreground sm:block">
          Role diambil dari daftar departemen di User Management
        </p>
      </div>
      <BaganOrganisasi simpul={simpul} bolehUbah={bolehUbahHc(user)} penuhLayar />
    </div>
  );
}
