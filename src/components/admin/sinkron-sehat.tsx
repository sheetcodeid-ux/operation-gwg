"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { BarisSehat, StatusSinkron } from "@/lib/data/sinkron-sehat";
import type { Tone } from "@/lib/constants";
import { formatDate, sejakKini } from "@/lib/utils";

/**
 * Kesehatan penarikan otomatis, dibaca sekilas.
 *
 * Kolom yang paling penting di sini "Terakhir Tuntas", bukan "Terakhir Coba".
 * Penarikan yang mogok tetap DICOBA tiap hari — itulah sebabnya ia bisa
 * berhenti bekerja dua belas hari tanpa ada yang curiga. Yang membedakan sehat
 * dari mogok cuma satu: kapan terakhir kali ia benar-benar sampai selesai.
 */

const RUPA: Record<StatusSinkron, { label: string; tone: Tone; Ikon: typeof CheckCircle2 }> = {
  sehat: { label: "Sehat", tone: "success", Ikon: CheckCircle2 },
  tertunda: { label: "Tertunda", tone: "warning", Ikon: Clock },
  bermasalah: { label: "Bermasalah", tone: "danger", Ikon: AlertTriangle },
  "belum pernah": { label: "Belum pernah jalan", tone: "neutral", Ikon: HelpCircle },
};

function Waktu({ iso }: { iso: string | null }) {
  // "Belum pernah" SENGAJA dibedakan dari tanda pisah: yang satu berarti
  // pekerjaannya tidak pernah tuntas sekali pun, yang lain cuma kolom kosong.
  if (!iso) return <span className="text-[12px] font-medium text-rose-600 dark:text-rose-400">belum pernah</span>;
  return (
    <span className="whitespace-nowrap text-foreground/80">
      {sejakKini(iso)}
      <span className="ml-1.5 text-[11px] text-muted-foreground">{formatDate(iso)}</span>
    </span>
  );
}

export function TabelSinkronSehat({ baris }: { baris: BarisSehat[] }) {
  const kolom = React.useMemo<ColumnDef<BarisSehat>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Penarikan",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[22rem]">
            <p className="truncate font-medium text-foreground">{row.original.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Seharusnya tuntas tiap {row.original.jedaWajarJam} jam
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (b) => RUPA[b.status].label,
        cell: ({ row }) => {
          const r = RUPA[row.original.status];
          return (
            <Badge tone={r.tone} dot>
              {r.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "terakhirTuntas",
        header: "Terakhir Tuntas",
        cell: ({ row }) => <Waktu iso={row.original.terakhirTuntas} />,
      },
      {
        accessorKey: "terakhirCoba",
        header: "Terakhir Dicoba",
        cell: ({ row }) => <Waktu iso={row.original.terakhirCoba} />,
      },
      {
        accessorKey: "gagalBeruntun",
        header: "Gagal Beruntun",
        cell: ({ getValue }) => {
          const n = getValue<number>();
          return (
            <span className={n > 0 ? "font-semibold tabular-nums text-rose-600 dark:text-rose-400" : "tabular-nums text-foreground/60"}>
              {n}
            </span>
          );
        },
      },
      {
        accessorKey: "pesan",
        header: "Pesan Terakhir",
        enableSorting: false,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return (
            <p className="max-w-[26rem] truncate text-[12px] text-rose-600 dark:text-rose-400" title={v}>
              {v}
            </p>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      tableId="sinkron-sehat"
      columns={kolom}
      data={baris}
      searchPlaceholder="Cari penarikan…"
      stickyHeader={false}
    />
  );
}
