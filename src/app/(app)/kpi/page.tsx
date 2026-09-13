import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/icons";
import { PageHeader } from "@/components/ui/page-header";
import { DEPARTEMEN, POSISI } from "@/lib/kpi/struktur";
import { indikatorPosisi } from "@/lib/kpi/indikator";
import { MENU_POSISI, bolehAturKpi } from "@/lib/kpi/akses";
import { periodeSekarang, setelanPosisi } from "@/lib/data/kpi";
import { alasanBelumDinilai, posisiDinilai } from "@/lib/kpi/berlaku";
import { AturBerlaku, type BarisBerlaku } from "@/components/kpi/atur-berlaku";

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
  // Setelan berlakunya KPI tiap posisi — dibaca sekali untuk seluruh halaman.
  const setelan = await setelanPosisi().catch(() => new Map());
  const periode = periodeSekarang();
  const aturBaris: BarisBerlaku[] = DEPARTEMEN.flatMap((d) =>
    POSISI.filter((p) => d.posisi.includes(p.kode)).map((p) => ({
      kode: p.kode,
      nama: p.nama,
      departemen: d.nama,
      setelan: setelan.get(p.kode) ?? { aktif: true, berlakuMulai: null },
    })),
  );

  const { dep } = await searchParams;
  const tujuan = dep ? DEPARTEMEN.find((d) => d.kode === dep)?.posisi[0] : undefined;
  if (tujuan) redirect(`/kpi/${tujuan}`);

  return (
    <div className="w-full">
      <PageHeader
        icon={NAV_ICONS.Target}
        title="Key Performance Indicator"
        description="Capaian bulanan tiap posisi — indikator, bobot, dan targetnya dihitung dari data yang sudah masuk."
        actions={bolehAturKpi(user) ? <AturBerlaku baris={aturBaris} /> : undefined}
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
                    // Posisi yang belum berlaku bulan ini TETAP DITAMPILKAN,
                    // dengan sebabnya tertulis. Menyembunyikannya membuat orang
                    // mengira posisinya terhapus, dan yang mencarinya tidak akan
                    // pernah tahu bahwa ia hanya belum waktunya dinilai.
                    const dinilai = posisiDinilai(setelan.get(p.kode), periode);
                    const alasan = alasanBelumDinilai(setelan.get(p.kode), periode);
                    const isi = (
                      <>
                        <p className="truncate text-[14px] font-medium text-foreground">{p.nama}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {p.pic.length ? p.pic.join(", ") : "PIC belum ditentukan"}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {dinilai ? `${indikatorPosisi(p.kode).length} indikator` : alasan}
                        </p>
                      </>
                    );
                    return boleh ? (
                      <Link
                        key={p.kode}
                        href={`/kpi/${p.kode}`}
                        className={`rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-ring hover:bg-muted/30${dinilai ? "" : " opacity-60"}`}
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
