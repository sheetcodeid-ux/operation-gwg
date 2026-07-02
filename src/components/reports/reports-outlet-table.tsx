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
  hospitality: number;
  hygiene: number;
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
      { accessorKey: "hospitality", header: "Hospitality", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{getValue<number>().toFixed(0)}</span> },
      { accessorKey: "hygiene", header: "Hygiene", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{getValue<number>().toFixed(0)}</span> },
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
          value={area}
          onChange={setArea}
          className="min-w-0 shrink basis-44"
          options={[{ value: "all", label: "All regions" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
          searchPlaceholder="Region…"
        />
      }
    />
  );
}
