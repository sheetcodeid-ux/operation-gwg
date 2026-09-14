"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { simpanPengaturanAction } from "@/lib/actions/kpi";
import { cn } from "@/lib/utils";
import type { BarisKpi } from "@/lib/kpi/hitung";
import type { Indikator } from "@/lib/kpi/indikator";
import type { Satuan } from "@/lib/kpi/satuan";
import { InputSatuan, angkaKetik } from "./input-satuan";

/**
 * Pengaturan bobot dan target.
 *
 * Diminta sejak awal: "untuk bobot harus bisa disetting". Bawaannya ada di
 * kode, tapi kebijakan berubah tiap tahun — dan membongkar kode setiap kali
 * bobot bergeser bukan cara mengelola kebijakan.
 *
 * JUMLAH BOBOT DITAMPILKAN HIDUP saat diketik. Bobot yang tidak berjumlah 100
 * membuat skor tertinggi posisi itu bukan 100 juga, dan itu tidak akan
 * ketahuan sampai seseorang membandingkannya dengan posisi lain di rapat.
 */

interface Baris {
  key: string;
  label: string;
  bobot: string;
  target: string;
  pertumbuhan: string;
  /** Target yang memang dihitung sendiri tidak bisa diketik. */
  targetTerkunci: boolean;
  pakaiPertumbuhan: boolean;
  /** Satuan targetnya — kotak isiannya yang menuliskannya, bukan kepala kolom. */
  satuan?: Satuan;
  keterangan: string;
  aktif: boolean;
}

