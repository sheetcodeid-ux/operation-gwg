import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LangkahSop } from "@/lib/hcmos/alur-sop";

/**
 * Alur berlangkah — dipakai SOP tiap pilar dan tahapan onboarding.
 *
 * Ditampilkan sebagai urutan bernomor tanpa penanda "sedang berjalan", dan itu
 * disengaja. Yang digambarkan di sini PROSEDUR, bukan satu berkas yang sedang
 * diproses: pada saat yang sama ada belasan rekrutmen dan puluhan pengajuan,
 * masing-masing di langkah yang berbeda. Menandai satu langkah sebagai "sedang
 * berjalan" berarti memilih satu di antaranya secara sewenang-wenang, dan
 * membuat orang percaya sistem sedang memantau sesuatu yang tidak dipantau.
 *
 * Rel penghubung digambar dari nomor ke nomor supaya urutannya terbaca sebagai
 * satu jalan, bukan lima kartu yang kebetulan berdampingan.
 */
export function AlurLangkah({
  judul,
  ringkas,
  langkah,
}: {
  judul: string;
  ringkas?: string;
  langkah: LangkahSop[];
}) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {ringkas && <p className="text-[11px] text-muted-foreground">{ringkas}</p>}
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {langkah.map((l, i) => (
            <li key={l.judul} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted text-[12px] font-semibold tabular-nums text-foreground">
                  {i + 1}
                </span>
                {i < langkah.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className={`min-w-0 flex-1 ${i < langkah.length - 1 ? "pb-4" : ""}`}>
                <p className="text-sm font-medium leading-7 text-foreground">{l.judul}</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">{l.isi}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
