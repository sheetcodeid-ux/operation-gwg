"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { ScoreRing } from "@/components/ui/score-ring";

export interface OutletRow {
  id: string;
  name: string;
  code: string;
  city: string;
  areaId: string;
  area: string;
  supervisor: string;
  /** `null` = belum ada bukti audit hospitality. Bukan nol. */
  hospitality: number | null;
  /** `null` = belum ada bukti audit hygiene. Bukan nol. */
  hygiene: number | null;
  complaints: number;
  /** `null` bila salah satu komponen skornya belum ada buktinya. */
  composite: number | null;
}

/**
 * ┌─ UNKNOWN TIDAK IKUT DIURUTKAN SEBAGAI ANGKA ────────────────────────────┐
 * │                                                                        │
 * │ Kolom angka tanpa `sortingFn` khusus memakai `sortingFns.basic`, dan    │
 * │ `compareBasic` membandingkan `null` dengan operator `>`. Perbandingannya │
 * │ tidak transitif (`null > 0` dan `null > 75` sama-sama false), sehingga  │
 * │ begitu pengguna mengurutkan kolom skor, baris "Belum ada data" mendarat │
 * │ DI ANTARA skor nyata — outlet yang belum diperiksa terbaca sebagai      │
 * │ outlet yang nilainya sekian.                                           │
 * │                                                                        │
 * │ Maka skor yang hilang keluar dari accessor sebagai `undefined`:         │
 * │ `sortUndefined: "last"` diperiksa TanStack SEBELUM arah urutan dibalik  │
 * │ (`getSortedRowModel`), jadi UNKNOWN tetap di belakang pada kedua arah.  │
 * │ Nol yang memang dinilai tetap angka biasa dan ikut terurut wajar.       │
 * │                                                                        │
 * │ Aturan yang sama dipakai tabel peringkat `/dashboard` dan tabel report; │
 * │ satu data tidak boleh punya dua aturan urutan.                          │
 * └────────────────────────────────────────────────────────────────────────┘
 */
const skorSort = { sortUndefined: "last" } as const;
const nilaiSkor = (v: number | null): number | undefined => v ?? undefined;

/** Satu sel skor; yang belum dinilai ditulis apa adanya, bukan "0". */
function SelSkor({ v }: { v: number | undefined }) {
  if (v === undefined) return <span className="text-[11px] italic text-muted-foreground/70">Belum ada data</span>;
  return <span className="tabular-nums text-foreground">{v.toFixed(0)}</span>;
}

export function OutletsExplorer({ rows, areas }: { rows: OutletRow[]; areas: { id: string; name: string }[] }) {
  const [area, setArea] = React.useState("all");
  const scoped = React.useMemo(() => (area === "all" ? rows : rows.filter((r) => r.areaId === area)), [rows, area]);

  const columns = React.useMemo<ColumnDef<OutletRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/outlets/${row.original.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {row.original.name}
            </Link>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.code} · {row.original.city}</p>
          </div>
        ),
      },
      { accessorKey: "area", header: "Area", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "supervisor", header: "Supervisor", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        id: "hospitality",
        accessorFn: (r) => nilaiSkor(r.hospitality),
        header: "Hospitality",
        ...skorSort,
        cell: ({ getValue }) => <SelSkor v={getValue<number | undefined>()} />,
      },
      {
        id: "hygiene",
        accessorFn: (r) => nilaiSkor(r.hygiene),
        header: "Hygiene",
        ...skorSort,
        cell: ({ getValue }) => <SelSkor v={getValue<number | undefined>()} />,
      },
      {
        accessorKey: "complaints",
        header: "Open Complaints",
        cell: ({ getValue }) => {
          const n = getValue<number>();
          return n > 0 ? <Badge tone="warning">{n}</Badge> : <span className="text-muted-foreground/60">—</span>;
        },
      },
      {
        id: "composite",
        accessorFn: (r) => nilaiSkor(r.composite),
        header: "Composite Score",
        ...skorSort,
        cell: ({ getValue }) => {
          const v = getValue<number | undefined>();
          return (
            <div className="flex">
              {v === undefined ? (
                <span
                  title="Outlet ini belum punya catatan audit yang cukup untuk dinilai. Belum dinilai — bukan bernilai nol."
                  className="cursor-help text-[11px] italic text-muted-foreground/70"
                >
                  Belum ada data
                </span>
              ) : (
                <ScoreRing value={v} size={34} stroke={4} />
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outlet Directory</CardTitle>
        <CardDescription>{scoped.length} outlets</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          tableId="outlets"
          columns={columns}
          data={scoped}
          searchPlaceholder="Search outlet / city…"
          toolbar={
            <Combobox
              portal
              value={area}
              onChange={setArea}
              className="w-44 shrink-0"
              options={[{ value: "all", label: "Semua Area" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              searchPlaceholder="Cari area…"
            />
          }
        />
      </CardContent>
    </Card>
  );
}
