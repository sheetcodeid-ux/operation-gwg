"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileUp, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { simpanUnggahAction } from "@/lib/actions/unggah-data";
import { TEMPLATE, bacaBarisUnggah, judulKolom, type BarisUnggah, type JenisUnggah, type TemplateUnggah } from "@/lib/ops/template-unggah";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Satu pintu unggah data.
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

/** Baris contoh yang ikut diunduh, supaya kolom kuncinya tidak perlu ditebak. */
export interface BarisAwal {
  kunci: string;
  teks: Record<string, string>;
  angka: Record<string, number | null>;
}

export function UnggahData({
  month,
  awal,
}: {
  month: string;
  /** Isi template per jenis: baris yang sudah ada supaya tinggal ditimpa. */
  awal: Record<JenisUnggah, BarisAwal[]>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [jenis, setJenis] = React.useState<JenisUnggah>("laba_rugi");
  const [baris, setBaris] = React.useState<BarisUnggah[] | null>(null);
  const [namaBerkas, setNamaBerkas] = React.useState("");
  const [sibuk, start] = React.useTransition();
  const berkasRef = React.useRef<HTMLInputElement>(null);

  const t = TEMPLATE.find((x) => x.jenis === jenis)!;
  const isiAwal = awal[jenis] ?? [];

  // Berkas yang sudah terbaca dibuang saat jenis atau bulannya berganti: tabel
  // pratinjau yang tertinggal dari jenis sebelumnya akan tersimpan ke tempat
  // yang salah hanya karena terlihat benar.
  //
  // Disesuaikan SAAT RENDER, bukan lewat efek — pola resmi React untuk state
  // yang bergantung pada prop, dan pola yang sama dipakai form KPI di sebelah.
  const [konteks, setKonteks] = React.useState(`${jenis}|${month}`);
  if (konteks !== `${jenis}|${month}`) {
    setKonteks(`${jenis}|${month}`);
    setBaris(null);
    setNamaBerkas("");
  }

  async function unduh() {
    const XLSX = await import("xlsx");
    const judul = judulKolom(t);
    const aoa: (string | number)[][] = [
      judul,
      ...isiAwal.map((b) => judul.map((k) => (k === t.kunci ? b.kunci : (b.teks[k] ?? b.angka[k] ?? "")))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = judul.map((k) => ({ wch: Math.max(16, k.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t.sheet);
    XLSX.writeFile(wb, `${t.sheet.toLowerCase().replace(/\s+/g, "-")}${t.perBulan ? `-${month}` : ""}.xlsx`);
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
      setNamaBerkas(file.name);
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
      const res = await simpanUnggahAction({ jenis, periode: month, baris });
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
      toast.success(`${res.tersimpan} baris tersimpan — masuk ke ${res.tujuan?.length ?? 0} tempat.`);
      setBaris(null);
      setNamaBerkas("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Pemilih jenis data. Kartu, bukan dropdown: tujuan tiap jenis perlu
          terbaca SEBELUM dipilih, bukan setelahnya. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATE.map((x) => (
          <button
            key={x.jenis}
            type="button"
            onClick={() => setJenis(x.jenis)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-colors",
              x.jenis === jenis ? "border-brand-500 bg-brand-50/60 dark:bg-brand-500/10" : "border-border hover:bg-muted/60",
            )}
          >
            <p className="text-sm font-semibold text-foreground">{x.nama}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {x.perBulan ? `${x.angka.length} kolom angka · per bulan` : `${x.angka.length} kolom angka · tanpa bulan`}
            </p>
          </button>
        ))}
      </div>

      <div className="card-gradient rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {t.perBulan ? (
              <>
                <Button size="sm" variant="outline" className="size-8 p-0" onClick={() => router.push(`${pathname}?month=${geserBulan(month, -1)}`)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">{bulanLabel(month)}</span>
                <Button size="sm" variant="outline" className="size-8 p-0" onClick={() => router.push(`${pathname}?month=${geserBulan(month, 1)}`)}>
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : (
              // Dikatakan apa adanya. Dibiarkan tampak seperti data bulanan,
              // orang akan mengira harga Agustus tersimpan terpisah dari
              // September — lalu mencarinya, dan tidak menemukannya.
              <span className="text-[12px] text-muted-foreground">
                Daftar harga yang berlaku sampai diganti — tidak disimpan per bulan.
              </span>
            )}
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

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[12px] font-medium text-foreground">Data ini akan masuk ke:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {t.tujuan.map((x) => (
              <Badge key={x} tone="brand">
                {x}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {baris ? (
        <Pratinjau t={t} baris={baris} namaBerkas={namaBerkas} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">Belum ada berkas yang dibaca.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Unduh templatenya dulu — barisnya sudah disiapkan lengkap dengan kolom {t.kunci}, tinggal
            melengkapi angkanya.
            {isiAwal.length > 0 && ` Saat ini ${isiAwal.length} baris siap diunduh.`}
          </p>
        </div>
      )}
    </div>
  );
}

/** Pratinjau sebelum disimpan — angka apa adanya, kosong tetap kosong. */
function Pratinjau({ t, baris, namaBerkas }: { t: TemplateUnggah; baris: BarisUnggah[]; namaBerkas: string }) {
  const judul = judulKolom(t);
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">
        <b className="text-foreground">{baris.length} baris</b> dari <b className="text-foreground">{namaBerkas}</b> — belum tersimpan.
      </p>
      <div className="max-h-[28rem] overflow-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr className="border-b border-border text-left">
              {judul.map((k) => (
                <th
                  key={k}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    t.angka.includes(k) && "text-right",
                  )}
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={`${b.kunci}-${i}`} className="border-b border-border/60 last:border-0">
                {judul.map((k) => {
                  if (k === t.kunci) return <td key={k} className="px-3 py-1.5 font-medium text-foreground">{b.kunci}</td>;
                  if (t.angka.includes(k)) {
                    const n = b.angka[k];
                    return (
                      <td key={k} className="px-3 py-1.5 text-right tabular-nums">
                        {/* Kosong TIDAK ditulis nol: yang satu berarti belum
                            dilaporkan, yang lain berarti nol rupiah. */}
                        {n === null ? <span className="text-muted-foreground">—</span> : formatNumber(n)}
                      </td>
                    );
                  }
                  return <td key={k} className="px-3 py-1.5 text-foreground/80">{b.teks[k] || "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
