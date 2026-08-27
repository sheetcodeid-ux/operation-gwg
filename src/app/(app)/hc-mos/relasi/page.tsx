import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets, getUsers } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { listKontrak } from "@/lib/data/hcmos";
import { perluDitutup, type KasusOffboarding } from "@/lib/hcmos/offboarding";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { RelasiBoard } from "@/components/hcmos/modul-boards";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Hubungan Industrial — HC-MOS" };

export default async function RelasiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "keluar" ? "keluar" : "kasus";

  // Kasus hubungan industrial menyangkut nama orang beserta perkaranya —
  // dibaca terbatas, bukan konsumsi umum.
  if (!bolehUbahHc(user)) {
    return (
      <div className="w-full">
        <PageHeader icon={MessageSquare} title="Employee & Industrial Relations" description="Penanganan kasus dan proses keluar karyawan." />
        <EmptyState
          icon={MessageSquare}
          title="Halaman ini khusus Human Capital"
          description="Berisi perkara kepegawaian yang menyebut nama karyawan."
        />
      </div>
    );
  }

  const semua = await listTabel("hc_cases");
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  // Daftar orang untuk penunjuk di formulir offboarding. Menunjuk dengan id —
  // bukan mengetik nama — itulah yang membuat penutupan otomatis boleh
  // dipercaya: dua karyawan bernama sama bukan hal aneh di perusahaan seratusan
  // orang, dan salah tebak berarti mengunci orang yang masih bekerja.
  const kontrak = await listKontrak(user);
  const orangManajemen = getUsers()
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: `${u.name}${u.department ? ` · ${u.department}` : ""}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  const orangOutlet = kontrak
    .filter((k) => !k.keluar)
    .map((k) => ({ id: k.id, name: `${k.nama}${k.outletName ? ` · ${k.outletName}` : ""}` }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  // Jaring pengaman: perkara yang sudah ditandai selesai tapi jejaknya belum
  // tuntas. Penutupan otomatis hanya berlaku untuk perkara yang disimpan
  // SESUDAH fitur ini ada; yang lama tetap harus terlihat manusia.
  const kasusRingkas: KasusOffboarding[] = semua
    .filter((r) => r.jenis === "offboarding")
    .map((r) => ({
      id: String(r.id),
      jenis: "offboarding",
      nama: String(r.nama ?? ""),
      status: String(r.status ?? ""),
      userId: (r.user_id as string | null) || null,
      kontrakId: (r.kontrak_id as string | null) || null,
      tglSelesai: (r.tgl_selesai as string | null) || null,
      tanggal: (r.tanggal as string | null) || null,
    }));
  const sisa = perluDitutup(
    kasusRingkas,
    new Set(getUsers().filter((u) => u.active).map((u) => u.id)),
    new Set(kontrak.filter((k) => !k.tglResign).map((k) => k.id)),
  );

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={MessageSquare}
        title={tab === "keluar" ? "Offboarding / Exit Process" : "Case Management"}
        description={
          tab === "keluar"
            ? "Proses karyawan keluar (resign atau PHK) — dari notifikasi sampai statusnya non-aktif di Database Karyawan."
            : "Penanganan kasus hubungan industrial — pilih tampilan sesuai scope: Manajemen (GWG) atau Outlet."
        }
        actions={<PanduanModul panduan="relasi" />}
      />
      <KonteksModul panduan="relasi" />
      <RelasiBoard
        kasus={semua.filter((r) => r.jenis === "kasus")}
        keluar={semua.filter((r) => r.jenis === "offboarding")}
        outlets={outlets}
        orangManajemen={orangManajemen}
        orangOutlet={orangOutlet}
        sisaPenutupan={sisa}
        bolehUbah
        tabAwal={tab}
      />
    </div>
  );
}
