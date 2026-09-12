"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simpanUnggahAction } from "@/lib/actions/unggah-data";
import { TEMPLATE, bacaBarisUnggah, judulKolom, type BarisUnggah } from "@/lib/ops/template-unggah";
import { formatNumber } from "@/lib/utils";

/**
 * Satu pintu unggah data.
 *
 * SATU BERKAS, SATU BARIS JUDUL. Tidak dipecah per jenis: memecahnya berarti
 * beberapa kali unduh dan beberapa kali unggah untuk outlet yang sama — hanya
 * memindahkan pekerjaan berulang, bukan menghilangkannya.
 *
 * Bentuknya sengaja sama persis dengan halaman Beban Operasional — panah bulan,
 * unduh, unggah, simpan — karena yang memakainya orang yang sama, dan dua cara
 * berbeda untuk pekerjaan yang sama hanya menambah satu hal lagi yang harus
 * diingat.
 *
 * YANG BERBEDA: tujuannya ditulis di layar. Sebelum menekan Simpan, yang
 * mengunggah melihat angkanya akan muncul di mana saja — dan setelah tersimpan,
 * jawabannya diulang dari server, bukan dari tebakan layar.
 */

const bulanLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};
const geserBulan = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Baris yang ikut diunduh, supaya kode outletnya tidak perlu diketik ulang. */
export interface BarisAwal {
  kunci: string;
  teks: Record<string, string>;
  angka: Record<string, number | null>;
}

