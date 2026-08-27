import { ArrowLeft, Building2, Layers, MapPinned, Network, Store, UserRound } from "lucide-react";
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
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { StatTile } from "@/components/ui/stat";
import { GrafikBatang } from "@/components/hcmos/grafik";
import { DIVISI_KANTOR, JENJANG_OUTLET, kelompokDari } from "@/lib/hcmos/struktur";
import { brandOutlet } from "@/lib/hcmos/kontrak";

export const metadata: Metadata = { title: "Profil Organisasi — HC-MOS" };

/**
 * Struktur Organisasi.
 *
 * Dua jenis isi, dan bedanya menentukan dari mana masing-masing datang:
 *
 *  • BAGAN — divisi, unit di bawahnya, jenjang jabatan outlet. Ini keputusan
 *    organisasi, tidak ada di tabel mana pun, jadi ditulis di
 *    `lib/hcmos/struktur.ts` sebagai satu-satunya rujukan.
 *  • ANGKA — jumlah orang, outlet, area, sebaran per kelompok. Semuanya
 *    dihitung dari User Management dan data cabang, tidak pernah diketik.
 *
 * Mencampur keduanya adalah kesalahan yang mahal: angka yang diketik di bagan
 * berhenti berubah saat orangnya bertambah, dan tidak ada yang menyadarinya
 * sampai seseorang membandingkannya dengan User Management.
 */
export default async function StrukturPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const users = getUsers().filter((u) => u.active);
  const areas = getAreas();
  const outlets = scopeOutlets(user, getOutlets());
  const outletAktif = outlets.filter((o) => o.active).length;
  const brand = new Set(outlets.map((o) => brandOutlet(o.name)).filter(Boolean));

  // Sebaran headcount per kelompok besar, dari departemen di User Management.
  const perKelompok = new Map<string, number>();
  for (const u of users) {
    const k = kelompokDari((u.department ?? "").trim() || "Lainnya");
    perKelompok.set(k, (perKelompok.get(k) ?? 0) + 1);
  }
  const kelompok = [...perKelompok.entries()]
    .map(([nama, nilai]) => ({ nama, nilai }))
    .sort((a, b) => b.nilai - a.nilai);

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
        <ArrowLeft className="size-4" /> Kembali ke Dashboard
      </Link>

      <PageHeader
        icon={Building2}
        title="Profil Organisasi"
        description="Peta struktur organisasi GWG Group — kantor pusat manajemen dan struktur operasional di seluruh brand."
        actions={<PanduanModul panduan="struktur" />}
      />

      <KonteksModul panduan="struktur" />

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={UserRound}
          label="Total Headcount Manajemen"
          value={users.length}
          sub="karyawan aktif di User Management"
        />
        <StatTile icon={Network} label="Divisi Kantor Pusat" value={DIVISI_KANTOR.length} sub="sesuai bagan organisasi" />
        <StatTile
          icon={Store}
          label="Outlet Terdaftar"
          value={outlets.length}
          sub={`${outletAktif} aktif · ${brand.size} brand`}
        />
        <StatTile icon={Layers} label="Level Jabatan Outlet" value={JENJANG_OUTLET.length} sub="berlaku seragam" />
      </div>

      {/* ── Divisi & Unit Kerja ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle>Divisi &amp; Unit Kerja</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Kantor pusat GWG Group — mengacu pada dokumen Struktur Organisasi
          </p>
        </CardHeader>
        <CardContent>
          {/* Tabel lebar digulir di dalam kartunya sendiri; halaman tidak pernah
              ikut bergeser ke samping. */}
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Divisi</Th>
                  <Th>Kepala / PIC</Th>
                  <Th>Unit di Bawahnya</Th>
                  <Th>Melapor ke</Th>
                </tr>
              </thead>
              <tbody>
                {DIVISI_KANTOR.map((d) => (
                  <tr key={d.nama} className="border-b border-border/60 last:border-0">
                    <Td className="font-medium text-foreground">{d.nama}</Td>
                    <Td>{d.pic}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {d.unit.map((u) => (
                          <Badge key={u} tone="neutral">
                            {u}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{d.melaporKe}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Sebaran headcount ───────────────────────────────────────────── */}
      <div className="mb-1">
        <GrafikBatang
          judul="Distribusi Headcount per Kelompok"
          subjudul="Sumber: User Management — karyawan aktif, dikelompokkan menurut divisinya"
          data={kelompok}
          pesanKosong="Belum ada karyawan aktif di User Management."
        />
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
        Angka di atas dihitung langsung dari User Management, jadi ia ikut berubah begitu ada karyawan ditambah atau
        dinonaktifkan. Pemetaan departemen ke kelompok mengacu pada dokumen Struktur Organisasi GWG.
      </p>

      {/* ── Jenjang outlet ──────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle>Jenjang Struktur Outlet</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Berlaku seragam di seluruh outlet — {[...brand].join(", ") || "seluruh brand"}
          </p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {JENJANG_OUTLET.map((j) => (
              <li key={j.level} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-semibold tabular-nums text-foreground">
                  {j.level}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{j.jabatan}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">melapor ke {j.melaporKe}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Rincian lengkap per outlet beserta supervisornya ada di{" "}
            <Link href="/hc-mos/kontrak" className="text-primary hover:underline">
              Kontrak Tracker
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPinned className="size-4 text-muted-foreground" /> Rincian Outlet per Area
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top text-muted-foreground ${className}`}>{children}</td>;
}
