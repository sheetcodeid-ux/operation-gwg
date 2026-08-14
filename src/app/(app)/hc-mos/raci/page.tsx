import { ArrowLeft, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { allSubmenus, RACI_LABEL, RACI_ROLES, type RaciRole } from "@/lib/hcmos/pillars";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Matriks RACI — HC-MOS" };

/** Warna per peran — R dan A yang paling perlu langsung terlihat. */
const TONE: Record<RaciRole, string> = {
  R: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  A: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  C: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  I: "bg-muted text-muted-foreground",
};

export default async function RaciPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const baris = allSubmenus();

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={Table2}
        title="Matriks RACI"
        description="Siapa mengerjakan, siapa bertanggung jawab, siapa dimintai pendapat, dan siapa cukup diberi tahu."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-2 p-4">
          {(Object.keys(RACI_LABEL) as RaciRole[]).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className={`grid size-6 place-items-center rounded-md text-[11px] font-bold ${TONE[r]}`}>{r}</span>
              {RACI_LABEL[r]}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {/* Matriksnya memang lebar — digulir mendatar di dalam wadahnya
              sendiri, bukan membuat seluruh halaman ikut bergeser. */}
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[64rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Pilar</th>
                  <th className="px-3 py-2.5 font-medium">Aktivitas / Menu</th>
                  {RACI_ROLES.map((r) => (
                    <th key={r} className="px-3 py-2.5 font-medium">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baris.map(({ pillar, sub }, i) => {
                  // Nama pilar hanya ditulis sekali per kelompok — diulang di
                  // setiap baris, matriksnya jadi jauh lebih sulit dibaca.
                  const awalKelompok = i === 0 || baris[i - 1].pillar.slug !== pillar.slug;
                  return (
                    <tr
                      key={`${pillar.slug}-${sub.slug}`}
                      className={`border-b border-border/60 last:border-0 ${awalKelompok ? "border-t-border" : ""}`}
                    >
                      <td className="px-3 py-2 align-top text-[12px] text-muted-foreground">
                        {awalKelompok ? <span className="font-medium text-foreground">{pillar.label}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-foreground">{sub.label}</td>
                      {RACI_ROLES.map((r) => {
                        const siapa = sub.raci[r];
                        return (
                          <td key={r} className="px-3 py-2">
                            {siapa && siapa !== "—" ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  title={RACI_LABEL[r]}
                                  className={`inline-grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold ${TONE[r]}`}
                                >
                                  {r}
                                </span>
                                <span className="text-[12px] text-foreground">{siapa}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
