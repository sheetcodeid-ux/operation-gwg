import { ArrowLeft, HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listDokumen } from "@/lib/data/hcmos-dokumen";
import { JENIS_DOKUMEN, type JenisDokumen } from "@/lib/hcmos/dokumen";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { DokumenBoard } from "@/components/hcmos/dokumen-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NAV_ICONS } from "@/components/layout/icons";
import { CORE_VALUES } from "@/lib/hcmos/budaya";
import { alurPilar } from "@/lib/hcmos/alur-sop";
import { pillarBySlug } from "@/lib/hcmos/pillars";
import { AlurLangkah } from "@/components/hcmos/alur";
import { PksTracker } from "@/components/hcmos/pks-tracker";

export const metadata: Metadata = { title: "Pusat Dokumen — HC-MOS" };

export default async function DokumenPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string; pilar?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  // Tautan dari halaman pilar membawa jenis & pilarnya — dokumen yang dicari
  // langsung terbuka, tanpa pengunjung harus menyaring sendiri dua kali.
  const jenis = (JENIS_DOKUMEN as readonly string[]).includes(sp.jenis ?? "")
    ? (sp.jenis as JenisDokumen)
    : "sop";

  const rows = await listDokumen();
  const alur = jenis === "sop" ? alurPilar(sp.pilar ?? "") : undefined;
  const namaPilar = pillarBySlug(sp.pilar ?? "")?.label ?? "";
  const bolehUbah =
    user.role === "super_admin" || user.role === "legal" || user.department === "Human Capital";

  // Tanpa kepala halaman: bingkai modulnya membawa judul per jenis dokumen,
  // pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <KonteksModul panduan="dokumen" pilar={jenis === "sop" ? sp.pilar : jenis === "culture" ? "organization-development" : null} />


      {/* Nilai intinya ditampilkan lebih dulu, dokumennya menyusul.
          Yang dicari orang saat membuka Culture & Value adalah NILAINYA; poster
          dan deck onboarding hanyalah turunannya, dan menaruh daftar berkas di
          atas membuat halaman ini terbaca sebagai lemari arsip. */}
      {jenis === "culture" && <CoreValues />}

      {/* SOP satu pilar dibuka dengan ALUR KERJANYA, dokumennya menyusul.
          Yang dicari orang saat membuka SOP hampir selalu "langkahnya apa saja
          dan siapa mengerjakan apa" — berkas PDF-nya baru dibutuhkan ketika ia
          perlu mengutipnya. */}
      {jenis === "sop" && alur && (
        <AlurLangkah judul={`Alur SOP ${namaPilar}`} ringkas={alur.ringkas} langkah={alur.langkah} />
      )}

      {/* Pelacak PKS menempel di Document & Compliance, bukan di menunya
          sendiri: yang mengurusnya orang yang sama dengan yang mengurus dokumen
          kepatuhan, dan pertanyaannya datang bersamaan — "legalitas kita aman
          tidak bulan ini". Dipisah ke menu lain, satu dari dua jawaban selalu
          tertinggal tidak dibaca. */}
      {jenis === "compliance" && <PksTracker rows={rows.filter((d) => d.jenis === "pks")} />}

      <DokumenBoard rows={rows} jenisAwal={jenis} pilarAwal={sp.pilar ?? ""} bolehUbah={bolehUbah} />
    </div>
  );
}


/** Lima nilai inti — tetap, tidak disunting lewat formulir. */
function CoreValues() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle>Core Values GWG Group</CardTitle>
        <p className="text-[11px] text-muted-foreground">Ditanamkan sejak proses onboarding</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {CORE_VALUES.map((v) => {
            const Icon = NAV_ICONS[v.icon] ?? HeartHandshake;
            return (
              <li key={v.nama} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
                  <Icon className="size-4 text-foreground/70" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{v.nama}</span>
                  <span className="block text-[12px] leading-relaxed text-muted-foreground">{v.arti}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
