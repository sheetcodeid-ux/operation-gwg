import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/icons";
import { PageHeader } from "@/components/ui/page-header";
import { DEPARTEMEN, POSISI } from "@/lib/kpi/struktur";
import { indikatorPosisi } from "@/lib/kpi/indikator";
import { MENU_POSISI } from "@/lib/kpi/akses";

export const metadata: Metadata = { title: "Key Performance Indicator" };

/**
 * Pintu masuk modul KPI: seluruh departemen dan posisinya.
 *
 * Departemen yang indikatornya belum ditentukan TETAP ditampilkan, dengan
 * keterangan menyusul. Menyembunyikannya membuat orang mengira departemennya
 * lupa dimasukkan; menampilkannya apa adanya membuat sisa pekerjaannya
 * terlihat oleh semua orang.
 */
export default async function KpiPage({ searchParams }: { searchParams: Promise<{ dep?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "kpi")) redirect("/dashboard");

  // Saringan departemen di halaman posisi mengarah ke sini; yang dituju
  // sebenarnya posisi pertama departemen itu, bukan daftar ini.
  const { dep } = await searchParams;
  const tujuan = dep ? DEPARTEMEN.find((d) => d.kode === dep)?.posisi[0] : undefined;
  if (tujuan) redirect(`/kpi/${tujuan}`);

  return (
    <div className="w-full">
      <PageHeader
        icon={NAV_ICONS.Target}
        title="Key Performance Indicator"
        description="Capaian bulanan tiap posisi — indikator, bobot, dan targetnya dihitung dari data yang sudah masuk."
      />

      <div className="flex flex-col gap-5">
        {DEPARTEMEN.map((d) => {
          const Ikon = NAV_ICONS[d.ikon] ?? NAV_ICONS.Target;
          const posisi = POSISI.filter((p) => d.posisi.includes(p.kode));
          return (
            <section key={d.kode}>
              <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Ikon className="size-4 text-muted-foreground" /> {d.nama}
              </p>

              {posisi.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-5">
                  <p className="text-[12.5px] text-muted-foreground">
                    Indikatornya belum ditentukan — menyusul: {d.menyusul?.join(" · ")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {posisi.map((p) => {
                    const boleh = canReachMenu(user, MENU_POSISI[p.kode] as MenuKey);
                    const isi = (
                      <>
                        <p className="truncate text-[14px] font-medium text-foreground">{p.nama}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {p.pic.length ? p.pic.join(", ") : "PIC belum ditentukan"}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {indikatorPosisi(p.kode).length} indikator
                        </p>
                      </>
                    );
                    return boleh ? (
                      <Link
                        key={p.kode}
                        href={`/kpi/${p.kode}`}
                        className="rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-ring hover:bg-muted/30"
                      >
                        {isi}
                      </Link>
                    ) : (
                      <div key={p.kode} className="rounded-2xl border border-border bg-card p-3.5 opacity-55">
                        {isi}
                      </div>
                    );
                  })}
                </div>
              )}

              {posisi.length > 0 && d.menyusul && (
                <p className="mt-2 text-[11.5px] text-muted-foreground">Menyusul: {d.menyusul.join(" · ")}</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
