"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { MonthFilter, monthKey, monthOptions } from "@/components/work/division-filter";
import { formatDate } from "@/lib/utils";

export interface HygieneRow {
  id: string;
  outletId: string;
  outlet: string;
  areaId: string;
  area: string;
  shift: string;
  inspector: string;
  date: string;
  score: number;
  isClean: boolean;
  findings: number;
}

function scoreColor(s: number) {
  return s >= 85 ? "#22c55e" : s >= 70 ? "#f59e0b" : "#ef4444";
}

export function HygieneExplorer({ rows, outlets }: { rows: HygieneRow[]; outlets: { id: string; name: string }[] }) {
  const [month, setMonth] = React.useState("all");
  const [outlet, setOutlet] = React.useState("all");
  const months = React.useMemo(() => monthOptions(rows.map((r) => r.date)), [rows]);

  const scoped = React.useMemo(
    () => rows.filter((r) => (month === "all" || monthKey(r.date) === month) && (outlet === "all" || r.outletId === outlet)),
    [rows, month, outlet],
  );

  const columns = React.useMemo<ColumnDef<HygieneRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(getValue<string>())}</span>,
      },
      {
        accessorKey: "outlet",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.outlet}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.area}</p>
          </div>
        ),
      },
      { accessorKey: "shift", header: "Shift", cell: ({ getValue }) => <span className="capitalize text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "inspector", header: "Inspector", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      {
        accessorKey: "findings",
        header: "Findings",
        cell: ({ getValue }) => {
          const n = getValue<number>();
          return n > 0 ? <Badge tone="warning">{n}</Badge> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        accessorKey: "isClean",
        header: "Status",
        cell: ({ getValue }) => {
          const clean = getValue<boolean>();
          return (
            <Badge tone={clean ? "success" : "danger"} dot>
              {clean ? "Clean" : "Attention"}
            </Badge>
          );
        },
      },
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
        <CardTitle>Audits</CardTitle>
        <CardDescription>{scoped.length} catatan</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          tableId="hygiene"
          columns={columns}
          data={scoped}
          searchPlaceholder="Cari outlet / inspector…"
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
