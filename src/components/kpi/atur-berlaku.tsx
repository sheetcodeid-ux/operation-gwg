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
            {/* DAFTAR, BUKAN TABEL. Tabel dengan lebar minimum menggeser kolom
                nama keluar layar di ponsel — yang tersisa cuma kotak bulan dan
                tombol Simpan, tanpa satu pun petunjuk itu posisi apa. Dengan
                daftar yang membungkus, nama posisinya selalu terlihat. */}
            <div className="divide-y divide-border/60 rounded-xl border border-border">
              {isi.map((r) => {
                const info = baris.find((b) => b.kode === r.kode)!;
                return (
                  <div
                    key={r.kode}
                    className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", !r.aktif && "opacity-55")}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.aktif}
                      aria-label={`${r.aktif ? "Matikan" : "Nyalakan"} KPI ${info.nama}`}
                      onClick={() => ubah(r.kode, { aktif: !r.aktif })}
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
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

                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate font-medium text-foreground">{info.nama}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{info.departemen}</p>
                    </div>

                    <div className="w-32 shrink-0">
                      <Input
                        value={r.berlakuMulai}
                        onChange={(e) => ubah(r.kode, { berlakuMulai: e.target.value })}
                        placeholder="2026-09"
                        className="h-8"
                        disabled={!r.aktif}
                        aria-label={`Berlaku mulai ${info.nama}`}
                      />
                      <p className="mt-1 truncate text-[10.5px] text-muted-foreground">
                        {r.berlakuMulai ? `Sejak ${labelBulan(r.berlakuMulai)}` : "Sejak kapan pun"}
                      </p>
                    </div>

                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => simpan(r.kode)} disabled={sibuk !== null}>
                      {sibuk === r.kode ? <Loader2 className="size-3.5 animate-spin" /> : "Simpan"}
                    </Button>
                  </div>
                );
              })}
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
