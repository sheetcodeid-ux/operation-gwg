import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { listKontrak } from "@/lib/data/hcmos";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { KaryawanBoard, type KaryawanManajemen } from "@/components/hcmos/karyawan-board";

export const metadata: Metadata = { title: "Database Karyawan — HC-MOS" };

export default async function KaryawanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  // Manajemen: apa adanya dari User Management — tanpa tabel karyawan kedua.
  const manajemen: KaryawanManajemen[] = getUsers()
    .map((u) => ({
      id: u.id,
      nama: u.name,
      email: u.email,
      departemen: (u.department ?? "").trim() || "—",
      jabatan: (u.jabatan ?? "").trim() || "—",
      aktif: u.active,
      bergabung: u.createdAt ?? null,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  const outlet = await listKontrak(user);

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

      <KonteksModul panduan="karyawan" />

      <KaryawanBoard manajemen={manajemen} outlet={outlet} />
    </div>
  );
}
