"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { MonthFilter, monthKey, monthOptions } from "@/components/work/division-filter";
import { formatDate } from "@/lib/utils";

export interface HospitalityRow {
  id: string;
  staffName: string;
  staffPosition: string;
  outletId: string;
  outlet: string;
  areaId: string;
  area: string;
  assessor: string;
  date: string;
  score: number;
}

function scoreColor(s: number) {
  return s >= 85 ? "#22c55e" : s >= 70 ? "#f59e0b" : "#ef4444";
}

export function HospitalityExplorer({ rows, outlets }: { rows: HospitalityRow[]; outlets: { id: string; name: string }[] }) {
  const [month, setMonth] = React.useState("all");
  const [outlet, setOutlet] = React.useState("all");
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.date)), [rows]);

  const scoped = React.useMemo(
    () => rows.filter((r) => (month === "all" || monthKey(r.date) === month) && (outlet === "all" || r.outletId === outlet)),
    [rows, month, outlet],
  );

  const columns = React.useMemo<ColumnDef<HospitalityRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
      {
        accessorKey: "staffName",
        header: "Staff",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.original.staffName} size={32} />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.original.staffName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{row.original.staffPosition}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: "outlet", header: "Outlet", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      { accessorKey: "area", header: "Area", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "assessor", header: "Coordinator Area", cell: ({ getValue }) => <span className="text-foreground/80">{getValue<string>()}</span> },
      {
        accessorKey: "score",
        header: "Score",
        cell: ({ getValue }) => {
          const s = getValue<number>();
          return (
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums" style={{ color: scoreColor(s) }}>
              <span className="size-2 rounded-full" style={{ background: scoreColor(s) }} />
              {s.toFixed(1)}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessments</CardTitle>
        <CardDescription>Kunjungan Coordinator Area · {scoped.length} catatan</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          tableId="hospitality"
          columns={columns}
          data={scoped}
          searchPlaceholder="Cari staff / coordinator…"
          toolbar={
            <div className="flex flex-wrap gap-2">
              <MonthFilter options={months} value={month} onChange={setMonth} className="w-40" />
              <Combobox
                value={outlet}
                onChange={setOutlet}
                className="w-48"
                options={[{ value: "all", label: "All outlets" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
                searchPlaceholder="Outlet…"
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
