"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { TENGGAT } from "@/lib/kpi/deadline";
import type { BarisKerjaCreative, BarisRaporPeminta, RingkasDesign } from "@/lib/data/design-rapor";
import { cn, formatNumber } from "@/lib/utils";

/**
 * Papan Antrian Design — angka ringkas, rapot peminta, dan beban tiap desainer.
 *
 * BENTUKNYA MENGIKUTI HALAMAN KPI, bukan gaya sendiri: kartu angka, lalu tabel
 * dengan kolom nomor, lencana, dan bilah persentase yang sama. Halaman yang
 * tampil beda sendiri memaksa orang belajar dua kali untuk membaca hal yang
 * sejenis.
 */

const angka = (n: number) => formatNumber(n, { maximumFractionDigits: 0 });

function Kartu({ label, nilai, tone }: { label: string; nilai: number; tone?: "danger" | "success" | "warning" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "danger" ? "text-rose-600 dark:text-rose-400" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {angka(nilai)}
      </p>
    </div>
  );
}

export function PapanDesign({
  ringkas,
  peminta,
  creative,
}: {
  ringkas: RingkasDesign;
  peminta: BarisRaporPeminta[];
  creative: BarisKerjaCreative[];
}) {
  const kolomPeminta = React.useMemo<ColumnDef<BarisRaporPeminta>[]>(
    () => [
      {
        id: "no",
        header: "#",
        enableSorting: false,
        cell: ({ row, table }) => (
          <span className="tabular-nums text-muted-foreground">
            {table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1}
          </span>
        ),
      },
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span>,
      },
      { accessorKey: "divisi", header: "Divisi / Outlet", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        accessorKey: "total",
        header: "Total Request",
        cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{angka(getValue<number>())}</span>,
      },
      ...TENGGAT.map((t, i) => ({
        id: t.kategori,
        header: t.label,
        accessorFn: (b: BarisRaporPeminta) => b.perKategori[i],
        cell: ({ getValue }: { getValue: () => unknown }) => (
          <span className="tabular-nums text-muted-foreground">{angka(Number(getValue()) || 0)}</span>
        ),
      })),
      {
        id: "mendesak",
        header: "% Mendesak",
        accessorFn: (b) => b.persenMendesak,
        cell: ({ getValue }) => {
          const v = Number(getValue()) || 0;
          const buruk = v >= 30;
          return (
            <div className="flex w-32 items-center gap-2">
              <Progress value={Math.min(100, Math.round(v))} tone={buruk ? "danger" : "success"} className="h-2" />
              <span
                className={cn(
                  "w-12 text-right text-[11.5px] font-medium tabular-nums",
                  buruk ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatNumber(v, { maximumFractionDigits: 0 })}%
              </span>
            </div>
          );
        },
      },
      {
        id: "rapor",
        header: "Rapot",
        accessorFn: (b) => b.rapor.label,
        cell: ({ row }) => <Badge tone={row.original.rapor.tone}>{row.original.rapor.label}</Badge>,
      },
    ],
    [],
  );

  const kolomCreative = React.useMemo<ColumnDef<BarisKerjaCreative>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ getValue }) => <span className="font-medium text-foreground">{getValue<string>()}</span>,
      },
      { accessorKey: "selesai", header: "Total Desain Selesai", cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{angka(getValue<number>())}</span> },
      { accessorKey: "dikerjakan", header: "Total Desain On Progress", cell: ({ getValue }) => <span className="tabular-nums text-foreground/80">{angka(getValue<number>())}</span> },
      {
        accessorKey: "lewatDeadline",
        header: "Total Desain Lewat Deadline",
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return <span className={cn("tabular-nums", v > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground/80")}>{angka(v)}</span>;
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kartu label="Total Desain Request" nilai={ringkas.request} />
        <Kartu label="Total Desain Waiting" nilai={ringkas.menunggu} tone="warning" />
        <Kartu label="Total Desain On Progress" nilai={ringkas.dikerjakan} />
        <Kartu label="Total Desain Selesai" nilai={ringkas.selesai} tone="success" />
        <Kartu label="Total Desain Lewat Deadline" nilai={ringkas.lewatDeadline} tone="danger" />
      </div>

      {creative.length > 0 && (
        <DataTable
          tableId="design-creative"
          columns={kolomCreative}
          data={creative}
          searchPlaceholder="Cari nama…"
          stickyHeader={false}
          showExport={false}
          showSearch={false}
        />
      )}

      {peminta.length > 0 && (
        <>
          <h3 className="mt-1 text-[13px] font-semibold text-foreground">Rapot Pe-Request</h3>
          <p className="-mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            Yang dinilai bukan banyaknya permintaan, melainkan seberapa sering waktunya disisakan terlalu sempit.
            Kolom % Mendesak adalah bagian permintaan H-3 dan H-1 terhadap totalnya.
          </p>
          <DataTable
            tableId="design-peminta"
            columns={kolomPeminta}
            data={peminta}
            searchPlaceholder="Cari nama…"
            stickyHeader={false}
            showExport={false}
          />
        </>
      )}
    </div>
  );
}
