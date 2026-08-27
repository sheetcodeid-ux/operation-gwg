import { ArrowLeft, ArrowRight, CircleDashed } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { HC_PILLARS, pillarBySlug, RACI_LABEL, RACI_ROLES } from "@/lib/hcmos/pillars";
import { NAV_ICONS } from "@/components/layout/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";

/** Semua pilar sudah diketahui sejak awal — tidak perlu menunggu permintaan masuk. */
export function generateStaticParams() {
  return HC_PILLARS.map((p) => ({ pilar: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ pilar: string }> }): Promise<Metadata> {
  const { pilar } = await params;
  const p = pillarBySlug(pilar);
  return { title: p ? `${p.label} — HC-MOS` : "HC-MOS" };
}

export default async function PilarPage({ params }: { params: Promise<{ pilar: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const { pilar } = await params;
  const p = pillarBySlug(pilar);
  if (!p) notFound();

  const Icon = NAV_ICONS[p.icon] ?? CircleDashed;

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader icon={Icon} title={p.label} description={p.ringkas} actions={<PanduanModul panduan="pilar" />} />

      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Penanggung jawab pilar</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{p.pic}</p>
          <p className="text-[12px] text-muted-foreground">{p.picRole}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {p.submenus.map((s) => {
          const SubIcon = NAV_ICONS[s.icon] ?? CircleDashed;
          return (
            <Card key={s.slug}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
                    <SubIcon className="size-4.5 text-foreground/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {s.label}
                      {s.scopeOnly && <Badge tone="cyan">Khusus {s.scopeOnly === "outlet" ? "Outlet" : "Manajemen"}</Badge>}
                    </CardTitle>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{s.fungsi}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                  {RACI_ROLES.filter((r) => s.raci[r] && s.raci[r] !== "—").map((r) => (
                    <span
                      key={r}
                      title={RACI_LABEL[r]}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      <span className="font-semibold text-foreground">{r}</span> {s.raci[r]}
                    </span>
                  ))}
                </div>

                {/* Sub-menu yang modulnya sudah berjalan menunjuk ke sana. Yang
                    belum dikatakan apa adanya — bukan disamarkan jadi halaman
                    kosong yang seolah-olah sudah jadi. */}
                {s.href ? (
                  <Link
                    href={s.href}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Buka {s.hrefLabel ?? s.label} <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <p className="mt-3 text-[12px] text-muted-foreground">
                    Belum ada modulnya di sistem — masih dikerjakan manual di luar aplikasi.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
