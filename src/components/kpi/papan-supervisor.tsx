"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, ListChecks, Search, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DialogDaftarKpi, type KelompokKpi } from "./daftar-pdf";
import { IsiProblemSolver } from "./isi-problem-solver";
import { BULAN, periodeDari, tahunPilihan } from "./periode";
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
  bisaIsi = false,
}: {
  rekap: RekapSupervisor;
  /** Yang hanya melihat outletnya sendiri tidak mengunduh daftar. */
  bisaLihatSemua: boolean;
  /** Boleh mengisi Problem Solver — Head Operation dan Super Admin. */
  bisaIsi?: boolean;
}) {
  const router = useRouter();
  const [cari, setCari] = React.useState("");
  const [jenis, setJenis] = React.useState<"semua" | "Umum" | "KPK">("semua");
  const [unduh, setUnduh] = React.useState(false);
  const [isiPs, setIsiPs] = React.useState(false);

  // ┌─ BULAN MANA YANG SEDANG DIBUKA ─────────────────────────────────────────┐
  // │ Halamannya sejak awal menerima `?bulan=`, tapi tidak ada satu pun cara  │
  // │ mengubahnya dari layar: yang mau mengisi Problem Solver bulan lalu      │
  // │ terjebak di bulan berjalan, dan satu-satunya jalan keluar adalah        │
  // │ mengetik sendiri alamatnya. Pemilihnya dibaca DARI `rekap.periode` —    │
  // │ bukan dari jam peramban — supaya yang tertulis di dropdown selalu bulan │
  // │ yang angkanya benar-benar sedang ditampilkan.                           │
  // └─────────────────────────────────────────────────────────────────────────┘
  const [tahun, bulan] = rekap.periode.split("-");

  function gantiPeriode(th: string, bl: string) {
    router.push(`/kpi/supervisor?bulan=${periodeDari(th, bl)}`);
  }

  const tampil = React.useMemo(() => {
    const q = cari.trim().toLowerCase();
    return rekap.baris.filter((b) => {
      if (jenis !== "semua" && b.jenis !== jenis) return false;
      if (!q) return true;
      return b.nama.toLowerCase().includes(q) || b.supervisor.toLowerCase().includes(q);
    });
  }, [rekap.baris, cari, jenis]);

  // Kelompoknya mengikuti JENIS, bukan hasil saringan di layar: dokumen
  // pencairan harus memuat semua orang, bukan sebagian yang kebetulan sedang
  // dicari.
  const kelompok: KelompokKpi[] = React.useMemo(
    () =>
      (["Umum", "KPK"] as const).map((j) => ({
        nama: `Supervisor ${j}`,
        orang: rekap.baris
          .filter((b) => b.jenis === j)
          .map((b) => ({
            nama: b.nama,
            keterangan: b.supervisor,
            nilai: b.nilai,
            alasan: b.alasan,
            // Rincian tiap indikator ikut, supaya dokumennya menjawab
            // "kenapa segini", bukan hanya "berapa".
            indikator: b.indikator,
          })),
      })),
    [rekap.baris],
  );

  return (
    <div className="w-full">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kotak
          label="Outlet dinilai"
          nilai={String(rekap.baris.length - rekap.belumDinilai)}
          sub={`dari ${rekap.baris.length} outlet berjalan`}
        />
        <Kotak
          label="Rata-rata skor"
          nilai={rekap.rata === null ? "—" : `${formatNumber(rekap.rata, { maximumFractionDigits: 1 })}%`}
          sub="hanya yang sudah ada angkanya"
        />
        <Kotak
          label="Belum genap 3 bulan"
          nilai={String(rekap.belumTigaBulan.length)}
          sub={
            rekap.belumTigaBulan.length > 0
              ? "dikeluarkan dari penilaian"
              : "seluruh outlet sudah berjalan"
          }
          waspada={rekap.belumTigaBulan.length > 0}
          judul={rekap.belumTigaBulan.join(", ")}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Tahun dan bulan terpisah — pola yang sama dengan pemilih periode KPI
            lainnya, supaya tidak ada yang perlu menerjemahkan "2026-08". */}
        <Combobox
          searchable={false}
          value={bulan}
          onChange={(v) => gantiPeriode(tahun, v)}
          options={BULAN}
          className="w-36 shrink-0"
          matchTriggerWidth
        />
        <Combobox
          searchable={false}
          value={tahun}
          onChange={(v) => gantiPeriode(v, bulan)}
          options={tahunPilihan()}
          className="w-24 shrink-0"
          matchTriggerWidth
        />
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari outlet atau supervisor…"
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {bisaIsi && (
            <Button variant="outline" className="h-9" onClick={() => setIsiPs(true)}>
              <ListChecks className="size-4" /> Isi Problem Solver
            </Button>
          )}
          {bisaLihatSemua && (
            <Button variant="outline" className="h-9" onClick={() => setUnduh(true)}>
              <Download className="size-4" /> Unduh PDF
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-muted">
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outlet</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jenis</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Skor</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Peringkat</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {tampil.map((b) => (
              <tr key={b.outletId} className="border-t border-border/70 hover:bg-muted/50">
                <td className="px-3 py-2">
                  <span className="block text-[13px] text-foreground">{b.nama}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{b.supervisor}</span>
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
                    href={`/kpi/${b.posisi}?pic=${encodeURIComponent(b.outletId)}`}
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
                  Tidak ada outlet yang cocok dengan pencarian ini.
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
        subjudul="Per Outlet"
        periode={rekap.periode}
        kelompok={kelompok}
        satuan="outlet"
      />

      {bisaIsi && <IsiProblemSolver open={isiPs} onOpenChange={setIsiPs} periode={rekap.periode} />}
    </div>
  );
}

function Kotak({
  label,
  nilai,
  sub,
  waspada,
  judul,
}: {
  label: string;
  nilai: string;
  sub: string;
  waspada?: boolean;
  judul?: string;
}) {
  return (
    <div className="card-gradient rounded-xl p-4" title={judul || undefined}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {waspada && <TriangleAlert className="size-3.5 text-amber-600 dark:text-amber-400" />}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{nilai}</p>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>
    </div>
  );
}
