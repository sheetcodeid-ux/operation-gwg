"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Boxes, Flame, Package, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { StatTile } from "@/components/ui/stat";
import { Combobox } from "@/components/ui/combobox";
import { CategoryBarChart } from "@/components/charts/charts";
import type { ProduksiRecord } from "@/lib/data/produksi";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

const LABEL_KATEGORI: Record<string, string> = {
  olahan: "Olahan Dapur",
  bakery: "Bakery & Pastry",
  minuman: "Bahan Minuman",
  kemasan: "Repack / Kemasan",
  lainnya: "Lainnya",
};

const fmtTanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Database Produksi — seluruh resep gudang dalam satu tabel.
 *
 * Memakai DataTable, StatTile, dan CategoryBarChart yang sama dengan modul
 * lain, supaya tidak ada yang perlu dipelajari ulang. Yang ditampilkan sengaja
 * biaya, bukan harga: gudang menyerahkan barang ke outlet, tidak menjualnya.
 */
export function ProduksiRekap({ rows }: { rows: ProduksiRecord[] }) {
  const [kategori, setKategori] = React.useState("all");

  const opsiKategori = React.useMemo(() => {
    const ada = [...new Set(rows.map((r) => r.kategori))].sort();
    return [{ value: "all", label: "Semua kategori" }, ...ada.map((k) => ({ value: k, label: LABEL_KATEGORI[k] ?? k }))];
  }, [rows]);

  const tersaring = React.useMemo(
    () => (kategori === "all" ? rows : rows.filter((r) => r.kategori === kategori)),
    [rows, kategori],
  );

  const ringkas = React.useMemo(() => {
    const totalBahan = rows.reduce((s, r) => s + r.biayaBahan, 0);
    const totalOverhead = rows.reduce((s, r) => s + r.biayaOverhead, 0);
    const total = totalBahan + totalOverhead;
    return {
      resep: rows.length,
      bahanPct: total > 0 ? Math.round((totalBahan / total) * 100) : 0,
      totalBahan,
      totalOverhead,
    };
  }, [rows]);

  const perKategori = React.useMemo(() => {
    const peta = new Map<string, number>();
    for (const r of rows) {
      const label = LABEL_KATEGORI[r.kategori] ?? r.kategori;
      peta.set(label, (peta.get(label) ?? 0) + 1);
    }
    return [...peta].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const columns = React.useMemo<ColumnDef<ProduksiRecord>[]>(
    () => [
      {
        accessorKey: "nama",
        header: "Produk",
        cell: ({ row }) => (
          <div className="min-w-[160px] max-w-[280px]">
            <p className="truncate text-sm font-medium text-foreground">{row.original.nama}</p>
            <p className="truncate text-xs text-muted-foreground">
              {LABEL_KATEGORI[row.original.kategori] ?? row.original.kategori}
            </p>
          </div>
        ),
      },
      {
        id: "hasil",
        header: "Hasil",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-foreground">
            {row.original.mode === "batch" ? `${row.original.hasil} ${row.original.hasilUnit}` : "per satuan"}
          </span>
        ),
      },
      {
        accessorKey: "susutPct",
        header: "Susut",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {row.original.susutPct ? `${row.original.susutPct}%` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "biayaBahan",
        header: "Bahan",
        cell: ({ row }) => <span className="whitespace-nowrap text-sm text-foreground">{rp(row.original.biayaBahan)}</span>,
      },
      {
        accessorKey: "biayaOverhead",
        header: "Overhead",
        cell: ({ row }) => <span className="whitespace-nowrap text-sm text-foreground">{rp(row.original.biayaOverhead)}</span>,
      },
      {
        accessorKey: "totalBatch",
        header: "Total Sekali Masak",
        cell: ({ row }) => <span className="whitespace-nowrap text-sm text-foreground">{rp(row.original.totalBatch)}</span>,
      },
      {
        accessorKey: "hppPerUnit",
        header: "Biaya / Satuan",
        cell: ({ row }) => <Badge tone="cyan">{rp(row.original.hppPerUnit)}</Badge>,
      },
      {
        accessorKey: "updatedAt",
        header: "Diperbarui",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtTanggal(row.original.updatedAt)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Package} label="Resep Produksi" value={ringkas.resep} />
        <StatTile icon={Boxes} label="Total Biaya Bahan" value={rp(ringkas.totalBahan)} sub={`${ringkas.bahanPct}% dari total`} />
        <StatTile icon={Flame} label="Total Overhead" value={rp(ringkas.totalOverhead)} />
        <StatTile
          icon={Scale}
          label="Biaya / Satuan Tertinggi"
          value={rows.length ? rp(Math.max(...rows.map((r) => r.hppPerUnit))) : "—"}
        />
      </div>

      {perKategori.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Resep per Kategori</p>
          <CategoryBarChart data={perKategori} height={220} />
        </div>
      )}

      <DataTable
        columns={columns}
        data={tersaring}
        tableId="produksi-rekap"
        searchPlaceholder="Cari nama produk…"
        toolbar={<Combobox value={kategori} onChange={setKategori} options={opsiKategori} className="w-48" />}
      />
    </div>
  );
}
