"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { Lock, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { KpiIndicatorDonut, KpiPerformanceChart } from "./kpi-charts";
import type { BarisKpi, BarisEfisiensi } from "@/lib/kpi/hitung";
import type { DetailFee, DetailPasar, LaporanKpi } from "@/lib/data/kpi";
import { formatIDR, formatNumber } from "@/lib/utils";

/**
 * Halaman KPI satu posisi — SATU komponen untuk sepuluh posisi.
 *
 * Susunannya mengikuti Work Tracker baris demi baris: bilah saringan, lalu
 * grafik kiri + donat kanan pada grid `minmax(0,1fr) 23rem`, lalu tabel dengan
 * pengurutan, pencarian, dan penomoran halaman yang sama. Yang berbeda hanya
 * isinya.
 *
 * PANEL TAMBAHAN TIDAK PERNAH TERCAMPUR. Efisiensi Beban Operasional dan
 * Keberhasilan Pasar hanya muncul untuk posisi Product Development & Quality
 * yang memang dinilai atasnya; Invoice Management Fee hanya untuk Accounting.
 * Server yang menentukannya — panel yang tidak dipakai posisi ini datang
 * sebagai `null` dan tidak punya jalan untuk tampil.
 */

const persen = (n: number | null, digit = 2) =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

const angka = (n: number | null) => (n === null ? "—" : formatNumber(n, { maximumFractionDigits: 2 }));

export interface OpsiPosisi {
  value: string;
  label: string;
}

