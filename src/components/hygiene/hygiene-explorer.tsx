"use client";

import * as React from "react";
import Image from "next/image";
import { type ColumnDef } from "@tanstack/react-table";
import { Camera } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { scoreColor } from "@/components/ui/tone";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
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
  photos: Attachment[];
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
        id: "photos",
        header: "Photos",
        enableSorting: false,
        cell: ({ row }) => {
          const photos = row.original.photos;
          if (!photos?.length) return <span className="text-muted-foreground/60">—</span>;
          return (
            <Dialog>
              <DialogTrigger>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Camera className="size-3.5" /> {photos.length}
                </button>
              </DialogTrigger>
              <DialogContent title="Dokumentasi Audit" description={`${row.original.outlet} · ${formatDate(row.original.date)}`} align="center" className="max-w-2xl">
                <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto p-5 sm:grid-cols-3">
                  {photos.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group block">
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg ring-1 ring-border transition-opacity group-hover:opacity-90">
                        <Image
                          src={p.url}
                          alt={p.name}
                          fill
                          sizes="(max-width: 640px) 33vw, 200px"
                          className="object-cover"
                        />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.name}</p>
                    </a>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          );
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
            <div className="contents">
              <MonthFilter options={months} value={month} onChange={setMonth} className="w-40 shrink-0" />
              <Combobox
                portal
                value={outlet}
                onChange={setOutlet}
                className="w-48 shrink-0"
                options={[{ value: "all", label: "Semua Outlet" }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]}
                searchPlaceholder="Cari outlet…"
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
