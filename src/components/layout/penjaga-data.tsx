import { Database, PlugZap } from "lucide-react";
import { MODE_DATA_DASAR, VARIABEL_KURANG } from "@/lib/data/db";
import { ensureHydrated, hidrasiPernahBerhasil } from "@/lib/data/hydrate";
import { bolehMelayani, modeData, perluTandaDemo } from "@/lib/data/mode";

/**
 * Penjaga mode data — dipasang di layar paling luar.
 *
 * Tugasnya menjaga satu janji: apa pun yang tampil di layar ini adalah data
 * GWG Group yang sebenarnya, atau tidak ada layar sama sekali.
 *
 * Ada DUA pintu yang bisa melanggar janji itu, dan keduanya sudah pernah
 * terbuka dalam satu hari yang sama:
 *
 *  1. Variabel basis datanya tidak terbaca. Aplikasi jatuh ke data contoh
 *     bawaan tanpa mengeluh.
 *  2. Variabelnya terbaca, tapi basis datanya menolak melayani — kuota egress
 *     habis, kunci dicabut, jaringan putus. Hidrasi gagal, dan isi memori yang
 *     tersaji tetap data contoh itu juga. Pintu ini lebih berbahaya karena
 *     konfigurasinya terlihat benar, jadi tidak ada yang curiga.
 *
 * `ensureHydrated()` sengaja ditunggu di sini, bukan hanya di halaman dalam.
 * Tanpa itu, keputusan diambil sebelum ada satu pun percobaan membaca basis
 * data, dan penjaga ini akan selalu bilang "gagal" pada permintaan pertama.
 * Pemanggilan keduanya murah: hasilnya disinggahkan satu TTL penuh.
 */
export async function PenjagaData({ children }: { children: React.ReactNode }) {
  await ensureHydrated();
  const mode = modeData({ ...MODE_DATA_DASAR, hidrasiBerhasil: hidrasiPernahBerhasil() });

  if (mode === "gagal-terhubung") return <LayarGagalTerhubung />;
  if (!bolehMelayani(mode)) return <LayarTanpaBasisData />;

  return (
    <>
      {perluTandaDemo(mode) && <PitaDemo />}
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

function Bingkai({
  ikon: Ikon,
  judul,
  children,
}: {
  ikon: typeof Database;
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted ring-1 ring-border">
          <Ikon className="size-5 text-foreground/70" />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{judul}</h1>
        {children}
      </div>
    </main>
  );
}

/**
 * Basis datanya ada, tapi tidak menjawab.
 *
 * Yang disebut di sini sengaja BUKAN tebakan penyebabnya, melainkan daftar
 * kemungkinan yang benar-benar pernah terjadi pada sistem ini. Halaman galat
 * yang menuduh satu penyebab spesifik akan menyesatkan begitu penyebabnya
 * berbeda, dan orang lalu memeriksa tempat yang salah lebih dulu.
 */
function LayarGagalTerhubung() {
  return (
    <Bingkai ikon={PlugZap} judul="Tidak bisa menghubungi basis data">
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Alamat basis datanya terbaca, tapi belum sekali pun bisa dibaca sejak halaman ini dijalankan. Datanya{" "}
        <span className="font-medium text-foreground">tidak hilang</span> — aplikasinya yang sedang tidak bisa
        menjangkaunya.
      </p>
      <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Yang perlu diperiksa</p>
        <ul className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
          <li>· Kuota Supabase — project diblokir bila egress atau penyimpanan habis.</li>
          <li>· Kunci service-role — apakah masih berlaku, atau baru di-reset.</li>
          <li>· Status project Supabase — apakah sedang dijeda atau ada gangguan.</li>
        </ul>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        Halaman sengaja tidak ditampilkan. Aplikasi ini punya data contoh untuk pengembangan, dan menyajikannya di sini
        akan terlihat persis seperti data sungguhan.
      </p>
    </Bingkai>
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
    <Bingkai ikon={Database} judul="Aplikasi belum terhubung ke basis data">
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Halaman sengaja tidak ditampilkan. Aplikasi ini punya data contoh untuk pengembangan, dan menyajikannya di sini
        akan terlihat persis seperti data sungguhan — nama, angka, dan dokumen yang tidak pernah ada.
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
    </Bingkai>
  );
}
