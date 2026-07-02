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
  hospitality: number;
  hygiene: number;
  complaints: number;
  composite: number;
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
      { accessorKey: "hospitality", header: "Hospitality", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{getValue<number>().toFixed(0)}</span> },
      { accessorKey: "hygiene", header: "Hygiene", cell: ({ getValue }) => <span className="tabular-nums text-foreground">{getValue<number>().toFixed(0)}</span> },
      {
        accessorKey: "complaints",
        header: "Open Complaints",
        cell: ({ getValue }) => {
          const n = getValue<number>();
          return n > 0 ? <Badge tone="warning">{n}</Badge> : <span className="text-muted-foreground/60">—</span>;
        },
      },
      {
        accessorKey: "composite",
        header: "Composite Score",
        cell: ({ getValue }) => (
          <div className="flex">
            <ScoreRing value={getValue<number>()} size={34} stroke={4} />
          </div>
        ),
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
              value={area}
              onChange={setArea}
              className="min-w-0 shrink basis-44"
              options={[{ value: "all", label: "All areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
              searchPlaceholder="Area…"
            />
          }
        />
      </CardContent>
    </Card>
  );
}
