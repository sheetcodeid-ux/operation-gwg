import { ArrowLeft, PieChart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { hitungKpiHc } from "@/lib/data/hcmos-kpi";
import { KPI_BY_KEY, capaian, nadaCapaian } from "@/lib/hcmos/kpi";
import { periodeLabel } from "@/lib/hcmos/kontrak";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "@/components/ui/score-ring";

export const metadata: Metadata = { title: "Report & KPI — HC-MOS" };

export default async function KpiPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const hasil = await hitungKpiHc(user);

  // Skor keseluruhan hanya dari indikator yang benar-benar punya data.
  // Memasukkan yang belum terukur sebagai nol akan menuduh tim gagal pada hal
  // yang bahkan belum diukur.
  const terukur = hasil.baris
    .map((b) => capaian(KPI_BY_KEY[b.key], b.realisasi))
    .filter((c): c is number => c !== null);
  const skor = terukur.length ? Math.round(terukur.reduce((a, b) => a + b, 0) / terukur.length) : null;

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={PieChart}
        title="Report & KPI Human Capital"
        description={`Periode ${periodeLabel(hasil.periode)} — setiap angka dihitung dari data yang sudah ada, tidak ada yang diketik manual.`}
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-5">
            {skor === null ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada indikator yang bisa diukur. Angkanya akan muncul begitu modul-modulnya mulai diisi.
              </p>
            ) : (
              <>
                <ScoreRing value={Math.min(skor, 100)} size={132} stroke={13} label="capaian rata-rata" />
                <p className="text-center text-[11px] text-muted-foreground">
                  Dihitung dari {terukur.length} indikator yang sudah punya data
                  {terukur.length < hasil.baris.length && `, ${hasil.baris.length - terukur.length} belum terukur`}.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">Kelulusan Fast Start & Fast Track</p>
            {hasil.kelulusanFastStart ? (
              <>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {Math.round((hasil.kelulusanFastStart.lulus / hasil.kelulusanFastStart.dinilai) * 100)}%
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {hasil.kelulusanFastStart.lulus} lulus dari {hasil.kelulusanFastStart.dinilai} peserta yang sudah
                  dinilai Post Test.
                </p>
                <Progress
                  className="mt-3"
                  value={(hasil.kelulusanFastStart.lulus / hasil.kelulusanFastStart.dinilai) * 100}
                  tone="success"
                />
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Belum ada peserta Fast Start yang dinilai Post Test.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {hasil.baris.map((b) => {
          const ind = KPI_BY_KEY[b.key];
          const c = capaian(ind, b.realisasi);
          const nada = nadaCapaian(c);
          const satuan = ind.satuan === "hari" ? "hari" : "%";
          return (
            <Card key={b.key}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{ind.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{ind.sumber}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-semibold tabular-nums text-foreground">
                      {b.realisasi === null ? "—" : `${b.realisasi}${satuan}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      target {ind.makinKecilMakinBaik ? "maks " : ""}
                      {ind.target}
                      {satuan}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <Progress className="flex-1" value={c ?? 0} tone={nada === "brand" ? "brand" : nada} />
                  {c === null ? (
                    <Badge tone="neutral">Belum terukur</Badge>
                  ) : (
                    <Badge tone={nada}>{c}% capaian</Badge>
                  )}
                </div>

                <p className="mt-2 text-[12px] text-muted-foreground">{b.rincian}</p>
                {c !== null && c < 100 && (
                  <p className="mt-1.5 rounded-lg border border-border bg-muted/40 p-2.5 text-[12px] leading-relaxed text-foreground/90">
                    Tindak lanjut: {ind.tindakLanjut}
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
