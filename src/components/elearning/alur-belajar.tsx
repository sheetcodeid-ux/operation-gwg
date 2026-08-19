import { BadgeCheck, ClipboardCheck, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FASE_BELAJAR, LABEL_FASE, PENJELASAN_FASE } from "@/lib/elearning-fase";

/**
 * Penjelasan alur belajar, di atas daftar materinya.
 *
 * Ada karena satu hal berubah: Fast Start & Fast Track dan Pre/Post Test tidak
 * lagi jadi menu terpisah (hasil Meeting Fitur HRD), semuanya berjalan di sini.
 * Orang yang selama ini mencari "Fast Start" di sidebar perlu menemukan
 * penjelasannya di tempat programnya sekarang berjalan — bukan menyimpulkan
 * sendiri bahwa programnya dihapus.
 *
 * Empat tahapnya ditulis sekali di sini dan diambil dari `elearning-fase.ts`,
 * sumber yang sama dengan yang mengunci Post Test. Menuliskannya ulang berarti
 * penjelasan di layar bisa berbeda dari aturan yang benar-benar berlaku.
 */
export function AlurBelajar() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Alur Belajar</CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Berlaku untuk seluruh materi — termasuk Fast Start &amp; Fast Track bagi crew outlet
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {FASE_BELAJAR.map((f, i) => (
            <li key={f} className="flex items-start gap-2.5 rounded-xl border border-border bg-background/40 p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-foreground">{LABEL_FASE[f]}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{PENJELASAN_FASE[f]}</span>
              </span>
            </li>
          ))}
        </ol>

        <ul className="divide-y divide-border border-t border-border pt-1">
          {[
            {
              icon: Link2,
              judul: "Fast Start & Fast Track berjalan di alur yang sama",
              isi: "Fast Start untuk modul dasar crew baru, Fast Track untuk modul lanjutan sesuai posisi & brand. Keduanya bisa diulang kapan saja.",
            },
            {
              icon: ClipboardCheck,
              judul: "Nilai yang dipakai adalah percobaan pertama",
              isi: "Materi boleh diulang sebanyak apa pun, tapi angka resminya tidak ikut bergeser. Selisih Pre Test dan Post Test itulah hasil belajarnya.",
            },
            {
              icon: BadgeCheck,
              judul: "Post Test terbuka setelah materi utama tuntas",
              isi: "Videonya harus ditonton sampai selesai. Tanpa itu, jalan tercepat menyelesaikan materi adalah melewatinya.",
            },
          ].map((b) => (
            <li key={b.judul} className="flex items-start gap-3 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
                <b.icon className="size-4 text-foreground/70" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-foreground">{b.judul}</span>
                <span className="block text-[11px] leading-relaxed text-muted-foreground">{b.isi}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