const teks = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function DialogPengaturan({
  posisi,
  indikator,
  baris,
}: {
  posisi: string;
  /** SELURUH indikator posisi ini, termasuk yang sedang dimatikan — kalau yang
   *  dikirim cuma yang aktif, yang sudah dimatikan tidak akan pernah bisa
   *  dinyalakan lagi dari mana pun. */
  indikator: Indikator[];
  /** Baris hasil hitung — dipakai mengisi nilai yang sedang berlaku. */
  baris: BarisKpi[];
}) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState(false);

  const awal = React.useCallback((): Baris[] => {
    const nilai = new Map(baris.map((b) => [b.key, b]));
    return indikator.map((i) => {
      const b = nilai.get(i.key);
      const dihitung = i.target.jenis === "pekerjaan" || i.target.jenis === "outlet" || i.target.jenis === "tumbuh";
      return {
        key: i.key,
        label: i.label,
        // Indikator yang tidak punya baris hasil hitung berarti dikeluarkan
        // dari penilaian — itulah tanda ia sedang dimatikan.
        aktif: !!b,
        bobot: teks(b?.bobot ?? i.bobot),
        target: dihitung ? "" : teks(i.target.jenis === "tetap" || i.target.jenis === "rasio" ? (b?.target ?? i.target.nilai) : null),
        pertumbuhan: i.target.jenis === "tumbuh" ? String(i.target.pertumbuhan) : "",
        targetTerkunci: dihitung,
        pakaiPertumbuhan: i.target.jenis === "tumbuh",
        satuan: i.satuan,
        keterangan:
          i.target.jenis === "pekerjaan"
            ? "Target = jumlah pekerjaan yang masuk"
            : i.target.jenis === "outlet"
              ? "Target = jumlah outlet aktif"
              : i.target.jenis === "tumbuh"
                ? "Target = capaian bulan lalu + pertumbuhan"
                : i.target.jenis === "rasio"
                  ? "Target berupa persentase"
                  : "Target tetap",
      };
    });
  }, [indikator, baris]);

  const [isi, setIsi] = React.useState<Baris[]>(awal);

  // Disetel saat dialognya DIBUKA, bukan lewat efek. Efek yang memanggil
  // setState menjalankan render kedua setiap kali dialognya muncul, dan React
  // Compiler menandainya — padahal yang dibutuhkan cuma satu hal: angkanya
  // kembali ke yang sedang berlaku, bukan sisa ketikan sebelumnya.
  function bukaDialog() {
    setIsi(awal());
    setBuka(true);
  }

  const ubah = (key: string, kolom: "bobot" | "target" | "pertumbuhan", v: string) =>
    setIsi((rows) => rows.map((r) => (r.key === key ? { ...r, [kolom]: v } : r)));

  const ubahAktif = (key: string) =>
    setIsi((rows) => rows.map((r) => (r.key === key ? { ...r, aktif: !r.aktif } : r)));

  // HANYA YANG AKTIF yang dijumlahkan. Indikator yang dimatikan tidak ikut
  // dinilai, jadi bobotnya juga tidak boleh ikut menghitung apakah sudah 100%.
  const totalBobot = isi.reduce((a, r) => a + (r.aktif ? (angkaKetik(r.bobot) ?? 0) : 0), 0);
  const dimatikan = isi.filter((r) => !r.aktif).length;
  const pas = Math.abs(totalBobot - 100) < 0.001;

  async function simpan() {
    setSibuk(true);
    const res = await simpanPengaturanAction({
      posisi,
      ubahan: isi.map((r) => ({
        indikator: r.key,
        bobot: r.bobot === "" ? null : angkaKetik(r.bobot),
        target: r.targetTerkunci || r.target === "" ? null : angkaKetik(r.target),
        pertumbuhan: r.pakaiPertumbuhan && r.pertumbuhan !== "" ? angkaKetik(r.pertumbuhan) : null,
        aktif: r.aktif,
      })),
    });
    setSibuk(false);
    if (res.error) return toast.error(res.error);
    toast.success("Pengaturan indikator tersimpan");
    setBuka(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={bukaDialog}>
        <SlidersHorizontal className="size-4" /> Pengaturan
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Pengaturan Indikator"
          description="Status, bobot, dan target — berlaku untuk semua bulan sampai diubah lagi"
          align="center"
          className="max-w-3xl"
        >
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="w-20 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Indikator</th>
                    <th className="w-24 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Bobot %</th>
                    <th className="w-28 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Target</th>
                    <th className="w-32 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Pertumbuhan %</th>
                  </tr>
                </thead>
                <tbody>
                  {isi.map((r) => (
                    <tr key={r.key} className={cn("border-b border-border/60 last:border-0", !r.aktif && "opacity-55")}>
                      <td className="px-3 py-2">
                        {/* Sakelarnya, bukan kotak centang: yang diubah di sini
                            berlaku seketika untuk seluruh penilaian posisi ini,
                            dan sakelar membaca keadaan sekarang lebih jelas. */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={r.aktif}
                          aria-label={`${r.aktif ? "Matikan" : "Nyalakan"} ${r.label}`}
                          onClick={() => ubahAktif(r.key)}
                          className={cn(
                            "relative h-5 w-9 rounded-full transition-colors",
                            r.aktif ? "bg-brand-500" : "bg-muted-foreground/35",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                              r.aktif ? "left-[1.125rem]" : "left-0.5",
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{r.label}</p>
                        <p className="text-[11px] text-muted-foreground">{r.keterangan}</p>
                      </td>
                      <td className="px-3 py-2">
                        <InputSatuan satuan="persen" izinkanMinus={false} tinggi="h-8" nilai={r.bobot} onUbah={(v) => ubah(r.key, "bobot", v)} disabled={!r.aktif} />
                      </td>
                      <td className="px-3 py-2">
                        {r.targetTerkunci ? (
                          <span className="text-[11px] text-muted-foreground">otomatis</span>
                        ) : (
                          <InputSatuan satuan={r.satuan} tinggi="h-8" nilai={r.target} onUbah={(v) => ubah(r.key, "target", v)} disabled={!r.aktif} />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.pakaiPertumbuhan ? (
                          <InputSatuan satuan="persen" tinggi="h-8" nilai={r.pertumbuhan} onUbah={(v) => ubah(r.key, "pertumbuhan", v)} disabled={!r.aktif} />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className={
                pas
                  ? "rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-emerald-800 dark:text-emerald-200"
                  : "rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12.5px] text-amber-800 dark:text-amber-200"
              }
            >
              Jumlah bobot <b>{totalBobot.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%</b>
              {pas ? " — pas 100%." : " — belum 100%. Skor tertinggi posisi ini akan berhenti di angka itu."}
              {dimatikan > 0 && (
                <>
                  {" "}
                  {dimatikan} indikator dimatikan — tidak ikut dinilai, dan bobotnya tidak ikut dijumlah. Datanya
                  tetap tersimpan dan kembali apa adanya begitu dinyalakan lagi.
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setBuka(false)} disabled={sibuk}>
                Batal
              </Button>
              <Button onClick={simpan} disabled={sibuk}>
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : <SlidersHorizontal className="size-4" />} Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
