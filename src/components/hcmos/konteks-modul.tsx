import Link from "next/link";
import { CircleDashed } from "lucide-react";
import { panduanUntuk } from "@/lib/hcmos/panduan";
import { SCOPE_LABEL, pillarBySlug } from "@/lib/hcmos/pillars";
import { NAV_ICONS } from "@/components/layout/icons";

/**
 * Bilah konteks di bawah kepala halaman: pilar pemiliknya, PIC-nya, cakupannya.
 *
 * MENGAPA BUKAN BADGE YANG DIKETIK DI HALAMAN. Sebelumnya dua belas halaman
 * menuliskannya sendiri — `<Badge>PIC: Riva</Badge>` dan seterusnya. Tiga
 * akibatnya: delapan halaman HC lain tidak punya konteks apa pun sehingga orang
 * tidak tahu satu layar itu milik pilar mana; nama PIC-nya beku, jadi begitu
 * seseorang berpindah peran belasan halaman menyebut nama yang salah tanpa ada
 * yang menyadarinya; dan badge-nya mati, padahal yang membacanya justru sedang
 * mencari jalan ke pilar itu.
 *
 * Sekarang ketiganya dibaca dari `pillars.ts` lewat `panduan.ts`, dan pilarnya
 * bisa diklik.
 *
 * Yang ditampilkan adalah PIC PILAR sesuai Juknis Bab 3, dan labelnya menyebut
 * itu apa adanya. Beberapa halaman dulu menuliskan nama pelaksana hariannya di
 * bawah label "PIC" yang sama — dua hal berbeda dengan satu nama, dan orang
 * yang membacanya akhirnya menghubungi orang yang salah. Siapa mengerjakan apa
 * untuk satu aktivitas dijawab matriks RACI, bukan bilah ini.
 */
export function KonteksModul({ panduan, pilar: paksa }: { panduan: string; pilar?: string | null }) {
  const p = panduanUntuk(panduan);
  // Pusat Dokumen memakai satu halaman untuk empat jenis dokumen yang pemilik
  // pilarnya berbeda-beda — SOP milik pilar yang sedang dibuka, kepatuhan milik
  // Legal. Pilarnya boleh ditentukan halamannya, bukan dikunci di panduannya.
  const slug = paksa ?? p?.pilar;
  const pilar = slug ? pillarBySlug(slug) : undefined;
  if (!p || !pilar) return null;

  const Icon = NAV_ICONS[pilar.icon] ?? CircleDashed;
  const scope = p.scope ? SCOPE_LABEL[p.scope] : "Manajemen & Outlet";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link
        href={`/hc-mos/${pilar.slug}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:border-foreground/25 hover:bg-muted/50 hover:text-foreground"
      >
        <Icon className="size-3.5" />
        {pilar.label}
      </Link>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        PIC Pilar: <span className="font-medium text-foreground/80">{pilar.pic}</span>
        <span className="hidden sm:inline">· {pilar.picRole}</span>
      </span>
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        Scope: {scope}
      </span>
    </div>
  );
}
