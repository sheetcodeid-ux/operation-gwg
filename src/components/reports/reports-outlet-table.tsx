"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";

export interface ReportOutletRow {
  id: string;
  name: string;
  code: string;
  areaId: string;
  area: string;
  /** `null` = outlet ini belum punya audit hospitality. Bukan nol. */
  hospitality: number | null;
  /** `null` = outlet ini belum punya audit hygiene. Bukan nol. */
  hygiene: number | null;
}

/**
 * ┌─ UNKNOWN TIDAK IKUT DIURUTKAN SEBAGAI ANGKA ────────────────────────────┐
 * │                                                                        │
 * │ Pengurutan bawaan TanStack untuk kolom angka adalah `sortingFns.basic`, │
 * │ dan `compareBasic` membandingkan `null` dengan operator `>`. Hasilnya   │
 * │ tidak transitif (`null > 0` dan `null > 75` sama-sama false), sehingga  │
 * │ baris tanpa skor mendarat DI ANTARA skor-skor nyata - persis klaim yang │
 * │ dilarang: yang belum dinilai terbaca sebagai yang bernilai sekian.      │
 * │                                                                        │
 * │ Karena itu skor yang hilang keluar dari accessor sebagai `undefined`,   │
 * │ bukan `null`: `sortUndefined: "last"` diperiksa TanStack sebelum arah   │
 * │ urutan dibalik, jadi UNKNOWN tetap di belakang baik menaik maupun       │
 * │ menurun. Nol yang sungguh-sungguh dinilai tetap angka biasa dan ikut    │
 * │ diurutkan sebagaimana mestinya.                                        │
 * └────────────────────────────────────────────────────────────────────────┘
 */
const skorSort = { sortUndefined: "last" } as const;
const nilaiSkor = (v: number | null): number | undefined => v ?? undefined;

/** Satu sel skor; yang belum dinilai ditulis apa adanya, bukan "0". */
function SelSkor({ v }: { v: number | undefined }) {
  if (v === undefined) return <span className="text-[11px] italic text-muted-foreground/70">Belum ada data</span>;
  return <span className="tabular-nums text-foreground">{v.toFixed(0)}</span>;
}

export function ReportsOutletTable({ rows, areas }: { rows: ReportOutletRow[]; areas: { id: string; name: string }[] }) {
  const [area, setArea] = React.useState("all");
  const scoped = React.useMemo(() => (area === "all" ? rows : rows.filter((r) => r.areaId === area)), [rows, area]);

  const columns = React.useMemo<ColumnDef<ReportOutletRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/reports/outlet/${row.original.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {row.original.name}
            </Link>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      { accessorKey: "area", header: "Region", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
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
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link href={`/reports/outlet/${row.original.id}`}>
              <Badge tone="brand">Report</Badge>
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="reports-outlets"
      columns={columns}
      data={scoped}
      searchPlaceholder="Search outlet…"
      toolbar={
        <Combobox
          portal
          value={area}
          onChange={setArea}
          className="w-44 shrink-0"
          options={[{ value: "all", label: "Semua Region" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
          searchPlaceholder="Cari region…"
        />
      }
    />
  );
}
