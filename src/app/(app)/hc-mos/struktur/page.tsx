import { ArrowLeft, Building2, MapPinned, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getAreas, getOutlets, getUsers, userName } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";

export const metadata: Metadata = { title: "Struktur Organisasi — HC-MOS" };

/**
 * Struktur Organisasi.
 *
 * Disusun dari data yang sudah ada — departemen & jabatan di User Management,
 * dan area → outlet → supervisor di data cabang. Tidak ada bagan yang digambar
 * terpisah: bagan yang digambar tangan akan langsung berbeda dari kenyataan
 * begitu ada satu orang pindah departemen, dan tidak ada yang tahu mana yang
 * benar.
 */
export default async function StrukturPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const users = getUsers().filter((u) => u.active);
  const areas = getAreas();
  const outlets = scopeOutlets(user, getOutlets());

  // Manajemen: departemen → jabatan → orang.
  const perDep = new Map<string, { jabatan: string; nama: string }[]>();
  for (const u of users) {
    const dep = (u.department ?? "").trim() || "Tanpa Departemen";
    const isi = perDep.get(dep) ?? [];
    isi.push({ jabatan: (u.jabatan ?? "").trim() || "—", nama: u.name });
    perDep.set(dep, isi);
  }
  const departemen = [...perDep.entries()]
    .map(([nama, orang]) => ({ nama, orang: orang.sort((a, b) => a.nama.localeCompare(b.nama, "id")) }))
    .sort((a, b) => b.orang.length - a.orang.length);

  // Outlet: area → outlet → supervisor.
  const perArea = areas
    .map((a) => ({
      id: a.id,
      nama: a.name,
      koordinator: a.coordinatorId ? userName(a.coordinatorId) : "—",
      outlets: outlets
        .filter((o) => o.areaId === a.id)
        .map((o) => ({ id: o.id, nama: o.name, supervisor: o.supervisorId ? userName(o.supervisorId) : "—" }))
        .sort((x, y) => x.nama.localeCompare(y.nama, "id")),
    }))
    .filter((a) => a.outlets.length > 0);

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={Building2}
        title="Struktur Organisasi"
        description="Disusun langsung dari User Management dan data cabang — bukan bagan terpisah yang harus disamakan."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={UserRound} label="Karyawan Aktif" value={users.length} sub="Manajemen (GWG)" />
        <StatTile icon={Building2} label="Departemen" value={departemen.length} sub="di kantor pusat" />
        <StatTile icon={MapPinned} label="Area" value={perArea.length} sub="wilayah operasional" />
        <StatTile icon={Building2} label="Outlet" value={outlets.length} sub="dalam lingkup Anda" />
      </div>

      <h2 className="mb-2.5 text-sm font-semibold text-foreground">Manajemen (GWG)</h2>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        {departemen.map((d) => (
          <Card key={d.nama}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{d.nama}</span>
                <Badge tone="neutral">{d.orang.length} orang</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {d.orang.map((o, i) => (
                  <li key={`${o.nama}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-foreground">{o.nama}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{o.jabatan}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mb-2.5 text-sm font-semibold text-foreground">Outlet</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {perArea.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{a.nama}</span>
                <Badge tone="neutral">{a.outlets.length} outlet</Badge>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Coordinator Area: {a.koordinator}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {a.outlets.map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-foreground">{o.nama}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{o.supervisor}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