export function PapanKpi({
  laporan,
  lalu,
  namaPosisi,
  departemen,
  pic,
  periodeOpsi,
  departemenOpsi,
  posisiOpsi,
  bolehAtur,
}: {
  laporan: LaporanKpi;
  lalu: Record<string, number | null>;
  namaPosisi: string;
  departemen: string;
  pic: string[];
  periodeOpsi: OpsiPosisi[];
  departemenOpsi: OpsiPosisi[];
  posisiOpsi: OpsiPosisi[];
  bolehAtur: boolean;
}) {
  const router = useRouter();
  const { baris, ringkas } = laporan;
  const subtitle = `${labelPeriode(laporan.periode)} · ${namaPosisi}`;
  const bobotTimpang = Math.abs(ringkas.bobotTotal - 100) > 0.001;

  const kolom = React.useMemo<ColumnDef<BarisKpi>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Indikator",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[20rem]">
            <p className="truncate font-medium text-foreground">{row.original.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.alasan ?? row.original.penjelasan}</p>
          </div>
        ),
      },
      {
        accessorKey: "kategori",
        header: "Kategori",
        cell: ({ getValue }) => {
          const v = getValue<string | undefined>();
          return v ? <Badge tone="brand">{v}</Badge> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "bobot",
        header: "Bobot",
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{persen(getValue<number>(), 0)}</span>,
      },
      {
        accessorKey: "target",
        header: "Target",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{angka(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "actual",
        header: "Actual",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{angka(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "persentase",
        header: "Persentase",
        cell: ({ row }) => {
          const p = row.original.persentase;
          if (p === null) return <span className="text-[11px] text-muted-foreground">belum ada data</span>;
          return (
            <div className="flex w-28 items-center gap-2">
              <Progress value={Math.round(p)} tone={p >= 100 ? "success" : "brand"} />
              <span className="w-11 text-right text-[11px] tabular-nums text-muted-foreground">{persen(p, 0)}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "persenActual",
        header: "% Actual",
        cell: ({ getValue }) => (
          <span className="font-semibold tabular-nums text-foreground">{persen(getValue<number | null>())}</span>
        ),
      },
    ],
    [],
  );

  function ganti(param: string, nilai: string) {
    const url = new URL(window.location.href);
    if (param === "posisi") {
      url.pathname = `/kpi/${nilai}`;
    } else if (param === "departemen") {
      // Departemen bukan alamat halaman; memilihnya membuka posisi pertamanya.
      router.push(`/kpi?dep=${nilai}`);
      return;
    } else {
      url.searchParams.set(param, nilai);
    }
    router.push(`${url.pathname}${url.search}`);
  }

  return (
    <div>
      {/* Bilah saringan — bentuknya sama dengan Work Tracker: satu baris yang
          bisa digeser ke samping di layar kecil. */}
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox
          portal
          searchable={false}
          className="w-44 shrink-0"
          value={laporan.periode}
          onChange={(v) => ganti("periode", v)}
          options={periodeOpsi}
        />
        <Combobox
          portal
          searchable={false}
          className="w-56 shrink-0"
          value={departemen}
          onChange={(v) => ganti("departemen", v)}
          options={departemenOpsi}
        />
        <Combobox
          portal
          searchable={false}
          className="w-56 shrink-0"
          value={laporan.posisi}
          onChange={(v) => ganti("posisi", v)}
          options={posisiOpsi}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {laporan.dikunci && (
            <Badge tone="neutral">
              <Lock className="size-3" /> Bulan dikunci
            </Badge>
          )}
          {pic.length > 0 && <span className="hidden text-[11.5px] text-muted-foreground sm:inline">{pic.join(" · ")}</span>}
          {bolehAtur && (
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-4" /> Pengaturan
            </Button>
          )}
        </div>
      </div>

      {/* Grafik + donat — grid yang sama dengan Work Tracker. */}
      <div className="mb-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <KpiPerformanceChart baris={baris} lalu={lalu} subtitle={subtitle} />
        <KpiIndicatorDonut baris={baris} subtitle={subtitle} />
      </div>

      {bobotTimpang && (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-200">
          Bobot indikator posisi ini berjumlah <b>{persen(ringkas.bobotTotal, 0)}</b>, bukan 100%. Skor tertingginya ikut
          terbatas di angka itu — perbaiki lewat Pengaturan agar setara dengan posisi lain.
        </p>
      )}

      <DataTable
        tableId="kpi-indikator"
        columns={kolom}
        data={baris}
        searchPlaceholder="Cari indikator…"
        stickyHeader={false}
        toolbar={
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Skor bulan ini</span>
            <span className="text-base font-semibold tabular-nums text-foreground">{persen(ringkas.skor)}</span>
            <span className="text-muted-foreground">
              dari bobot {persen(ringkas.bobotTotal, 0)}
              {ringkas.jumlahBelumTerukur > 0 && ` · ${ringkas.jumlahBelumTerukur} indikator belum terukur`}
            </span>
          </div>
        }
      />

      {laporan.efisiensi && <PanelEfisiensi data={laporan.efisiensi} />}
      {laporan.fee && <PanelFee data={laporan.fee} />}
      {laporan.pasar && <PanelPasar data={laporan.pasar} />}
    </div>
  );
}

function labelPeriode(p: string): string {
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const [th, bl] = p.split("-");
  const i = Number(bl) - 1;
  return i >= 0 && i < 12 ? `${BULAN[i]} ${th}` : p;
}

/* ─────────────────────────────── panel tambahan ─────────────────────────────── */

function JudulPanel({ judul, ringkas }: { judul: string; ringkas: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{judul}</h3>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{ringkas}</p>
    </div>
  );
}

function PanelEfisiensi({ data }: { data: NonNullable<LaporanKpi["efisiensi"]> }) {
  const { baris, ringkas } = data;
  const kolom = React.useMemo<ColumnDef<BarisEfisiensi>[]>(
    () => [
      { accessorKey: "outletNama", header: "Outlet", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "average", header: "Average 3 Bln", cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      { accessorKey: "targetWh", header: "Target WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} muted /> },
      { accessorKey: "targetNonWh", header: "Target Non-WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} muted /> },
      { accessorKey: "actualWh", header: "Actual WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} kosong="isi" /> },
      { accessorKey: "actualNonWh", header: "Actual Non-WH", cell: ({ getValue }) => <Rp v={getValue<number | null>()} kosong="isi" /> },
      {
        accessorKey: "persenActual",
        header: "% Actual",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{persen(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "selisih",
        header: "Status",
        cell: ({ getValue }) => {
          const s = getValue<number | null>();
          if (s === null) return <span className="text-[11px] text-muted-foreground">No Data</span>;
          return (
            <Badge tone={s <= 0 ? "success" : "danger"} dot>
              {s <= 0 ? "Tersisa" : "Melebihi"} {persen(Math.abs(s))}
            </Badge>
          );
        },
      },
    ],
    [],
  );

  return (
    <section>
      <JudulPanel
        judul="Efisiensi Beban Operasional"
        ringkas={
          <>
            Budget seluruh outlet {formatIDR(ringkas.totalBudget)} · realisasi {formatIDR(ringkas.totalActual)} ·{" "}
            {ringkas.persenActual === null ? (
              "belum ada realisasi yang diisi"
            ) : (
              <>
                {persen(ringkas.persenActual)} dari penjualan —{" "}
                <b className={ringkas.selisih! <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {ringkas.selisih! <= 0 ? "tersisa" : "melebihi"} {persen(Math.abs(ringkas.selisih!))}
                </b>
              </>
            )}{" "}
            · {ringkas.outletTerhitung} outlet terhitung, {ringkas.outletTanpaData} belum diisi
          </>
        }
      />
      <DataTable tableId="kpi-efisiensi" columns={kolom} data={baris} searchPlaceholder="Cari outlet…" stickyHeader={false} />
    </section>
  );
}

function PanelFee({ data }: { data: DetailFee[] }) {
  const sesuai = data.filter((d) => d.sesuai).length;
  const kolom = React.useMemo<ColumnDef<DetailFee>[]>(
    () => [
      { accessorKey: "outletNama", header: "Outlet", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "netSales", header: "Net Sales", cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      { accessorKey: "feeSeharusnya", header: "Fee Seharusnya", cell: ({ getValue }) => <Rp v={getValue<number | null>()} /> },
      {
        accessorKey: "sesuai",
        header: "Sesuai",
        cell: ({ getValue }) => (
          <Badge tone={getValue<boolean>() ? "success" : "neutral"} dot>
            {getValue<boolean>() ? "Sesuai" : "Belum"}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <section>
      <JudulPanel
        judul="Invoice Management Fee"
        ringkas={`${sesuai} dari ${data.length} outlet sudah diceklis sesuai. Management fee seharusnya 5% dari net sales bulan ini — ceklisnya dimulai dari nol setiap ganti bulan.`}
      />
      <DataTable tableId="kpi-fee" columns={kolom} data={data} searchPlaceholder="Cari outlet…" stickyHeader={false} />
    </section>
  );
}

function PanelPasar({ data }: { data: DetailPasar }) {
  const kolom = React.useMemo<ColumnDef<DetailPasar["baris"][number]>[]>(
    () => [
      { accessorKey: "menu", header: "Nama Menu", cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span> },
      { accessorKey: "penjualan", header: "Penjualan 3 Bulan", cell: ({ getValue }) => <Rp v={getValue<number>()} /> },
      {
        accessorKey: "bagian",
        header: "Bagian dari Omset",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{persen(getValue<number>())}</span>,
      },
    ],
    [],
  );

  return (
    <section>
      <JudulPanel
        judul="Keberhasilan Pasar"
        ringkas={
          data.baris.length === 0
            ? "Belum ada menu yang dipilih untuk dinilai bulan ini."
            : `${data.baris.length} menu dipilih · penjualan ${formatIDR(data.total)} dari omset ${formatIDR(data.omset)} · ${persen(data.bagianTotal)}`
        }
      />
      <DataTable tableId="kpi-pasar" columns={kolom} data={data.baris} searchPlaceholder="Cari menu…" stickyHeader={false} showExport={false} />
    </section>
  );
}

function Rp({ v, muted, kosong }: { v: number | null; muted?: boolean; kosong?: string }) {
  if (v === null) return <span className="text-[11px] text-muted-foreground">{kosong ?? "—"}</span>;
  return <span className={muted ? "tabular-nums text-muted-foreground" : "tabular-nums text-foreground/80"}>{formatIDR(v)}</span>;
}
