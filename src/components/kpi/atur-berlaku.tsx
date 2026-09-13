"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { simpanSetelanPosisiAction } from "@/lib/actions/kpi";
import { labelBulan, type SetelanPosisi } from "@/lib/kpi/berlaku";
import { cn } from "@/lib/utils";

/**
 * Sejak kapan tiap posisi mulai dinilai — hanya untuk super admin.
 *
 * SATU LAYAR UNTUK SELURUH POSISI, bukan satu tombol di tiap halaman KPI.
 * Yang diatur di sini bukan urusan satu posisi sendiri: posisi yang
 * dikeluarkan dari satu bulan ikut mengubah rata-rata departemennya dan skor
 * KPI Manajemen bulan itu. Keputusan yang saling memengaruhi sebaiknya diambil
 * sambil melihat semuanya sekaligus.
 */

export interface BarisBerlaku {
  kode: string;
  nama: string;
  departemen: string;
  setelan: SetelanPosisi;
}

interface Isi {
  kode: string;
  aktif: boolean;
  berlakuMulai: string;
}

export function AturBerlaku({ baris }: { baris: BarisBerlaku[] }) {
  const router = useRouter();
  const [buka, setBuka] = React.useState(false);
  const [sibuk, setSibuk] = React.useState<string | null>(null);

  const awal = React.useCallback(
    (): Isi[] => baris.map((b) => ({ kode: b.kode, aktif: b.setelan.aktif, berlakuMulai: b.setelan.berlakuMulai ?? "" })),
    [baris],
  );
  const [isi, setIsi] = React.useState<Isi[]>(awal);

  function bukaDialog() {
    setIsi(awal());
    setBuka(true);
  }

  const ubah = (kode: string, patch: Partial<Isi>) =>
    setIsi((rows) => rows.map((r) => (r.kode === kode ? { ...r, ...patch } : r)));

  async function simpan(kode: string) {
    const r = isi.find((x) => x.kode === kode);
    if (!r) return;
    if (r.berlakuMulai && !/^\d{4}-\d{2}$/.test(r.berlakuMulai)) {
      return toast.error("Bulan mulai harus berbentuk 2026-09.");
    }
    setSibuk(kode);
    const res = await simpanSetelanPosisiAction({
      posisi: kode,
      aktif: r.aktif,
      berlakuMulai: r.berlakuMulai || null,
    });
    setSibuk(null);
    if (res.error) return toast.error(res.error);
    toast.success("Tersimpan");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={bukaDialog}>
        <CalendarClock className="size-4" /> Berlakunya KPI
      </Button>

      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent
          title="Berlakunya KPI per Posisi"
          description="Posisi yang belum berlaku tidak ikut menghitung rata-rata departemen maupun KPI Manajemen"
          align="center"
          className="max-w-3xl"
        >
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="w-20 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Dinilai</th>
                    <th className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Posisi</th>
                    <th className="w-40 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Berlaku Mulai</th>
                    <th className="w-24 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {isi.map((r) => {
                    const info = baris.find((b) => b.kode === r.kode)!;
                    return (
                      <tr key={r.kode} className={cn("border-b border-border/60 last:border-0", !r.aktif && "opacity-55")}>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={r.aktif}
                            aria-label={`${r.aktif ? "Matikan" : "Nyalakan"} KPI ${info.nama}`}
                            onClick={() => ubah(r.kode, { aktif: !r.aktif })}
                            className={cn("relative h-5 w-9 rounded-full transition-colors", r.aktif ? "bg-brand-500" : "bg-muted-foreground/35")}
                          >
                            <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", r.aktif ? "left-[1.125rem]" : "left-0.5")} />
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{info.nama}</p>
                          <p className="text-[11px] text-muted-foreground">{info.departemen}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={r.berlakuMulai}
                            onChange={(e) => ubah(r.kode, { berlakuMulai: e.target.value })}
                            placeholder="2026-09"
                            className="h-8"
                            disabled={!r.aktif}
                          />
                          <p className="mt-1 text-[10.5px] text-muted-foreground">
                            {r.berlakuMulai ? `Sejak ${labelBulan(r.berlakuMulai)}` : "Sejak kapan pun"}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => simpan(r.kode)} disabled={sibuk !== null}>
                            {sibuk === r.kode ? <Loader2 className="size-3.5 animate-spin" /> : "Simpan"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-[12px] text-muted-foreground">
              Kosongkan Berlaku Mulai kalau posisinya memang dinilai sejak kapan pun. Bulan mulai ditetapkan sekali dan
              benar selamanya — tidak perlu diingat untuk dinyalakan lagi bulan depan. Data yang sudah terlanjur diisi
              tidak dihapus; ia hanya tidak ikut dihitung pada bulan-bulan sebelum berlakunya.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
