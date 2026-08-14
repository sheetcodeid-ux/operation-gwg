"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Building2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { SCOPE_LABEL, type HcScope } from "@/lib/hcmos/pillars";
import { STATUS_KONTRAK_META, masaKerja } from "@/lib/hcmos/kontrak";
import type { KontrakRow } from "@/lib/data/hcmos";

export interface KaryawanManajemen {
  id: string;
  nama: string;
  email: string;
  departemen: string;
  jabatan: string;
  aktif: boolean;
}

/**
 * Database Karyawan — dua scope, dua sumber, tidak ada daftar ketiga.
 *
 * Manajemen dibaca dari User Management; outlet dari Kontrak Tracker. Halaman
 * ini hanya menyajikan, tidak menyimpan apa pun sendiri — supaya tidak pernah
 * ada versi kedua dari data orang yang sama.
 */
export function KaryawanBoard({
  manajemen,
  outlet,
}: {
  manajemen: KaryawanManajemen[];
  outlet: KontrakRow[];
}) {
  const [scope, setScope] = React.useState<HcScope>("manajemen");

  const kolomManajemen = React.useMemo<ColumnDef<KaryawanManajemen>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      { accessorKey: "departemen", header: "Departemen" },
      { accessorKey: "jabatan", header: "Jabatan" },
      {
        accessorKey: "aktif",
        header: "Status",
        cell: ({ getValue }) =>
          getValue<boolean>() ? (
            <Badge tone="success" dot>
              Aktif
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              Nonaktif
            </Badge>
          ),
      },
    ],
    [],
  );

  const kolomOutlet = React.useMemo<ColumnDef<KontrakRow>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Nama",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.original.jabatan || "—"}
              {row.original.nip ? ` · ${row.original.nip}` : ""}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "outletName",
        header: "Outlet",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{row.original.outletName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.brand ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "jenis",
        header: "Jenis",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status Kontrak",
        cell: ({ row }) => {
          const k = row.original;
          if (k.keluar) return <Badge tone="neutral">Sudah keluar</Badge>;
          const m = STATUS_KONTRAK_META[k.status];
          return (
            <Badge tone={m.tone} dot>
              {m.label}
            </Badge>
          );
        },
      },
      {
        id: "masaKerja",
        header: "Masa Kerja",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {masaKerja(row.original.tglMasukPertama, row.original.tglResign)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <SegmentedTabs
        className="max-w-md"
        value={scope}
        onChange={(v) => setScope(v as HcScope)}
        items={[
          { value: "manajemen", label: SCOPE_LABEL.manajemen, icon: Building2 },
          { value: "outlet", label: SCOPE_LABEL.outlet, icon: Users },
        ]}
      />

      {scope === "manajemen" ? (
        <>
          <DataTable
            tableId="hcmos-karyawan-manajemen"
            columns={kolomManajemen}
            data={manajemen}
            searchPlaceholder="Cari nama, email, departemen…"
          />
          <p className="text-[11px] text-muted-foreground">
            Sumber: User Management. Penambahan, perubahan jabatan, dan penonaktifan dilakukan di sana.
          </p>
        </>
      ) : (
        <>
          <DataTable
            tableId="hcmos-karyawan-outlet"
            columns={kolomOutlet}
            data={outlet}
            searchPlaceholder="Cari nama, outlet…"
          />
          <p className="text-[11px] text-muted-foreground">
            Sumber: Kontrak Tracker. Data diisi Supervisor outlet masing-masing.
          </p>
        </>
      )}
    </div>
  );
}
