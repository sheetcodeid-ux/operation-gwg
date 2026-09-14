"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Download, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDaftarKpi, type KelompokKpi } from "./daftar-pdf";
import type { RekapSupervisor } from "@/lib/data/supervisor";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Daftar KPI seluruh supervisor.
 *
 * SATU LAYAR UNTUK LIMA PULUH TIGA ORANG. Rapor per orang sudah ada dan tetap
 * bisa dibuka dari sini, tapi yang tidak pernah bisa dijawab rapor per orang
 * adalah pertanyaan yang justru paling sering ditanyakan: siapa yang
 * tertinggal, dan siapa saja yang belum bisa dinilai sama sekali.
 *
 * YANG BELUM BISA DINILAI TIDAK DISEMBUNYIKAN dan tidak ditulis nol. Nol
 * berarti "dinilai dan gagal"; yang sebenarnya terjadi biasanya outletnya
 * belum genap tiga bulan. Dua keadaan itu berbeda jauh, dan yang membagikan
 * KPI harus bisa membedakannya sebelum memutuskan.
 */

const nada: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  warning: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  danger: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function PapanSupervisor({
  rekap,
  bisaLihatSemua,
}: {
  rekap: RekapSupervisor;
  /** Supervisor hanya melihat dirinya; unduhan daftar tidak berlaku baginya. */
  bisaLihatSemua: boolean;
}) {
  const [cari, setCari] = React.useState("");
  const [jenis, setJenis] = React.useState<"semua" | "Umum" | "KPK">("semua");
  const [unduh, setUnduh] = React.useState(false);

  const tampil = React.useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rekap.baris.filter((b) => {
      if (jenis !== "semua" && b.jenis !== jenis) return false;
      if (!q) return true;
      return b.nama.toLowerCase().includes(q) || b.outlet.some((o) => o.toLowerCase().includes(q));
    });
  }, [rekap.baris, cari, jenis]);

  // Kelompoknya mengikuti JENIS, bukan hasil saringan di layar: dokumen
  // pencairan harus memuat semua orang, bukan sebagian yang kebetulan sedang
  // dicari.
  const kelompok: KelompokKpi[] = React.useMemo(
    () =>
      (["Umum", "KPK"] as const).map((j) => ({
        nama: `Supervisor ${j}`,
        catatan: `${rekap.baris.filter((b) => b.jenis === j).length} orang`,
        orang: rekap.baris
          .filter((b) => b.jenis === j)
          .map((b) => ({
            nama: b.nama,
            keterangan: b.outlet.join(", "),
            nilai: b.nilai,
            alasan: b.alasan,
          })),
      })),
    [rekap.baris],
  );

  return (
    <div className="w-full">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kotak label="Supervisor dinilai" nilai={String(rekap.baris.length - rekap.belumDinilai)} sub={`dari ${rekap.baris.length} orang`} />
        <Kotak
          label="Rata-rata skor"
          nilai={rekap.rata === null ? "—" : `${formatNumber(rekap.rata, { maximumFractionDigits: 1 })}%`}
          sub="hanya yang sudah ada angkanya"
        />
        <Kotak
          label="Belum bisa dinilai"
          nilai={String(rekap.belumDinilai)}
          sub={rekap.belumDinilai > 0 ? "outletnya belum genap tiga bulan" : "semuanya sudah terukur"}
          waspada={rekap.belumDinilai > 0}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama atau outlet…"
            className="h-9 w-full rounded-lg border border-input bg-background/40 pl-8 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["semua", "Umum", "KPK"] as const).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setJenis(j)}
              className={cn(
                "h-8 rounded-md px-2.5 text-[12px] transition-colors",
                jenis === j
                  ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {j === "semua" ? "Semua" : j}
            </button>
          ))}
        </div>
        {bisaLihatSemua && (
          <Button variant="outline" className="ml-auto h-9 shrink-0" onClick={() => setUnduh(true)}>
            <Download className="size-4" /> Unduh PDF
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-muted">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nama</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jenis</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Skor</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Peringkat</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {tampil.map((b) => (
              <tr key={b.userId} className="border-t border-border/70 hover:bg-muted/50">
                <td className="px-3 py-2">
                  <span className="block text-[13px] text-foreground">{b.nama}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{b.outlet.join(", ") || "belum dititipi outlet"}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{b.jenis}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {b.nilai === null ? (
                    <span className="text-[12px] text-muted-foreground">—</span>
                  ) : (
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {formatNumber(b.nilai, { maximumFractionDigits: 1 })}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {b.peringkat ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", nada[b.peringkat.tone])}>
                      {b.peringkat.label}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground" title={b.alasan ?? undefined}>
                      Belum dinilai
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right">
                  <Link
                    href={`/kpi/${b.posisi}?pic=${encodeURIComponent(b.userId)}`}
                    aria-label={`Buka rapor ${b.nama}`}
                    className="inline-grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {tampil.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                  Tidak ada supervisor yang cocok dengan pencarian ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DialogDaftarKpi
        open={unduh}
        onOpenChange={setUnduh}
        judul="Daftar KPI Supervisor"
        subjudul="Supervisor Outlet"
        periode={rekap.periode}
        kelompok={kelompok}
      />
    </div>
  );
}

function Kotak({ label, nilai, sub, waspada }: { label: string; nilai: string; sub: string; waspada?: boolean }) {
  return (
    <div className="card-gradient rounded-xl p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {waspada && <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{nilai}</p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}
