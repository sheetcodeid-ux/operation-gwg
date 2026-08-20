import { Database } from "lucide-react";
import { MODE_DATA, VARIABEL_KURANG } from "@/lib/data/db";
import { bolehMelayani, perluTandaDemo } from "@/lib/data/mode";

/**
 * Penjaga mode data — dipasang di layar paling luar.
 *
 * Dua tugas, dan keduanya soal kejujuran layar:
 *
 *  1. Menolak merender aplikasi ketika tidak ada basis data dan data contoh
 *     tidak diizinkan. Halaman yang tidak bisa dibuka menyuruh orang
 *     memperbaiki konfigurasinya; halaman berisi data karangan menyuruhnya
 *     percaya.
 *  2. Menempelkan pita di atas layar selama mode demo, supaya siapa pun yang
 *     dikirimi tautannya tahu isinya bukan kenyataan — bukan cuma orang yang
 *     menjalankannya.
 */
export function PenjagaData({ children }: { children: React.ReactNode }) {
  if (!bolehMelayani(MODE_DATA)) return <LayarTanpaBasisData />;
  return (
    <>
      {perluTandaDemo(MODE_DATA) && <PitaDemo />}
      {children}
    </>
  );
}

function PitaDemo() {
  return (
    <div className="sticky top-0 z-[70] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-[12px] font-semibold text-amber-950">
      <Database className="size-3.5 shrink-0" />
      <span>
        DATA CONTOH — seluruh nama, angka, dan dokumen di layar ini dikarang untuk peragaan. Bukan data GWG Group.
      </span>
    </div>
  );
}

/**
 * Layar pengganti saat konfigurasi basis datanya tidak lengkap.
 *
 * Yang disebutkan hanya NAMA variabelnya, tidak pernah nilainya — halaman ini
 * terlihat oleh siapa pun yang membuka alamatnya.
 */
function LayarTanpaBasisData() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted ring-1 ring-border">
          <Database className="size-5 text-foreground/70" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">Aplikasi belum terhubung ke basis data</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Halaman sengaja tidak ditampilkan. Aplikasi ini punya data contoh untuk pengembangan, dan menyajikannya di
          sini akan terlihat persis seperti data sungguhan — nama, angka, dan dokumen yang tidak pernah ada.
        </p>

        {VARIABEL_KURANG.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Variabel yang belum terisi
            </p>
            <ul className="mt-1.5 space-y-1">
              {VARIABEL_KURANG.map((v) => (
                <li key={v} className="font-mono text-[12px] text-foreground">
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          Isi variabel di atas pada pengaturan Environment Variables milik deployment ini, lalu deploy ulang. Untuk
          menjalankan peragaan dengan data contoh secara sengaja, setel <code className="font-mono">GWG_DEMO=1</code>.
        </p>
      </div>
    </main>
  );
}