export function UnggahData({ month, awal }: { month: string; awal: BarisAwal[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [baris, setBaris] = React.useState<BarisUnggah[] | null>(null);
  const [sibuk, start] = React.useTransition();
  const berkasRef = React.useRef<HTMLInputElement>(null);

  const t = TEMPLATE;

  // Berkas yang sudah terbaca dibuang saat bulannya berganti: tabel pratinjau
  // yang tertinggal dari bulan sebelumnya akan tersimpan ke bulan yang salah
  // hanya karena terlihat benar.
  //
  // Disesuaikan SAAT RENDER, bukan lewat efek — pola resmi React untuk state
  // yang bergantung pada prop, dan pola yang sama dipakai form KPI di sebelah.
  const [konteks, setKonteks] = React.useState(month);
  if (konteks !== month) {
    setKonteks(month);
    setBaris(null);
  }

  async function unduh() {
    const XLSX = await import("xlsx");
    const judul = judulKolom(t);
    const aoa: (string | number)[][] = [
      judul,
      ...awal.map((b) => judul.map((k) => (k === t.kunci ? b.kunci : (b.teks[k] ?? b.angka[k] ?? "")))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = judul.map((k) => ({ wch: Math.max(16, k.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.sheet);
    XLSX.writeFile(wb, `data-outlet-${month}.xlsx`);
    toast.success("Template diunduh — isi kolom angkanya, lalu unggah kembali.");
  }

  async function unggah(file: File) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return toast.error("Berkasnya tidak berisi lembar apa pun.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const { baris: terbaca, tanpaKunci } = bacaBarisUnggah(t, rows);
      if (terbaca.length === 0) {
        return toast.error(`Tidak ada baris yang terbaca — pastikan kolom "${t.kunci}" terisi. Pakai template dari sini.`);
      }
      if (tanpaKunci > 0) toast.info(`${tanpaKunci} baris tanpa ${t.kunci} dilewati.`);
      setBaris(terbaca);
      // Belum tersimpan, dan itu disengaja: berkas yang salah harus sempat
      // terlihat di layar sebelum menimpa angka yang sudah benar.
      toast.success(`${terbaca.length} baris terbaca — periksa dulu, lalu Simpan.`);
    } catch {
      toast.error("Berkasnya tidak bisa dibaca. Pakai format .xlsx dari template.");
    }
  }

  function simpan() {
    if (!baris) return;
    start(async () => {
      const res = await simpanUnggahAction({ periode: month, baris });
      if (res.error) {
        toast.error(res.error);
        if (res.asing?.length) {
          toast.error(`${res.asing.length} baris tidak dikenali: ${res.asing.slice(0, 3).join(", ")}${res.asing.length > 3 ? "…" : ""}`);
        }
        return;
      }
      if (res.asing?.length) {
        // Disebut, tidak didiamkan: baris yang tidak dikenali akan terbaca
        // seperti berhasil, dan yang mengunggah baru sadar berbulan-bulan
        // kemudian bahwa angkanya tidak pernah masuk.
        toast.error(`${res.asing.length} baris dilewati karena kodenya tidak dikenali: ${res.asing.slice(0, 3).join(", ")}${res.asing.length > 3 ? "…" : ""}`);
      }
      if (res.dilewati) toast.info(`${res.dilewati} outlet dilewati karena seluruh angkanya kosong.`);
      toast.success(`${res.tersimpan} outlet tersimpan — masuk ke ${res.tujuan?.length ?? 0} tempat.`);
      setBaris(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-gradient rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="size-8 p-0" onClick={() => router.push(`${pathname}?month=${geserBulan(month, -1)}`)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">{bulanLabel(month)}</span>
            <Button size="sm" variant="outline" className="size-8 p-0" onClick={() => router.push(`${pathname}?month=${geserBulan(month, 1)}`)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={unduh} disabled={sibuk}>
              <Download className="size-4" /> Unduh Template
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => berkasRef.current?.click()} disabled={sibuk}>
              <FileUp className="size-4" /> Unggah
            </Button>
            <input
              ref={berkasRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                // Dikosongkan supaya berkas yang SAMA bisa diunggah lagi setelah
                // diperbaiki — tanpa ini unggahan kedua tidak memicu apa pun.
                e.target.value = "";
                if (f) void unggah(f);
              }}
            />
            <Button size="sm" className="gap-1.5" onClick={simpan} disabled={sibuk || !baris}>
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
            </Button>
          </div>
        </div>
      </div>

      {/* Tabelnya selalu ada. Sebelum ada berkas yang dibaca, isinya angka
          yang SUDAH tersimpan bulan itu — jadi terlihat apa yang akan ditimpa,
          bukan kotak kosong yang tidak mengatakan apa-apa. */}
      <Pratinjau baris={baris ?? awal} />
    </div>
  );
}

/**
 * Pratinjau sebelum disimpan — angka apa adanya, kosong tetap kosong.
 *
 * Nomor urut, bukan kode outlet: kodenya tetap ada di dalam berkas sebagai
 * identitas baris — itulah yang dicocokkan saat disimpan — tapi di layar ia
 * tidak menambah apa pun selain satu kolom yang harus dilewati mata.
 *
 * Kolom outlet dibekukan di kiri. Tanpa itu, menggulir ke Laba Bersih membuat
 * angka kehilangan nama outletnya — dan angka tanpa nama outlet adalah persis
 * cara satu baris salah dibaca sebagai baris lain.
 */
function Pratinjau({ baris }: { baris: BarisUnggah[] }) {
  const t = TEMPLATE;
  // Lebar kolom nomor dipatok angka, bukan kelas lebar: posisi beku kolom
  // outlet dihitung dari sini, dan dua nilai yang harus sama persis lebih aman
  // ditulis sekali daripada dua kali di tempat berbeda.
  const LEBAR_NO = 48;
  const namaOutlet = (b: BarisUnggah) => b.teks["Outlet"] || b.kunci;
  const urut = [...baris].sort((a, b) => namaOutlet(a).localeCompare(namaOutlet(b), "id"));

  return (
    <div className="max-h-[32rem] overflow-auto rounded-2xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="text-left">
            <th
              style={{ width: LEBAR_NO, minWidth: LEBAR_NO, left: 0 }}
              className="sticky z-30 border-b border-border bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              #
            </th>
            <th
              style={{ left: LEBAR_NO }}
              className="sticky z-30 border-b border-r border-border bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Outlet
            </th>
            {t.angka.map((k) => (
              <th
                key={k}
                className="whitespace-nowrap border-b border-border bg-muted px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {urut.map((b, i) => (
            <tr key={`${b.kunci}-${i}`} className="border-b border-border/60 last:border-0">
              <td
                style={{ width: LEBAR_NO, minWidth: LEBAR_NO, left: 0 }}
                className="sticky z-10 bg-card px-3 py-1.5 text-right tabular-nums text-muted-foreground"
              >
                {i + 1}
              </td>
              <td
                style={{ left: LEBAR_NO }}
                className="sticky z-10 whitespace-nowrap border-r border-border bg-card px-3 py-1.5 font-medium text-foreground"
              >
                {namaOutlet(b)}
              </td>
              {t.angka.map((k) => {
                const n = b.angka[k];
                return (
                  <td key={k} className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                    {/* Kosong TIDAK ditulis nol: yang satu berarti belum
                        dilaporkan, yang lain berarti nol rupiah. */}
                    {n === null ? <span className="text-muted-foreground">—</span> : formatNumber(n)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
