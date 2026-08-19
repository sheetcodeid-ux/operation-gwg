import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LevelOutlet } from "@/lib/hcmos/struktur";
import { TUGAS_JENJANG } from "@/lib/hcmos/struktur";

/**
 * Jenjang karier sebagai TANGGA, bukan tabel.
 *
 * Yang ingin diketahui orang saat membuka Career Path adalah "dari posisi saya
 * sekarang, ke mana saya bisa naik" — pertanyaan tentang urutan. Tabel dengan
 * kolom "jabatan berikutnya" memuat jawaban yang sama, tapi urutannya harus
 * dirangkai sendiri oleh pembacanya baris demi baris, dan itulah bagian yang
 * seharusnya dikerjakan tampilannya.
 *
 * Tidak ada penanda "posisi Anda sekarang" di sini: halaman ini menggambarkan
 * jenjang yang berlaku untuk semua orang, bukan berkas satu orang.
 */
export function JenjangKarier({
  judul,
  ringkas,
  jenjang,
}: {
  judul: string;
  ringkas?: string;
  jenjang: LevelOutlet[];
}) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle>{judul}</CardTitle>
        {ringkas && <p className="text-[11px] text-muted-foreground">{ringkas}</p>}
      </CardHeader>
      <CardContent>
        <ol className="space-y-0">
          {jenjang.map((j, i) => (
            <li key={j.level} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted text-[12px] font-semibold tabular-nums text-foreground">
                  {j.level}
                </span>
                {i < jenjang.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className={`min-w-0 flex-1 ${i < jenjang.length - 1 ? "pb-4" : ""}`}>
                <p className="text-sm font-medium leading-7 text-foreground">{j.jabatan}</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {TUGAS_JENJANG[j.jabatan] ?? "—"}
                  {i < jenjang.length - 1 && (
                    <span className="text-muted-foreground/70"> · jenjang berikutnya: {j.melaporKe}</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
